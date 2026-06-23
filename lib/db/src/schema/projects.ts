import { numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const PROJECT_STATUSES = ["new", "assigned", "in_progress", "completed", "billed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const PAYMENT_STATUSES = ["unpaid", "partial", "paid"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  new: "New",
  assigned: "Assigned",
  in_progress: "In Progress",
  completed: "Completed",
  billed: "Billed",
};

export const projectsTable = pgTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  clientName: text("client_name").notNull().default(""),
  clientMobile: text("client_mobile").notNull().default(""),
  siteLocation: text("site_location").notNull().default(""),
  notes: text("notes").notNull().default(""),
  status: text("status", { enum: PROJECT_STATUSES }).notNull().default("new"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  advanceAmount: numeric("advance_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  receivedAmount: numeric("received_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  balanceAmount: numeric("balance_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  paymentStatus: text("payment_status", { enum: PAYMENT_STATUSES }).notNull().default("unpaid"),
  receivedDate: timestamp("received_date"),
  paymentNotes: text("payment_notes").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Project = typeof projectsTable.$inferSelect;
export type NewProject = typeof projectsTable.$inferInsert;
