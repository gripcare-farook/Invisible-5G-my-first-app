import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const ACTIVITY_ACTIONS = [
  "project.created",
  "project.status_changed",
  "project.deleted",
  "transport.assigned",
  "transport.delivery_updated",
  "transport.route_completed",
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const activityLogTable = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  actorId: integer("actor_id").notNull(),
  actorName: text("actor_name").notNull(),
  actorRole: text("actor_role").notNull(),
  action: text("action").notNull(),
  projectId: text("project_id"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ActivityLog = typeof activityLogTable.$inferSelect;
export type NewActivityLog = typeof activityLogTable.$inferInsert;
