import { Router, type IRouter } from "express";
import { db, activityLogTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/activity", requireAdmin, async (_req, res) => {
  const rows = await db
    .select()
    .from(activityLogTable)
    .orderBy(desc(activityLogTable.createdAt))
    .limit(20);
  res.json({ success: true, logs: rows });
});

export default router;
