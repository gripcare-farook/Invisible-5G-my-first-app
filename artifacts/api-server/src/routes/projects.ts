import { Router, type IRouter } from "express";
import { db, projectsTable, PROJECT_STATUSES, PROJECT_STATUS_LABELS } from "@workspace/db";
import { eq, desc, or } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { logActivity } from "../lib/activity";
import { logger } from "../lib/logger";
import { ensureDatabaseSchema } from "../lib/schema";

const router: IRouter = Router();

function cleanMobile(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

router.get("/projects", requireAuth, async (req, res) => {
  const role = req.session.userRole;
  let rows;
  if (role === "admin") {
    rows = await db.select().from(projectsTable).orderBy(desc(projectsTable.updatedAt));
  } else {
    rows = await db
      .select()
      .from(projectsTable)
      .where(or(eq(projectsTable.status, "assigned"), eq(projectsTable.status, "in_progress")))
      .orderBy(desc(projectsTable.updatedAt));
  }
  res.json({ success: true, projects: rows });
});

router.post("/projects", requireAdmin, async (req, res) => {
  const { name, clientName = "", clientMobile = "", siteLocation = "", notes = "", status = "new" } = req.body as {
    name?: string;
    clientName?: string;
    clientMobile?: string;
    siteLocation?: string;
    notes?: string;
    status?: string;
  };
  if (!name?.trim()) {
    res.status(400).json({ success: false, error: "name is required" });
    return;
  }
  if (!PROJECT_STATUSES.includes(status as any)) {
    res.status(400).json({ success: false, error: "invalid status" });
    return;
  }
  const mobile = cleanMobile(clientMobile);
  if (mobile && mobile.length !== 10) {
    res.status(400).json({ success: false, error: "Client mobile number must be 10 digits." });
    return;
  }

  try {
    await ensureDatabaseSchema();
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 7);
    const [project] = await db
      .insert(projectsTable)
      .values({
        id,
        name: name.trim(),
        clientName: clientName.trim(),
        clientMobile: mobile,
        siteLocation: siteLocation.trim(),
        notes: notes.trim(),
        status: status as any,
      })
      .returning();

    void logActivity(db, {
      actorId: req.session.userId!,
      actorName: req.session.userName!,
      actorRole: req.session.userRole!,
      action: "project.created",
      projectId: id,
      message: `${req.session.userName} created project "${name.trim()}"`,
    });

    res.json({ success: true, project });
  } catch (err) {
    logger.error({ err }, "project: create failed");
    res.status(500).json({ success: false, error: "Unable to save project. Please check the project details and try again." });
  }
});

router.patch("/projects/:id", requireAdmin, async (req, res) => {
  const id = String(req.params["id"]);
  const { status, name, clientName, clientMobile, siteLocation, notes } = req.body as {
    status?: string;
    name?: string;
    clientName?: string;
    clientMobile?: string;
    siteLocation?: string;
    notes?: string;
  };

  if (status !== undefined && !PROJECT_STATUSES.includes(status as any)) {
    res.status(400).json({ success: false, error: "invalid status" });
    return;
  }
  if (clientMobile !== undefined) {
    const mobile = cleanMobile(clientMobile);
    if (mobile && mobile.length !== 10) {
      res.status(400).json({ success: false, error: "Client mobile number must be 10 digits." });
      return;
    }
  }

  const patch: Partial<typeof projectsTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (status !== undefined) patch.status = status as any;
  if (name !== undefined) patch.name = name.trim();
  if (clientName !== undefined) patch.clientName = clientName.trim();
  if (clientMobile !== undefined) patch.clientMobile = cleanMobile(clientMobile);
  if (siteLocation !== undefined) patch.siteLocation = siteLocation.trim();
  if (notes !== undefined) patch.notes = notes.trim();

  const [updated] = await db
    .update(projectsTable)
    .set(patch)
    .where(eq(projectsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ success: false, error: "project not found" });
    return;
  }

  if (status !== undefined) {
    const label = PROJECT_STATUS_LABELS[status as keyof typeof PROJECT_STATUS_LABELS] ?? status;
    void logActivity(db, {
      actorId: req.session.userId!,
      actorName: req.session.userName!,
      actorRole: req.session.userRole!,
      action: "project.status_changed",
      projectId: id,
      message: `${req.session.userName} changed "${updated.name}" status to ${label}`,
    });
  }

  res.json({ success: true, project: updated });
});

router.delete("/projects/:id", requireAdmin, async (req, res) => {
  const id = String(req.params["id"]);
  const [existing] = await db.select({ name: projectsTable.name }).from(projectsTable).where(eq(projectsTable.id, id)).limit(1);
  await db.delete(projectsTable).where(eq(projectsTable.id, id));

  if (existing) {
    void logActivity(db, {
      actorId: req.session.userId!,
      actorName: req.session.userName!,
      actorRole: req.session.userRole!,
      action: "project.deleted",
      projectId: id,
      message: `${req.session.userName} deleted project "${existing.name}"`,
    });
  }

  res.json({ success: true });
});

export default router;
