import { pool } from "@workspace/db";
import { logger } from "./logger";

let schemaReady: Promise<void> | null = null;

export async function ensureDatabaseSchema(): Promise<void> {
  schemaReady ??= verifyDatabaseSchema().catch((err) => {
    schemaReady = null;
    throw err;
  });
  return schemaReady;
}

async function verifyDatabaseSchema(): Promise<void> {
  await pool.query(`
    ALTER TABLE IF EXISTS projects
      ADD COLUMN IF NOT EXISTS client_name text NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS client_mobile text NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS site_location text NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '';
  `);
  logger.info("schema: verified project columns");
}
