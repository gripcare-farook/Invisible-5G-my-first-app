import { Router, type IRouter } from "express";
import { db, leadFollowupsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/leads", requireAdmin, async (_req, res) => {
  const leads = await db
    .select()
    .from(leadFollowupsTable)
    .orderBy(desc(leadFollowupsTable.createdAt));
  res.json({ success: true, leads });
});

router.post("/leads", requireAdmin, async (req, res) => {
  const body = req.body as {
    name?: string;
    phone?: string;
    location?: string;
    requirement?: string;
    source?: string;
    followUpDate?: string;
    status?: "new" | "contacted" | "interested" | "not_interested" | "converted" | "lost";
    notes?: string;
    nextAction?: string;
  };

  if (!body.name?.trim()) {
    res.status(400).json({ success: false, message: "Name is required." });
    return;
  }

  const [lead] = await db
    .insert(leadFollowupsTable)
    .values({
      name: body.name.trim(),
      phone: body.phone ?? "",
      location: body.location ?? "",
      requirement: body.requirement ?? "",
      source: body.source ?? "",
      followUpDate: body.followUpDate ?? null,
      status: body.status ?? "new",
      notes: body.notes ?? "",
      nextAction: body.nextAction ?? "",
      createdBy: req.session.userId,
    })
    .returning();

  logger.info({ leadId: lead!.id }, "lead: created");
  res.json({ success: true, lead });
});

router.patch("/leads/:id", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) {
    res.status(400).json({ success: false, message: "Invalid ID." });
    return;
  }

  const body = req.body as Partial<{
    name: string;
    phone: string;
    location: string;
    requirement: string;
    source: string;
    followUpDate: string;
    status: "new" | "contacted" | "interested" | "not_interested" | "converted" | "lost";
    notes: string;
    nextAction: string;
  }>;

  const allowed = ["name", "phone", "location", "requirement", "source", "followUpDate", "status", "notes", "nextAction"] as const;
  const update: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  const [updated] = await db
    .update(leadFollowupsTable)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .set(update as any)
    .where(eq(leadFollowupsTable.id, id))
    .returning();

  res.json({ success: true, lead: updated });
});

router.delete("/leads/:id", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) {
    res.status(400).json({ success: false, message: "Invalid ID." });
    return;
  }
  await db.delete(leadFollowupsTable).where(eq(leadFollowupsTable.id, id));
  res.json({ success: true });
});

export default router;
