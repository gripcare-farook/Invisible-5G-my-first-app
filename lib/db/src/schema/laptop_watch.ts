import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  json,
  varchar,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
const time = (name: string) => timestamp(name, { withTimezone: true });
export const laptopListings = pgTable("lw_listings", {
  id: text("id").primaryKey(),
  catalog: jsonb("catalog").notNull(),
});
export const laptopObservations = pgTable(
  "lw_observations",
  {
    id: serial("id").primaryKey(),
    listing: text("listing")
      .notNull()
      .references(() => laptopListings.id),
    checkedAt: time("checked_at").notNull(),
    priceCents: integer("price_cents"),
    stock: text("stock").notNull(),
    seller: text("seller").notNull(),
    condition: text("condition").notNull(),
    source: text("source").notNull(),
    receipt: text("receipt").notNull().unique(),
  },
  (t) => [index("lw_history").on(t.listing, t.checkedAt)],
);
export const laptopChecks = pgTable(
  "lw_checks",
  {
    id: serial("id").primaryKey(),
    listing: text("listing")
      .notNull()
      .references(() => laptopListings.id),
    checkedAt: time("checked_at").notNull().defaultNow(),
    status: text("status").notNull(),
    message: text("message").notNull(),
  },
  (t) => [index("lw_latest_check").on(t.listing, t.checkedAt)],
);
export const laptopManualObservations = pgTable(
  "lw_manual_observations",
  {
    id: serial("id").primaryKey(),
    listing: text("listing")
      .notNull()
      .references(() => laptopListings.id),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    priceCents: integer("price_cents").notNull(),
    stock: text("stock").notNull(),
    seller: text("seller").notNull(),
    condition: text("condition").notNull(),
    observedAt: time("observed_at").notNull(),
    recordedAt: time("recorded_at").notNull().defaultNow(),
  },
  (t) => [index("lw_manual_history").on(t.listing, t.observedAt)],
);
export const laptopManualCheckLimits = pgTable("lw_manual_check_limits", {
  listing: text("listing")
    .primaryKey()
    .references(() => laptopListings.id),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  requestedAt: time("requested_at").notNull().defaultNow(),
});
export const laptopRuns = pgTable("lw_runs", {
  id: serial("id").primaryKey(),
  startedAt: time("started_at").notNull().defaultNow(),
  finishedAt: time("finished_at"),
  status: text("status").notNull(),
  failures: integer("failures").notNull().default(0),
});
export const laptopFollows = pgTable(
  "lw_follows",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    listing: text("listing")
      .notNull()
      .references(() => laptopListings.id),
    targetCents: integer("target_cents"),
    dropPercent: integer("drop_percent").notNull().default(3),
    targetAlert: boolean("target_alert").notNull().default(true),
    dropAlert: boolean("drop_alert").notNull().default(true),
    lowAlert: boolean("low_alert").notNull().default(true),
    restockAlert: boolean("restock_alert").notNull().default(true),
    pushEnabled: boolean("push_enabled").notNull().default(true),
  },
  (t) => [unique().on(t.userId, t.listing)],
);
export const laptopInvites = pgTable("lw_invites", {
  id: serial("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  createdBy: integer("created_by")
    .notNull()
    .references(() => usersTable.id),
  expiresAt: time("expires_at").notNull(),
  usedAt: time("used_at"),
  revokedAt: time("revoked_at"),
});
export const laptopSubscriptions = pgTable("lw_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  keys: jsonb("keys").notNull(),
  createdAt: time("created_at").notNull().defaultNow(),
});
export const laptopAlerts = pgTable(
  "lw_alerts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    observationId: integer("observation_id").references(
      () => laptopObservations.id,
    ),
    listing: text("listing").references(() => laptopListings.id),
    message: text("message").notNull(),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId, t.observationId)],
);
export const laptopDeliveries = pgTable(
  "lw_deliveries",
  {
    id: serial("id").primaryKey(),
    alertId: integer("alert_id")
      .notNull()
      .references(() => laptopAlerts.id),
    subscriptionId: integer("subscription_id").references(
      () => laptopSubscriptions.id,
      { onDelete: "set null" },
    ),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: time("next_attempt_at").notNull().defaultNow(),
    lastStatus: integer("last_status"),
  },
  (t) => [unique().on(t.alertId, t.subscriptionId)],
);
export const sessionsTable = pgTable(
  "session",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", { precision: 6 }).notNull(),
  },
  (t) => [index("session_expire").on(t.expire)],
);
