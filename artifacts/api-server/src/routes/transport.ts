import { Router, type IRouter } from "express";
import { db, transportRoutesTable, transportDeliveriesTable, transportLedgerTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";
import { requireAdmin, requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/transport/drivers", requireAdmin, async (_req, res) => {
  const drivers = await db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
    .from(usersTable)
    .where(and(eq(usersTable.role, "transport"), eq(usersTable.isActive, true)));
  res.json({ success: true, drivers });
});

router.post("/transport/sync", requireAdmin, async (req, res) => {
  const { projectId, projectName, clientName, siteLocation, transport, result } = req.body as {
    projectId: string;
    projectName: string;
    clientName?: string;
    siteLocation?: string;
    transport: {
      routeId: string;
      startLocation: string;
      stops: { id: string; locationName: string; customerName: string; contactNumber: string; perStopToll: number }[];
      returnToGodown: boolean;
      totalKm: number;
      ratePerKm: number;
      minimumCharge: number;
      commonToll: number;
      loadingCharge: number;
      waitingCharge: number;
      advancePaid: number;
      assignedDriverId: number | null;
    };
    result: { kmCost: number; stopTollTotal: number; totalToll: number; totalCost: number; balancePayable: number };
  };

  if (!projectId || !transport?.routeId) {
    res.status(400).json({ success: false, message: "projectId and transport.routeId are required." });
    return;
  }

  try {
    const existing = await db.select({ id: transportRoutesTable.id }).from(transportRoutesTable).where(eq(transportRoutesTable.id, transport.routeId)).limit(1);

    const routeValues = {
      projectId,
      projectName,
      clientName: clientName ?? "",
      siteLocation: siteLocation ?? "",
      startLocation: transport.startLocation,
      returnToGodown: transport.returnToGodown,
      totalKmEstimated: String(transport.totalKm),
      ratePerKm: String(transport.ratePerKm),
      minimumCharge: String(transport.minimumCharge),
      commonToll: String(transport.commonToll),
      loadingCharge: String(transport.loadingCharge),
      waitingCharge: String(transport.waitingCharge),
      advancePaid: String(transport.advancePaid),
      calculatedCost: String(result.totalCost),
      balancePayable: String(result.balancePayable),
      assignedDriverId: transport.assignedDriverId ?? null,
      updatedAt: new Date(),
    };

    if (existing.length > 0) {
      await db.update(transportRoutesTable).set(routeValues).where(eq(transportRoutesTable.id, transport.routeId));
      await db.delete(transportDeliveriesTable).where(eq(transportDeliveriesTable.routeId, transport.routeId));
    } else {
      await db.insert(transportRoutesTable).values({ id: transport.routeId, ...routeValues });
    }

    for (const [i, stop] of transport.stops.entries()) {
      await db.insert(transportDeliveriesTable).values({
        id: stop.id,
        routeId: transport.routeId,
        projectId,
        stopOrder: i + 1,
        locationName: stop.locationName,
        customerName: stop.customerName,
        contactNumber: stop.contactNumber,
        perStopToll: String(stop.perStopToll),
      });
    }

    const ledgerValues = {
      projectId,
      totalCost: String(result.totalCost),
      advancePaid: String(transport.advancePaid),
      balancePayable: String(result.balancePayable),
      updatedAt: new Date(),
    };

    const existingLedger = await db.select({ id: transportLedgerTable.id }).from(transportLedgerTable).where(eq(transportLedgerTable.routeId, transport.routeId)).limit(1);
    if (existingLedger.length > 0) {
      await db.update(transportLedgerTable).set(ledgerValues).where(eq(transportLedgerTable.routeId, transport.routeId));
    } else {
      await db.insert(transportLedgerTable).values({ id: "led_" + transport.routeId, routeId: transport.routeId, ...ledgerValues });
    }

    logger.info({ routeId: transport.routeId, projectId }, "transport/sync: complete");
    res.json({ success: true, message: "Transport saved." });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "transport/sync: error");
    res.status(500).json({ success: false, message: `Transport sync failed: ${msg}` });
  }
});

router.get("/transport/my-routes", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const userRole = req.session.userRole!;

  let routes;
  if (userRole === "admin") {
    routes = await db.select().from(transportRoutesTable).orderBy(transportRoutesTable.createdAt);
  } else {
    routes = await db.select().from(transportRoutesTable).where(eq(transportRoutesTable.assignedDriverId, userId)).orderBy(transportRoutesTable.createdAt);
  }

  const routeIds = routes.map((r) => r.id);
  const allDeliveries = routeIds.length > 0
    ? await db.select().from(transportDeliveriesTable).where(
        routeIds.length === 1
          ? eq(transportDeliveriesTable.routeId, routeIds[0]!)
          : eq(transportDeliveriesTable.routeId, routeIds[0]!) // will be fixed below
      )
    : [];

  const deliveriesByRoute: Record<string, typeof allDeliveries> = {};
  for (const d of allDeliveries) {
    if (!deliveriesByRoute[d.routeId]) deliveriesByRoute[d.routeId] = [];
    deliveriesByRoute[d.routeId]!.push(d);
  }

  if (routeIds.length > 1) {
    const allDels = await db.select().from(transportDeliveriesTable);
    for (const d of allDels) {
      if (routeIds.includes(d.routeId)) {
        if (!deliveriesByRoute[d.routeId]) deliveriesByRoute[d.routeId] = [];
        if (!deliveriesByRoute[d.routeId]!.find((x) => x.id === d.id)) {
          deliveriesByRoute[d.routeId]!.push(d);
        }
      }
    }
  }

  const result = routes.map((r) => ({
    ...r,
    deliveries: (deliveriesByRoute[r.id] ?? []).sort((a, b) => a.stopOrder - b.stopOrder),
  }));

  res.json({ success: true, routes: result });
});

