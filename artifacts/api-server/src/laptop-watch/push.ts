import * as webpush from "web-push";
import { pool } from "@workspace/db";
export function validateSubscription(
  value: unknown,
): value is { endpoint: string; keys: { p256dh: string; auth: string } } {
  const v = value as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
  if (!v || typeof v.endpoint !== "string" || v.endpoint.length > 2000)
    return false;
  try {
    const url = new URL(v.endpoint);
    // User-supplied endpoints must never become arbitrary server-side requests.
    if (
      url.protocol !== "https:" ||
      url.port ||
      url.username ||
      url.password ||
      !(
        url.hostname === "fcm.googleapis.com" ||
        url.hostname === "updates.push.services.mozilla.com" ||
        url.hostname === "web.push.apple.com" ||
        url.hostname.endsWith(".push.apple.com")
      )
    )
      return false;
  } catch {
    return false;
  }
  return (
    typeof v.keys?.p256dh === "string" &&
    /^[A-Za-z0-9_-]{87}$/.test(v.keys.p256dh) &&
    typeof v.keys.auth === "string" &&
    /^[A-Za-z0-9_-]{22}$/.test(v.keys.auth)
  );
}
export function deliveryOutcome(status: number | undefined, attempts: number) {
  if (status === 404 || status === 410) return "expired";
  if (status && status >= 200 && status < 300) return "accepted";
  if (
    attempts >= 3 ||
    (status && status >= 400 && status < 500 && ![408, 429].includes(status))
  )
    return "failed";
  return "retry";
}
export async function deliverPending(send = webpush.sendNotification) {
  const {
    VAPID_PUBLIC_KEY: publicKey,
    VAPID_PRIVATE_KEY: privateKey,
    VAPID_SUBJECT: subject,
  } = process.env;
  if (!publicKey || !privateKey || !subject) return;
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT d.*,s.endpoint,s.keys,a.message,a.listing FROM lw_deliveries d JOIN lw_subscriptions s ON s.id=d.subscription_id JOIN lw_alerts a ON a.id=d.alert_id JOIN users u ON u.id=s.user_id WHERE d.status IN ('pending','retry') AND d.next_attempt_at<=now() AND d.attempts<3 AND u.is_active=true ORDER BY d.id LIMIT 100`,
    );
    for (const delivery of rows) {
      // Persist the attempt before network I/O. A crash retries with the same notification tag.
      const {
        rows: [claimed],
      } = await client.query(
        "UPDATE lw_deliveries SET attempts=attempts+1,status='retry',next_attempt_at=now()+interval '1 hour' WHERE id=$1 AND status IN ('pending','retry') AND next_attempt_at<=now() AND attempts<3 RETURNING attempts",
        [delivery.id],
      );
      if (!claimed) continue;
      const attempts = claimed.attempts;
      let status: number | undefined;
      try {
        const result = await send(
          { endpoint: delivery.endpoint, keys: delivery.keys },
          JSON.stringify({
            title: "Laptop Watch",
            body: delivery.message,
            url: delivery.listing
              ? `/laptop-watch/${delivery.listing}`
              : "/laptop-watch",
            tag: `laptop-${delivery.alert_id}`,
          }),
          {
            TTL: 3600,
            timeout: 10000,
            vapidDetails: { subject, publicKey, privateKey },
          },
        );
        status = result.statusCode;
      } catch (error) {
        status = (error as { statusCode?: number }).statusCode;
      }
      const outcome = deliveryOutcome(status, attempts);
      if (outcome === "expired") {
        await client.query(
          "UPDATE lw_deliveries SET status='expired',last_status=$2 WHERE subscription_id=$1 AND status IN ('pending','retry')",
          [delivery.subscription_id, status],
        );
        await client.query("DELETE FROM lw_subscriptions WHERE id=$1", [
          delivery.subscription_id,
        ]);
      } else
        await client.query(
          "UPDATE lw_deliveries SET status=$2,last_status=$3 WHERE id=$1",
          [delivery.id, outcome, status ?? null],
        );
    }
    await client.query(
      "UPDATE lw_deliveries SET status='failed' WHERE status='retry' AND attempts>=3 AND next_attempt_at<=now()",
    );
  } finally {
    client.release();
  }
}
