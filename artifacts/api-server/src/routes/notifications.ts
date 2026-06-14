import { Router, type IRouter } from "express";
import { db, notificationsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/notifications", requireAuth, async (req, res) => {
  const notes = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, req.session.userId!))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);
  res.json({ success: true, notifications: notes });
});

router.patch("/notifications/:id/read", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) {
    res.status(400).json({ success: false, message: "Invalid ID." });
    return;
  }
  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(
      and(
        eq(notificationsTable.id, id),
        eq(notificationsTable.userId, req.session.userId!),
      ),
    );
  res.json({ success: true });
});

router.post("/notifications/read-all", requireAuth, async (req, res) => {
  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.userId, req.session.userId!));
  res.json({ success: true });
});

export default router;
