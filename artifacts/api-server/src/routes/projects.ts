import { Router, type IRouter } from "express";
import { db, projectsTable, PROJECT_STATUSES } from "@workspace/db";
import { eq, desc, or } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

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
  const { name, clientName = "", siteLocation = "", notes = "", status = "new" } = req.body as {
    name?: string;
    clientName?: string;
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
  const id = Date.now().toString() + Math.random().toString(36).slice(2, 7);
  const [project] = await db
    .insert(projectsTable)
    .values({ id, name: name.trim(), clientName, siteLocation, notes, status: status as any })
    .returning();
  res.json({ success: true, project });
});

router.patch("/projects/:id", requireAdmin, async (req, res) => {
  const id = String(req.params["id"]);
  const { status, name, clientName, siteLocation, notes } = req.body as {
    status?: string;
    name?: string;
    clientName?: string;
    siteLocation?: string;
    notes?: string;
  };

  if (status !== undefined && !PROJECT_STATUSES.includes(status as any)) {
    res.status(400).json({ success: false, error: "invalid status" });
    return;
  }

  const patch: Partial<typeof projectsTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (status !== undefined) patch.status = status as any;
  if (name !== undefined) patch.name = name.trim();
  if (clientName !== undefined) patch.clientName = clientName;
  if (siteLocation !== undefined) patch.siteLocation = siteLocation;
  if (notes !== undefined) patch.notes = notes;

  const [updated] = await db
    .update(projectsTable)
    .set(patch)
    .where(eq(projectsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ success: false, error: "project not found" });
    return;
  }
  res.json({ success: true, project: updated });
});

router.delete("/projects/:id", requireAdmin, async (req, res) => {
  const id = String(req.params["id"]);
  await db.delete(projectsTable).where(eq(projectsTable.id, id));
  res.json({ success: true });
});

export default router;
