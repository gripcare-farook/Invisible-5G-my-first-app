import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parsePage,
  alertReasons,
} from "../artifacts/api-server/src/laptop-watch/rules.ts";
const catalog = JSON.parse(
  readFileSync(
    new URL(
      "../artifacts/api-server/src/laptop-watch/catalog.json",
      import.meta.url,
    ),
  ),
);
const page = (id) =>
  JSON.parse(
    readFileSync(
      new URL(`./fixtures/laptop-watch/${id}.json`, import.meta.url),
    ),
  ).markdown;
for (const [id, price, stock] of [
  ["msi", 229900, "out_of_stock"],
  ["newegg16", 270500, "in_stock"],
  ["legion32", null, "discontinued"],
  ["bestbuy32", null, "out_of_stock"],
  ["vector64", null, "out_of_stock"],
  ["mac15", 309900, "in_stock"],
  ["mac18", 326900, "in_stock"],
  ["vector32", 269900, "in_stock"],
  ["stealth64", 309900, "in_stock"],
]) {
  test(`exact ${id} primary offer fixture`, () => {
    const result = parsePage(
      catalog.find((x) => x.id === id),
      page(id),
    );
    assert.equal(result.price_cents, price);
    assert.equal(result.stock, stock);
    if (id === "newegg16") assert.equal(result.seller, "CompDepot");
  });
}
test("reject blocked, wrong SKU and RAM", () => {
  assert.throws(() => parsePage(catalog[0], "Verify you are human"));
  assert.throws(() =>
    parsePage(
      catalog.find((x) => x.id === "mac18"),
      page("mac15"),
    ),
  );
  assert.throws(() =>
    parsePage(catalog[0], page("msi").replaceAll("16GB", "32GB")),
  );
});
test("GPU memory cannot masquerade as system RAM; SSD and GPU variants fail closed", () => {
  assert.throws(() =>
    parsePage(
      catalog[0],
      page("msi").replace("16GB (8Gx2) DDR5", "32GB (16Gx2) DDR5"),
    ),
  );
  assert.throws(() =>
    parsePage(catalog[0], page("msi").replaceAll("1TB", "2TB")),
  );
  assert.throws(() =>
    parsePage(
      catalog.find((x) => x.id === "mac15"),
      page("mac15").replaceAll("16-Core GPU", "20-Core GPU"),
    ),
  );
});
const offer = (
  price,
  stock = "in_stock",
  seller = "MSI US",
  condition = "new",
) => ({ price_cents: price, stock, seller, condition });
const pref = {
  target_cents: 240000,
  drop_percent: 3,
  target_alert: true,
  drop_alert: true,
  low_alert: true,
  restock_alert: true,
};
test("baseline and unchanged prices do not alert", () => {
  assert.deepEqual(alertReasons(offer(230000), [], pref), []);
  assert.deepEqual(alertReasons(offer(230000), [offer(230000)], pref), []);
});
test("target crossing, drop and historical low merge", () => {
  assert.deepEqual(alertReasons(offer(230000), [offer(250000)], pref), [
    "Target reached",
    "Price dropped 8.0%",
    "New low in our tracked history",
  ]);
});
test("restock includes current price and target status", () => {
  assert.match(
    alertReasons(offer(230000), [offer(230000, "out_of_stock")], pref).join(
      " ",
    ),
    /Back in stock.*2,300.00.*within target/,
  );
});
test("seller/condition change establishes baseline; non-new and unavailable cannot be deals", () => {
  for (const next of [
    offer(200000, "in_stock", "Other"),
    offer(200000, "in_stock", "MSI US", "non_new"),
    offer(200000, "unknown"),
    offer(200000, "out_of_stock"),
  ])
    assert.deepEqual(alertReasons(next, [offer(250000)], pref), []);
});
test("known stock survives unknown; historical low considers entire comparable history", () => {
  assert.match(
    alertReasons(
      offer(230000),
      [offer(230000, "unknown"), offer(230000, "out_of_stock")],
      pref,
    )[0],
    /Back in stock/,
  );
  assert.ok(
    !alertReasons(offer(230000), [offer(250000), offer(220000)], pref).includes(
      "New low in our tracked history",
    ),
  );
});
