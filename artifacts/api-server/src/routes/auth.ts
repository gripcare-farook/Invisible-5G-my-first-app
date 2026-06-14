import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ success: false, message: "Email and password are required." });
      return;
    }

    const users = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);

    if (users.length === 0) {
      res.status(401).json({ success: false, message: "Invalid email or password." });
      return;
    }

    const user = users[0]!;

    if (!user.isActive) {
      res.status(401).json({ success: false, message: "Account is disabled." });
      return;
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      res.status(401).json({ success: false, message: "Invalid email or password." });
      return;
    }

    req.session.userId = user.id;
    req.session.userRole = user.role as "admin" | "transport" | "labour_contractor" | "labour_worker";
    req.session.userName = user.name;

    logger.info({ userId: user.id, role: user.role }, "auth: login");
    res.json({ success: true, user: { id: user.id, name: user.name, role: user.role } });
  } catch (err) {
    logger.error({ err }, "auth: login error");
    res.status(500).json({ success: false, message: "Unable to log in. Please try again." });
  }
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      logger.error({ err }, "auth: session destroy error");
    }
  });
  res.json({ success: true });
});

router.get("/auth/me", (req, res) => {
  if (!req.session?.userId) {
    res.json({ authenticated: false, user: null });
    return;
  }
  res.json({
    authenticated: true,
    user: { id: req.session.userId, name: req.session.userName, role: req.session.userRole },
  });
});

export default router;
