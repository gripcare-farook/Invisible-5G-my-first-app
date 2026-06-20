import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const PROJECT_STATUSES = ["new", "assigned", "in_progress", "completed", "billed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

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
  siteLocation: text("site_location").notNull().default(""),
  notes: text("notes").notNull().default(""),
  status: text("status", { enum: PROJECT_STATUSES }).notNull().default("new"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Project = typeof projectsTable.$inferSelect;
export type NewProject = typeof projectsTable.$inferInsert;
