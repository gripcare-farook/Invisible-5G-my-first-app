import { createHash } from "node:crypto";
export function importedObservation(row, catalog, now = Date.now()) {
  const { listing, price_cents, stock, seller, condition, checked_at } = row;
  if (
    !catalog.some((x) => x.id === listing) ||
    !(
      price_cents === null ||
      (Number.isInteger(price_cents) &&
        price_cents >= 10000 &&
        price_cents <= 2000000)
    ) ||
    ![
      "in_stock",
      "out_of_stock",
      "unknown",
      "preorder",
      "discontinued",
    ].includes(stock) ||
    typeof seller !== "string" ||
    !seller.trim() ||
    seller.length > 200 ||
    !["new", "non_new"].includes(condition) ||
    typeof checked_at !== "string" ||
    !/(Z|[+-]\d\d:\d\d)$/.test(checked_at) ||
    !Number.isFinite(Date.parse(checked_at)) ||
    Date.parse(checked_at) > now
  )
    throw new Error("Invalid observation; entire import rolled back.");
  const timestamp = new Date(checked_at).toISOString();
  const receipt =
    "pc:" +
    createHash("sha256")
      .update(
        JSON.stringify([
          listing,
          timestamp,
          price_cents,
          stock,
          seller,
          condition,
        ]),
      )
      .digest("hex");
  return [listing, timestamp, price_cents, stock, seller, condition, receipt];
}
export async function importHistory(client, rows, catalog) {
  if (!Array.isArray(rows) || rows.length > 1000000)
    throw new Error(
      "Expected an observations array, maximum one million rows.",
    );
  let inserted = 0;
  for (const row of rows) {
    const values = importedObservation(row, catalog);
    const result = await client.query(
      "INSERT INTO lw_observations(listing,checked_at,price_cents,stock,seller,condition,source,receipt) VALUES($1,$2,$3,$4,$5,$6,'pc-import',$7) ON CONFLICT(receipt) DO NOTHING",
      values,
    );
    inserted += result.rowCount;
  }
  return inserted;
}
