import { pool } from "@workspace/db";
import catalog from "./catalog.json";
import { alertReasons, type Offer } from "./rules";
export { catalog };
export async function seedCatalog() {
  for (const item of catalog)
    await pool.query(
      "INSERT INTO lw_listings(id,catalog) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET catalog=excluded.catalog",
      [item.id, JSON.stringify(item)],
    );
}
export async function recordObservation(
  listing: string,
  offer: Offer,
  receipt: string,
  checkedAt = new Date(),
  imported = false,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT id FROM lw_listings WHERE id=$1 FOR UPDATE", [
      listing,
    ]);
    const { rows: history } = await client.query(
      "SELECT * FROM lw_observations WHERE listing=$1 ORDER BY checked_at DESC,id DESC",
      [listing],
    );
    if (!imported && history[0] && checkedAt <= history[0].checked_at)
      throw new Error("Older observation rejected");
    const { rows: inserted } = await client.query(
      `INSERT INTO lw_observations(listing,checked_at,price_cents,stock,seller,condition,source,receipt) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(receipt) DO NOTHING RETURNING id`,
      [
        listing,
        checkedAt,
        offer.price_cents,
        offer.stock,
        offer.seller,
        offer.condition,
        imported ? "pc-import" : "firecrawl",
        receipt,
      ],
    );
    if (inserted.length && !imported) {
      await client.query(
        "INSERT INTO lw_checks(listing,status,message) VALUES($1,'ok','Exact listing verified')",
        [listing],
      );
      const { rows: followers } = await client.query(
        "SELECT f.* FROM lw_follows f JOIN users u ON u.id=f.user_id WHERE f.listing=$1 AND u.is_active=true",
        [listing],
      );
      for (const follow of followers) {
        const reasons = alertReasons(offer, history, follow);
        if (!reasons.length) continue;
        const item = catalog.find((x) => x.id === listing)!;
        const message = `${item.name} (${item.sku}) · ${offer.seller} · $${(offer.price_cents! / 100).toFixed(2)} USD · ${reasons.join(" · ")}`;
        const {
          rows: [alert],
        } = await client.query(
          "INSERT INTO lw_alerts(user_id,observation_id,listing,message) VALUES($1,$2,$3,$4) RETURNING id",
          [follow.user_id, inserted[0].id, listing, message],
        );
        await client.query(
          "INSERT INTO notifications(type,user_id,project_id,message) VALUES('laptop_watch',$1,$2,$3)",
          [follow.user_id, listing, message],
        );
        if (follow.push_enabled)
          await client.query(
            "INSERT INTO lw_deliveries(alert_id,subscription_id) SELECT $1,id FROM lw_subscriptions WHERE user_id=$2 ON CONFLICT DO NOTHING",
            [alert.id, follow.user_id],
          );
      }
    }
    await client.query("COMMIT");
    return inserted.length > 0;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function snapshot(userId: number) {
  const { rows: listings } = await pool.query(
    `SELECT l.catalog, o.observation AS latest, c.check AS last_check, f.preference AS follow,
    (SELECT min(price_cents) FROM lw_observations h WHERE h.listing=l.id AND h.seller=o.observation->>'seller' AND h.condition=o.observation->>'condition') AS observed_low
    ,(SELECT count(*)::int FROM lw_checks e WHERE e.listing=l.id AND e.status='error' AND e.checked_at>coalesce((SELECT max(ok.checked_at) FROM lw_checks ok WHERE ok.listing=l.id AND ok.status='ok'),'epoch'::timestamptz)) AS failure_streak
    ,m.observations AS manual_observations
    FROM lw_listings l
    LEFT JOIN LATERAL (SELECT to_jsonb(x) observation FROM lw_observations x WHERE x.listing=l.id ORDER BY checked_at DESC,id DESC LIMIT 1) o ON true
    LEFT JOIN LATERAL (SELECT to_jsonb(x) check FROM lw_checks x WHERE x.listing=l.id ORDER BY checked_at DESC,id DESC LIMIT 1) c ON true
    LEFT JOIN LATERAL (SELECT to_jsonb(x) preference FROM lw_follows x WHERE x.listing=l.id AND x.user_id=$1) f ON true
    LEFT JOIN LATERAL (SELECT json_agg(to_jsonb(x) ORDER BY x.observed_at DESC) AS observations FROM (SELECT * FROM lw_manual_observations WHERE listing=l.id AND user_id=$1 ORDER BY observed_at DESC LIMIT 10) x) m ON true
    ORDER BY l.id`,
    [userId],
  );
  const { rows: runs } = await pool.query(
    "SELECT * FROM lw_runs ORDER BY id DESC LIMIT 5",
  );
  const { rows: deliveries } = await pool.query(
    "SELECT d.id,d.alert_id,d.subscription_id,d.status,d.attempts,d.last_status,a.message,a.listing FROM lw_deliveries d JOIN lw_alerts a ON a.id=d.alert_id WHERE a.user_id=$1 ORDER BY d.id DESC LIMIT 30",
    [userId],
  );
  return {
    listings: listings.map((x) => ({
      ...x.catalog,
      latest: x.latest,
      last_check: x.last_check,
      follow: x.follow,
      observed_low: x.observed_low,
      failure_streak: x.failure_streak,
      manual_observations: x.manual_observations ?? [],
    })),
    runs,
    deliveries,
  };
}
