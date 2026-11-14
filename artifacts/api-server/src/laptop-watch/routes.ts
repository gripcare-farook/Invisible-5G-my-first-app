import { Router, type IRouter } from "express";
import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { pool } from "@workspace/db";
import { requireAdmin, requireRole } from "../middlewares/auth";
import { sameOrigin } from "./access";
import { catalog, snapshot } from "./store";
import { validateSubscription, deliverPending } from "./push";
const router: IRouter = Router();
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
router.use(sameOrigin);
router.post("/accept-invite", async (req, res) => {
  const { token, name, email, password } = req.body ?? {};
  if (
    typeof token !== "string" ||
    !/^[a-f0-9]{64}$/.test(token) ||
    typeof name !== "string" ||
    !name.trim() ||
    name.length > 100 ||
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 200 ||
    typeof password !== "string" ||
    password.length < 12 ||
    Buffer.byteLength(password) > 72
  ) {
    res
      .status(400)
      .json({
        message: "Use a valid invite, name, email and a 12–72 byte password.",
      });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const invite = await client.query(
      "UPDATE lw_invites SET used_at=now() WHERE token_hash=$1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at>now() RETURNING id",
      [hash(token)],
    );
    if (!invite.rowCount) {
      await client.query("ROLLBACK");
      res
        .status(400)
        .json({ message: "Invite expired, revoked or already used." });
      return;
    }
    await client.query(
      "INSERT INTO users(email,name,password_hash,role) VALUES($1,$2,$3,'laptop_watch')",
      [
        email.trim().toLowerCase(),
        name.trim(),
        await bcrypt.hash(password, 12),
      ],
    );
    await client.query("COMMIT");
    res.status(201).json({ success: true });
  } catch {
    await client.query("ROLLBACK");
    res
      .status(400)
      .json({
        message:
          "Unable to create account. Use a different email or contact the owner.",
      });
  } finally {
    client.release();
  }
});
router.use(requireRole("admin", "laptop_watch"));
router.use(async (req, res, next) => {
  const {
    rows: [user],
  } = await pool.query("SELECT is_active,role FROM users WHERE id=$1", [
    req.session.userId,
  ]);
  if (!user?.is_active || !["admin", "laptop_watch"].includes(user.role)) {
    res.sendStatus(403);
    return;
  }
  req.session.userRole = user.role;
  next();
});
router.get("/", async (req, res) =>
  res.json(await snapshot(req.session.userId!)),
);
router.get("/listings/:id/history", async (req, res) => {
  if (!catalog.some((x) => x.id === req.params.id)) {
    res.sendStatus(404);
    return;
  }
  const offset = Number(req.query.offset ?? 0);
  if (!Number.isSafeInteger(offset) || offset < 0) {
    res.sendStatus(400);
    return;
  }
  res.json(
    (
      await pool.query(
        "SELECT * FROM lw_observations WHERE listing=$1 ORDER BY checked_at DESC,id DESC LIMIT 100 OFFSET $2",
        [req.params.id, offset],
      )
    ).rows,
  );
});
router.put("/follows/:id", async (req, res) => {
  const b = req.body ?? {};
  if (
    !catalog.some((x) => x.id === req.params.id) ||
    !(
      b.target_cents === null ||
      (Number.isInteger(b.target_cents) &&
        b.target_cents >= 10000 &&
        b.target_cents <= 2000000)
    ) ||
    !Number.isInteger(b.drop_percent) ||
    b.drop_percent < 1 ||
    b.drop_percent > 100 ||
    ![
      "target_alert",
      "drop_alert",
      "low_alert",
      "restock_alert",
      "push_enabled",
    ].every((k) => typeof b[k] === "boolean")
  ) {
    res.status(400).json({ message: "Invalid follow preferences." });
    return;
  }
  await pool.query(
    `INSERT INTO lw_follows(user_id,listing,target_cents,drop_percent,target_alert,drop_alert,low_alert,restock_alert,push_enabled) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(user_id,listing) DO UPDATE SET target_cents=excluded.target_cents,drop_percent=excluded.drop_percent,target_alert=excluded.target_alert,drop_alert=excluded.drop_alert,low_alert=excluded.low_alert,restock_alert=excluded.restock_alert,push_enabled=excluded.push_enabled`,
    [
      req.session.userId,
      req.params.id,
      b.target_cents,
      b.drop_percent,
      b.target_alert,
      b.drop_alert,
      b.low_alert,
      b.restock_alert,
      b.push_enabled,
    ],
  );
  res.json({ success: true });
});
router.delete("/follows/:id", async (req, res) => {
  await pool.query("DELETE FROM lw_follows WHERE user_id=$1 AND listing=$2", [
    req.session.userId,
    req.params.id,
  ]);
  res.json({ success: true });
});
router.get("/invites", requireAdmin, async (req, res) =>
  res.json(
    (
      await pool.query(
        "SELECT id,expires_at,used_at,revoked_at FROM lw_invites WHERE created_by=$1 ORDER BY id DESC LIMIT 100",
        [req.session.userId],
      )
    ).rows,
  ),
);
router.post("/invites", requireAdmin, async (req, res) => {
  const token = randomBytes(32).toString("hex");
  const {
    rows: [invite],
  } = await pool.query(
    "INSERT INTO lw_invites(token_hash,created_by,expires_at) VALUES($1,$2,now()+interval '48 hours') RETURNING id,expires_at",
    [hash(token), req.session.userId],
  );
  res.status(201).json({ ...invite, path: `/laptop-watch/invite#${token}` });
});
router.delete("/invites/:id", requireAdmin, async (req, res) => {
  await pool.query(
    "UPDATE lw_invites SET revoked_at=now() WHERE id=$1 AND created_by=$2 AND used_at IS NULL",
    [req.params.id, req.session.userId],
  );
  res.json({ success: true });
});
router.get("/push-key", (_req, res) =>
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY ?? null }),
);
router.post("/subscriptions", async (req, res) => {
  if (!validateSubscription(req.body)) {
    res
      .status(400)
      .json({ message: "Invalid or unsupported push subscription." });
    return;
  }
  const { endpoint, keys } = req.body;
  const result = await pool.query(
    "INSERT INTO lw_subscriptions(user_id,endpoint,keys) VALUES($1,$2,$3) ON CONFLICT(endpoint) DO UPDATE SET keys=excluded.keys WHERE lw_subscriptions.user_id=excluded.user_id RETURNING id",
    [req.session.userId, endpoint, JSON.stringify(keys)],
  );
  if (!result.rowCount) {
    res
      .status(409)
      .json({
        message:
          "This device is linked to another account. Disable notifications there first.",
      });
    return;
  }
  res.json({ success: true });
});
router.delete("/subscriptions", async (req, res) => {
  await pool.query(
    "DELETE FROM lw_subscriptions WHERE user_id=$1 AND endpoint=$2",
    [req.session.userId, req.body?.endpoint],
  );
  res.json({ success: true });
});
router.post("/test-push", async (req, res) => {
  if (
    !process.env.VAPID_PRIVATE_KEY ||
    !process.env.VAPID_PUBLIC_KEY ||
    !process.env.VAPID_SUBJECT
  ) {
    res.status(503).json({ message: "Push secrets are not configured." });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
      req.session.userId,
    ]);
    const recent = await client.query(
      "SELECT id FROM lw_alerts WHERE user_id=$1 AND listing IS NULL AND created_at>now()-interval '1 minute'",
      [req.session.userId],
    );
    if (recent.rowCount) {
      await client.query("ROLLBACK");
      res.status(429).json({ message: "Wait one minute before another test." });
      return;
    }
    const devices = await client.query(
      "SELECT id FROM lw_subscriptions WHERE user_id=$1",
      [req.session.userId],
    );
    if (!devices.rowCount) {
      await client.query("ROLLBACK");
      res
        .status(400)
        .json({ message: "Enable notifications on this phone first." });
      return;
    }
    const message =
      "Test notification — confirm receipt on your phone. This is not a deal.";
    const {
      rows: [alert],
    } = await client.query(
      "INSERT INTO lw_alerts(user_id,message) VALUES($1,$2) RETURNING id",
      [req.session.userId, message],
    );
    await client.query(
      "INSERT INTO notifications(user_id,type,message) VALUES($1,'laptop_watch',$2)",
      [req.session.userId, message],
    );
    await client.query(
      "INSERT INTO lw_deliveries(alert_id,subscription_id) SELECT $1,id FROM lw_subscriptions WHERE user_id=$2",
      [alert.id, req.session.userId],
    );
    await client.query("COMMIT");
    await deliverPending();
    res.json({
      success: true,
      message:
        "Test queued. Provider acceptance does not confirm phone delivery.",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});
export default router;
