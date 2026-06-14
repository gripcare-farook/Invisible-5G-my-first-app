import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const leadFollowupsTable = pgTable("lead_followups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  location: text("location").notNull().default(""),
  requirement: text("requirement").notNull().default(""),
  source: text("source").notNull().default(""),
  followUpDate: text("follow_up_date"),
  status: text("status", { enum: ["new", "contacted", "interested", "not_interested", "converted", "lost"] }).notNull().default("new"),
  notes: text("notes").notNull().default(""),
  nextAction: text("next_action").notNull().default(""),
  assignedTo: integer("assigned_to").references(() => usersTable.id),
  createdBy: integer("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type LeadFollowup = typeof leadFollowupsTable.$inferSelect;
export type InsertLeadFollowup = typeof leadFollowupsTable.$inferInsert;