router.patch("/transport/deliveries/:id/status", requireAuth, async (req, res) => {
  const id = String(req.params["id"]);
  const { status, notes, failureReason } = req.body as { status: string; notes?: string; failureReason?: string };
  const userId = req.session.userId!;
  const userRole = req.session.userRole!;

  const delivery = await db.select().from(transportDeliveriesTable).where(eq(transportDeliveriesTable.id, id)).limit(1);
  if (!delivery.length) {
    res.status(404).json({ success: false, message: "Delivery not found." });
    return;
  }

  if (userRole === "transport") {
    const route = await db.select({ assignedDriverId: transportRoutesTable.assignedDriverId }).from(transportRoutesTable).where(eq(transportRoutesTable.id, delivery[0]!.routeId)).limit(1);
    if (!route.length || route[0]!.assignedDriverId !== userId) {
      res.status(403).json({ success: false, message: "Not authorized for this route." });
      return;
    }
  }

  if (!["pending", "delivered", "failed"].includes(status)) {
    res.status(400).json({ success: false, message: "Invalid status." });
    return;
  }

  await db.update(transportDeliveriesTable).set({
    status: status as "pending" | "delivered" | "failed",
    deliveryNotes: notes ?? null,
    failureReason: failureReason ?? null,
    deliveredAt: status === "delivered" ? new Date() : null,
    updatedAt: new Date(),
  }).where(eq(transportDeliveriesTable.id, id));

  logger.info({ deliveryId: id, status, userId }, "transport: delivery status updated");
  res.json({ success: true });
});

router.post("/transport/routes/:id/complete", requireAuth, async (req, res) => {
  const id = String(req.params["id"]);
  const { actualKm, actualToll, completionNotes } = req.body as { actualKm: number; actualToll?: number; completionNotes?: string };
  const userId = req.session.userId!;
  const userRole = req.session.userRole!;

  const route = await db.select().from(transportRoutesTable).where(eq(transportRoutesTable.id, id)).limit(1);
  if (!route.length) {
    res.status(404).json({ success: false, message: "Route not found." });
    return;
  }

  if (userRole === "transport" && route[0]!.assignedDriverId !== userId) {
    res.status(403).json({ success: false, message: "Not authorized for this route." });
    return;
  }

  const r = route[0]!;
  const ratePerKm = parseFloat(String(r.ratePerKm));
  const minimumCharge = parseFloat(String(r.minimumCharge));
  const kmCost = Math.max((actualKm ?? 0) * ratePerKm, minimumCharge);
  const totalToll = (actualToll ?? 0) + parseFloat(String(r.commonToll));
  const newCost = kmCost + totalToll + parseFloat(String(r.loadingCharge)) + parseFloat(String(r.waitingCharge));
  const newBalance = newCost - parseFloat(String(r.advancePaid));

  await db.update(transportRoutesTable).set({
    status: "completed",
    totalKmActual: String(actualKm ?? 0),
    actualToll: String(actualToll ?? 0),
    calculatedCost: String(newCost),
    balancePayable: String(newBalance),
    completedAt: new Date(),
    completionNotes: completionNotes ?? null,
    updatedAt: new Date(),
  }).where(eq(transportRoutesTable.id, id));

  await db.update(transportLedgerTable).set({
    totalCost: String(newCost),
    balancePayable: String(newBalance),
    updatedAt: new Date(),
  }).where(eq(transportLedgerTable.routeId, id));

  logger.info({ routeId: id, actualKm, userId }, "transport: route completed");
  res.json({ success: true, message: "Route marked as completed." });
});

router.patch("/transport/ledger/:routeId/paid", requireAdmin, async (req, res) => {
  const routeId = String(req.params["routeId"]);
  const { paymentNotes } = req.body as { paymentNotes?: string };

  await db.update(transportLedgerTable).set({
    isPaid: true,
    paidAt: new Date(),
    paymentNotes: paymentNotes ?? null,
    updatedAt: new Date(),
  }).where(eq(transportLedgerTable.routeId, routeId));

  logger.info({ routeId }, "transport: ledger marked paid");
  res.json({ success: true });
});

export default router;
