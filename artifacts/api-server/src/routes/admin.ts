import { Router, type IRouter } from "express";
import { db, usersTable, transportRoutesTable, leadFollowupsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/admin/stats", requireAdmin, async (_req, res) => {
  const [routeStats, leadStats, userStats] = await Promise.all([
    db.select({ status: transportRoutesTable.status, total: count() })
      .from(transportRoutesTable)
      .groupBy(transportRoutesTable.status),
    db.select({ status: leadFollowupsTable.status, total: count() })
      .from(leadFollowupsTable)
      .groupBy(leadFollowupsTable.status),
    db.select({ role: usersTable.role, total: count() })
      .from(usersTable)
      .where(eq(usersTable.isActive, true))
      .groupBy(usersTable.role),
  ]);

  const totalRoutes = routeStats.reduce((s, r) => s + Number(r.total), 0);
  const completedRoutes = Number(routeStats.find((r) => r.status === "completed")?.total ?? 0);
  const pendingRoutes = routeStats
    .filter((r) => r.status === "pending" || r.status === "in_progress")
    .reduce((s, r) => s + Number(r.total), 0);

  const totalLeads = leadStats.reduce((s, r) => s + Number(r.total), 0);
  const openLeads = leadStats
    .filter((r) => r.status === "new" || r.status === "contacted" || r.status === "interested")
    .reduce((s, r) => s + Number(r.total), 0);
  const convertedLeads = Number(leadStats.find((r) => r.status === "converted")?.total ?? 0);

  res.json({
    success: true,
    stats: {
      transport: { total: totalRoutes, completed: completedRoutes, pending: pendingRoutes },
      leads: { total: totalLeads, open: openLeads, converted: convertedLeads },
      users: userStats.map((u) => ({ role: u.role, count: Number(u.total) })),
    },
  });
});

export default router;
