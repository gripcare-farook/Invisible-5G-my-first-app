import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import express from "express";
import { testDb, pool } from "./laptop-test-db.mjs";
import router from "../artifacts/api-server/src/laptop-watch/routes.ts";
import { laptopBoundary } from "../artifacts/api-server/src/laptop-watch/access.ts";
import {
  seedCatalog,
  recordObservation,
  snapshot,
} from "../artifacts/api-server/src/laptop-watch/store.ts";
import {
  deliveryOutcome,
  validateSubscription,
  deliverPending,
} from "../artifacts/api-server/src/laptop-watch/push.ts";
import { retrieve } from "../artifacts/api-server/src/laptop-watch/worker.ts";
import { importHistory } from "../scripts/laptop-history.mjs";
let server, origin;
before(async () => {
  await testDb.exec(
    `CREATE TABLE users(id serial PRIMARY KEY,email text UNIQUE NOT NULL,name text NOT NULL,password_hash text NOT NULL,role text NOT NULL,is_active boolean DEFAULT true); CREATE TABLE notifications(id serial PRIMARY KEY,user_id integer REFERENCES users(id),type text,project_id text,message text);`,
  );
  await testDb.exec(
    await readFile("lib/db/migrations/0001_laptop_watch.sql", "utf8"),
  );
  await seedCatalog();
  await pool.query(
    "INSERT INTO users(email,name,password_hash,role) VALUES('owner@test.local','Owner','unused','admin'),('friend@test.local','Friend','unused','laptop_watch'),('other@test.local','Other','unused','laptop_watch')",
  );
  const app = express();
  app.use(express.json());
  // Test-only identity injection. Production uses signed, PostgreSQL-backed sessions.
  app.use((req, _res, next) => {
    const id = Number(req.get("x-user"));
    req.session = id
      ? { userId: id, userRole: id === 1 ? "admin" : "laptop_watch" }
      : {};
    next();
  });
  app.use(laptopBoundary);
  app.use("/laptop-watch", router);
  app.get("/projects", (_req, res) => res.json({ business: true }));
  app.use((_err, _req, res, _next) =>
    res.status(500).json({ message: "Failed" }),
  );
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  origin = `http://127.0.0.1:${server.address().port}`;
  process.env.APP_ORIGIN = origin;
});
after(async () => {
  await new Promise((r) => server.close(r));
  await testDb.close();
});
async function request(path, method = "GET", body, user = 1, source = origin) {
  return fetch(origin + path, {
    method,
    headers: {
      "x-user": String(user),
      "Content-Type": "application/json",
      Origin: source,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
test("migration is repeatable and catalog contains exactly nine listings", async () => {
  await testDb.exec(
    await readFile("lib/db/migrations/0001_laptop_watch.sql", "utf8"),
  );
  assert.equal((await snapshot(1)).listings.length, 9);
});
test("anonymous, friend business access and cross-origin writes are denied", async () => {
  assert.equal((await request("/laptop-watch", "GET", null, 0)).status, 401);
  assert.equal((await request("/projects", "GET", null, 2)).status, 403);
  assert.equal(
    (await request("/laptop-watch/invites", "POST", {}, 2)).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/laptop-watch/invites",
        "POST",
        {},
        1,
        "https://evil.example",
      )
    ).status,
    403,
  );
});
test("invite is single-use, expired and revoked invites fail, friends cannot create admins", async () => {
  const invite = await (await request("/laptop-watch/invites", "POST")).json();
  const body = {
    token: invite.path.split("#")[1],
    email: "new@test.local",
    name: "New",
    password: "long-test-password",
    role: "admin",
  };
  assert.equal(
    (await request("/laptop-watch/accept-invite", "POST", body, 0)).status,
    201,
  );
  assert.equal(
    (await pool.query("SELECT role FROM users WHERE email='new@test.local'"))
      .rows[0].role,
    "laptop_watch",
  );
  assert.equal(
    (
      await request(
        "/laptop-watch/accept-invite",
        "POST",
        { ...body, email: "again@test.local" },
        0,
      )
    ).status,
    400,
  );
  for (const state of ["expired", "revoked"]) {
    const i = await (await request("/laptop-watch/invites", "POST")).json();
    if (state === "expired")
      await pool.query(
        "UPDATE lw_invites SET expires_at=now()-interval '1 second' WHERE id=$1",
        [i.id],
      );
    else await request(`/laptop-watch/invites/${i.id}`, "DELETE");
    assert.equal(
      (
        await request(
          "/laptop-watch/accept-invite",
          "POST",
          { ...body, token: i.path.split("#")[1] },
          0,
        )
      ).status,
      400,
    );
  }
});
test("targets are account isolated; observation/alert/inbox inserts are atomic and deduplicated", async () => {
  const preferences = {
    target_cents: 240000,
    drop_percent: 3,
    target_alert: true,
    drop_alert: true,
    low_alert: true,
    restock_alert: true,
    push_enabled: true,
    user_id: 3,
  };
  assert.equal(
    (await request("/laptop-watch/follows/msi", "PUT", preferences, 2)).status,
    200,
  );
  assert.equal(
    (await snapshot(3)).listings.find((x) => x.id === "msi").follow,
    null,
  );
  const offer = {
    price_cents: 250000,
    stock: "in_stock",
    seller: "MSI US",
    condition: "new",
  };
  await recordObservation("msi", offer, "baseline", new Date("2026-01-01"));
  assert.equal((await pool.query("SELECT * FROM lw_alerts")).rows.length, 0);
  await recordObservation(
    "msi",
    { ...offer, price_cents: 230000 },
    "drop",
    new Date("2026-01-02"),
  );
  await recordObservation(
    "msi",
    { ...offer, price_cents: 230000 },
    "drop",
    new Date("2026-01-03"),
  );
  await recordObservation(
    "msi",
    { ...offer, price_cents: 230000 },
    "unchanged",
    new Date("2026-01-04"),
  );
  assert.equal((await pool.query("SELECT * FROM lw_alerts")).rows.length, 1);
  assert.equal(
    (await pool.query("SELECT * FROM notifications")).rows.length,
    1,
  );
  await pool.query(
    "INSERT INTO lw_checks(listing,status,message) VALUES('msi','error','blocked')",
  );
  const item = (await snapshot(2)).listings.find((x) => x.id === "msi");
  assert.equal(item.latest.price_cents, 230000);
  assert.equal(item.last_check.status, "error");
});
test("subscription ownership and SSRF rejection", async () => {
  const subscription = {
    endpoint: "https://fcm.googleapis.com/fcm/send/test",
    keys: { p256dh: "a".repeat(87), auth: "b".repeat(22) },
  };
  assert.equal(
    validateSubscription({
      ...subscription,
      endpoint: "http://127.0.0.1/private",
    }),
    false,
  );
  assert.equal(
    (await request("/laptop-watch/subscriptions", "POST", subscription, 2))
      .status,
    200,
  );
  assert.equal(
    (await request("/laptop-watch/subscriptions", "POST", subscription, 3))
      .status,
    409,
  );
  await request(
    "/laptop-watch/subscriptions",
    "DELETE",
    { endpoint: subscription.endpoint },
    3,
  );
  assert.equal(
    (await pool.query("SELECT * FROM lw_subscriptions")).rows.length,
    1,
  );
});
test("push outcomes have bounded retries and expired subscriptions are removed", async () => {
  assert.equal(deliveryOutcome(201, 1), "accepted");
  assert.equal(deliveryOutcome(429, 1), "retry");
  assert.equal(deliveryOutcome(500, 3), "failed");
  assert.equal(deliveryOutcome(410, 1), "expired");
  process.env.VAPID_PUBLIC_KEY = "test";
  process.env.VAPID_PRIVATE_KEY = "test";
  process.env.VAPID_SUBJECT = "mailto:test@example.com";
  await pool.query(
    "INSERT INTO lw_deliveries(alert_id,subscription_id) SELECT a.id,s.id FROM lw_alerts a JOIN lw_subscriptions s ON a.user_id=s.user_id",
  );
  await deliverPending(async () => {
    throw { statusCode: 503 };
  });
  assert.equal(
    (await pool.query("SELECT status FROM lw_deliveries")).rows[0].status,
    "retry",
  );
  await pool.query(
    "UPDATE lw_deliveries SET next_attempt_at=now()-interval '1 minute'",
  );
  await deliverPending(async () => {
    throw { statusCode: 410 };
  });
  assert.equal(
    (await pool.query("SELECT * FROM lw_subscriptions")).rows.length,
    0,
  );
});
test("retailer retrieval retries transient errors but rejects permanent failures", async () => {
  process.env.FIRECRAWL_API_KEY = "test-only";
  let calls = 0;
  assert.equal(
    await retrieve("https://example.com", async () => {
      calls++;
      return calls === 1
        ? new Response("", { status: 503 })
        : Response.json({ success: true, data: { markdown: "verified" } });
    }),
    "verified",
  );
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(() =>
    retrieve("https://example.com", async () => {
      calls++;
      return new Response("", { status: 403 });
    }),
  );
  assert.equal(calls, 1);
});
test("PC history import is idempotent, never creates alerts and preserves newer verified observations", async () => {
  const catalog = JSON.parse(
    await readFile(
      "artifacts/api-server/src/laptop-watch/catalog.json",
      "utf8",
    ),
  );
  const rows = [
    {
      listing: "msi",
      price_cents: 260000,
      stock: "in_stock",
      seller: "MSI US",
      condition: "new",
      checked_at: "2025-01-01T00:00:00Z",
    },
  ];
  const alerts = (await pool.query("SELECT * FROM lw_alerts")).rows.length;
  assert.equal(await importHistory(pool, rows, catalog), 1);
  assert.equal(await importHistory(pool, rows, catalog), 0);
  assert.equal(
    (await snapshot(2)).listings.find((x) => x.id === "msi").latest.price_cents,
    230000,
  );
  assert.equal(
    (await pool.query("SELECT * FROM lw_alerts")).rows.length,
    alerts,
  );
  await assert.rejects(() =>
    importHistory(pool, [{ ...rows[0], price_cents: 2 }], catalog),
  );
});
