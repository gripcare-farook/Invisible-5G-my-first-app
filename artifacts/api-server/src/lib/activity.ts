import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { activityLogTable, type ActivityAction } from "@workspace/db";
import { logger } from "./logger";

interface LogActivityArgs {
  actorId: number;
  actorName: string;
  actorRole: string;
  action: ActivityAction;
  projectId?: string | null;
  message: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function logActivity(db: NodePgDatabase<any>, args: LogActivityArgs): Promise<void> {
  try {
    await db.insert(activityLogTable).values({
      actorId: args.actorId,
      actorName: args.actorName,
      actorRole: args.actorRole,
      action: args.action,
      projectId: args.projectId ?? null,
      message: args.message,
    });
  } catch (err) {
    logger.error({ err, action: args.action }, "activity: failed to log");
  }
}
