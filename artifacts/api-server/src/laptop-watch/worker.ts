import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { catalog, seedCatalog, recordObservation } from "./store";
import { parsePage } from "./rules";
import { deliverPending } from "./push";
import { campaignConfig } from "./campaign";
export async function retrieve(url: string, fetcher = fetch) {
  if (!process.env.FIRECRAWL_API_KEY)
    throw new Error("FIRECRAWL_API_KEY is not configured");
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetcher("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          formats: ["markdown"],
          onlyMainContent: false,
          maxAge: 0,
          timeout: 45000,
        }),
        signal: AbortSignal.timeout(55000),
      });
      if (!response.ok) {
        if (
          attempt === 0 &&
          (response.status === 429 || response.status >= 500)
        ) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        throw new Error(`Retailer retrieval failed (HTTP ${response.status})`);
      }
      const body = (await response.json()) as {
        success?: boolean;
        data?: { markdown?: string; metadata?: { statusCode?: number } };
      };
      if (
        !body.success ||
        !body.data?.markdown ||
        (body.data.metadata?.statusCode ?? 200) >= 400
      )
        throw new Error("Retailer content unavailable");
      return body.data.markdown;
    } catch (error) {
      if (
        attempt === 0 &&
        (error instanceof TypeError || (error as Error).name === "TimeoutError")
      )
        continue;
      throw error;
    }
  }
  throw new Error("Retailer retrieval failed");
}
export async function runChecks() {
  const campaign = campaignConfig(process.env);
  if (campaign && !campaign.active) {
    console.log("Campaign inactive: no retailer checks or notifications.");
    return;
  }
  const selected = campaign ? catalog.filter(x => campaign.ids.includes(x.id)) : catalog;
  if (campaign && selected.length !== 3) throw new Error("Unknown campaign listing");
  // Session advisory locks require a direct Neon connection, not its transaction pooler.
  if (
    !process.env.DATABASE_URL ||
    new URL(process.env.DATABASE_URL).hostname.includes("-pooler")
  )
    throw new Error("Cron requires a direct (unpooled) DATABASE_URL");
  const lock = await pool.connect();
  let runId: number | undefined;
  try {
    if (
      !(await lock.query("SELECT pg_try_advisory_lock(716042) AS locked"))
        .rows[0].locked
    )
      return;
    await seedCatalog();
    await lock.query(
      "UPDATE lw_runs SET status='interrupted',finished_at=now() WHERE status='running'",
    );
    runId = (
      await lock.query(
        "INSERT INTO lw_runs(status) VALUES('running') RETURNING id",
      )
    ).rows[0].id;
    let failures = 0;
    for (const listing of selected) {
      if (campaign && !campaignConfig(process.env)!.active) break;
      try {
        await recordObservation(
          listing.id,
          parsePage(listing, await retrieve(listing.url)),
          randomUUID(),
          new Date(),
          false,
          campaign?.email,
        );
        await deliverPending(undefined, campaign?.email);
      } catch (error) {
        failures++;
        // Only our own parser/retrieval messages are safe; never persist provider bodies or credentials.
        const message =
          error instanceof Error &&
          /^(Product|Exact|Configuration|MSI|Seller|Multiple|Primary|Price|Retailer|FIRECRAWL)/.test(
            error.message,
          )
            ? error.message
            : "Check failed; previous verified offer retained";
        await lock.query(
          "INSERT INTO lw_checks(listing,status,message) VALUES($1,'error',$2)",
          [listing.id, message],
        );
      }
    }
    await lock.query(
      "UPDATE lw_runs SET finished_at=now(),status=$2,failures=$3 WHERE id=$1",
      [runId, failures ? "partial_failure" : "ok", failures],
    );
    await deliverPending(undefined, campaign?.email);
    if (failures) process.exitCode = 1;
  } finally {
    await lock.query("SELECT pg_advisory_unlock(716042)");
    lock.release();
  }
}
