import { pgTable, text, boolean, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const transportRoutesTable = pgTable("transport_routes", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  projectName: text("project_name").notNull(),
  clientName: text("client_name").notNull().default(""),
  siteLocation: text("site_location").notNull().default(""),
  startLocation: text("start_location").notNull(),
  returnToGodown: boolean("return_to_godown").notNull().default(false),
  totalKmEstimated: numeric("total_km_estimated"),
  totalKmActual: numeric("total_km_actual"),
  ratePerKm: numeric("rate_per_km").notNull().default("25"),
  minimumCharge: numeric("minimum_charge").notNull().default("0"),
  commonToll: numeric("common_toll").notNull().default("0"),
  loadingCharge: numeric("loading_charge").notNull().default("0"),
  waitingCharge: numeric("waiting_charge").notNull().default("0"),
  advancePaid: numeric("advance_paid").notNull().default("0"),
  calculatedCost: numeric("calculated_cost").notNull().default("0"),
  balancePayable: numeric("balance_payable").notNull().default("0"),
  actualToll: numeric("actual_toll"),
  status: text("status", { enum: ["pending", "in_progress", "completed", "cancelled"] }).notNull().default("pending"),
  assignedDriverId: integer("assigned_driver_id").references(() => usersTable.id),
  completedAt: timestamp("completed_at"),
  completionNotes: text("completion_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const transportDeliveriesTable = pgTable("transport_deliveries", {
  id: text("id").primaryKey(),
  routeId: text("route_id").notNull().references(() => transportRoutesTable.id, { onDelete: "cascade" }),
  projectId: text("project_id").notNull(),
  stopOrder: integer("stop_order").notNull(),
  locationName: text("location_name").notNull(),
  customerName: text("customer_name").notNull().default(""),
  contactNumber: text("contact_number").notNull().default(""),
  perStopToll: numeric("per_stop_toll").notNull().default("0"),
  status: text("status", { enum: ["pending", "delivered", "failed"] }).notNull().default("pending"),
  deliveryNotes: text("delivery_notes"),
  failureReason: text("failure_reason"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const transportLedgerTable = pgTable("transport_ledger", {
  id: text("id").primaryKey(),
  routeId: text("route_id").notNull().references(() => transportRoutesTable.id, { onDelete: "cascade" }).unique(),
  projectId: text("project_id").notNull(),
  totalCost: numeric("total_cost").notNull().default("0"),
  advancePaid: numeric("advance_paid").notNull().default("0"),
  balancePayable: numeric("balance_payable").notNull().default("0"),
  isPaid: boolean("is_paid").notNull().default(false),
  paidAt: timestamp("paid_at"),
  paymentNotes: text("payment_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type TransportRoute = typeof transportRoutesTable.$inferSelect;
export type TransportDelivery = typeof transportDeliveriesTable.$inferSelect;
export type TransportLedger = typeof transportLedgerTable.$inferSelect;
