import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { importHistory } from "./laptop-history.mjs";
const require = createRequire(
  new URL("../lib/db/package.json", import.meta.url),
);
const { Pool } = require("pg");
if (!process.env.DATABASE_URL)
  throw new Error("Set DATABASE_URL securely for the intended database.");
const action = process.argv[2];
if (!["migrate", "import"].includes(action))
  throw new Error(
    "Usage: node scripts/laptop-watch-db.mjs migrate | import <export.json>",
  );
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  if (action === "migrate")
    for (const migration of [
      "0001_laptop_watch.sql",
      "0002_laptop_manual_checks.sql",
    ])
      await client.query(
        await readFile(
          new URL(`../lib/db/migrations/${migration}`, import.meta.url),
          "utf8",
        ),
      );
  const catalog = JSON.parse(
    await readFile(
      new URL(
        "../artifacts/api-server/src/laptop-watch/catalog.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await client.query("BEGIN");
  for (const item of catalog)
    await client.query(
      "INSERT INTO lw_listings(id,catalog) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET catalog=excluded.catalog",
      [item.id, JSON.stringify(item)],
    );
  if (action === "import") {
    const rows = JSON.parse(await readFile(process.argv[3], "utf8"));
    const inserted = await importHistory(client, rows, catalog);
    console.log(`Imported ${inserted} observations; no alerts generated.`);
  }
  await client.query("COMMIT");
  console.log("Laptop Watch database operation completed.");
} catch {
  await client.query("ROLLBACK");
  console.error(
    "Database operation failed. Verify target database, migration prerequisites and input; no credentials are logged.",
  );
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
