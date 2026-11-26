import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parsePage,
  alertReasons,
} from "../artifacts/api-server/src/laptop-watch/rules.ts";
import { compareIndiaUsa } from "../artifacts/api-server/src/laptop-watch/cross-border.ts";
import { campaignConfig } from "../artifacts/api-server/src/laptop-watch/campaign.ts";
test("temporary campaign runs only in the two approved overnight windows", () => {
  const env = { LW_CAMPAIGN: "black-friday-2026", LW_LISTING_IDS: "msi,newegg16,mac18", LW_OWNER_EMAIL: "owner@example.com" };
  for (const [time, active] of [
    ["2026-11-26T13:59:59Z", false], ["2026-11-26T14:00:00Z", true],
    ["2026-11-27T04:59:59Z", true], ["2026-11-27T05:00:00Z", false],
    ["2026-11-27T14:00:00Z", true], ["2026-11-28T04:59:59Z", true],
    ["2026-11-28T05:00:00Z", false], ["2027-11-26T14:00:00Z", false],
  ]) assert.equal(campaignConfig(env, new Date(time)).active, active, time);
  assert.equal(campaignConfig({}), null);
  assert.throws(() => campaignConfig({ ...env, LW_OWNER_EMAIL: "" }));
  assert.throws(() => campaignConfig({ ...env, LW_LISTING_IDS: "msi,msi,mac18" }));
  assert.throws(() => campaignConfig({ ...env, LW_CAMPAIGN: "unknown" }));
});
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

const indiaOffer = (overrides = {}) => ({
  sourceUrl: "https://shop.example.in/laptop",
  retailer: "India Shop",
  seller: "India Shop",
  regionalSku: "IN-SKU-1",
  configuration: { ram: "32GB", storage: "1TB", gpu: "RTX 5070" },
  configurationEvidenceUrl: "https://manufacturer.example/specs",
  condition: "new",
  purchasable: true,
  pricePaise: 20000000,
  checkedAt: new Date().toISOString(),
  warranty: "India warranty",
  ...overrides,
});
const costLine = (amountPaise, certainty = "confirmed") => ({
  amountPaise,
  certainty,
  sourceUrl: "https://source.example/cost",
  checkedAt: new Date().toISOString(),
  ...(certainty === "not_applicable" ? { note: "Confirmed not applicable" } : {}),
});
const costs = (overrides = {}) => ({
  productUsdCents: 100000,
  productCondition: "new",
  productWarranty: "US warranty only",
  productSourceUrl: "https://shop.example.com/laptop",
  productCheckedAt: new Date().toISOString(),
  salesTaxUsdCents: costLine(0),
  usShippingUsdCents: costLine(0, "not_applicable"),
  usdInrPaisePerUsd: 8000,
  exchangeRateSourceUrl: "https://fx.example/rate",
  exchangeRateCheckedAt: new Date().toISOString(),
  forexFeePaise: costLine(0),
  deliveryToIndiaPaise: costLine(0),
  customsAndDutiesPaise: costLine(0),
  otherAcquisitionPaise: costLine(0),
  ...overrides,
});
const compare = (offers, acquisitionCosts) =>
  compareIndiaUsa(
    { ram: "32GB", storage: "1TB", gpu: "RTX 5070" },
    offers,
    acquisitionCosts,
    60 * 60 * 1000,
  );
test("India-US 30% uses lowest comparable India total and complete US INR cost", () => {
  const result = compare(
    [
      indiaOffer({ pricePaise: 21000000 }),
      indiaOffer({ pricePaise: 20000000, retailer: "Cheaper India Shop" }),
    ],
    costs({
      salesTaxUsdCents: costLine(5000),
      usShippingUsdCents: costLine(2500),
      usdInrPaisePerUsd: 8000,
      forexFeePaise: costLine(100000),
      deliveryToIndiaPaise: costLine(500000),
      customsAndDutiesPaise: costLine(1000000),
    }),
  );
  assert.equal(result.indiaPricePaise, 20000000);
  assert.equal(result.usaTotalPaise, 10200000);
  assert.equal(result.savingsPercent, 49);
  assert.equal(result.meetsThirtyPercent, true);
  assert.equal(result.status, "confirmed");
});
test("estimated costs show estimated savings but never confirmed 30%", () => {
  const result = compare(
    [indiaOffer()],
    costs({
      deliveryToIndiaPaise: costLine(100000, "estimated"),
    }),
  );
  assert.equal(result.status, "estimated");
  assert.equal(result.meetsThirtyPercent, false);
  assert.equal(result.savingsPercent, 59.5);
});
test("unknown costs, non-comparable condition/SKU, and crossed-out prices cannot create 30% claim", () => {
  assert.equal(
    compare(
      [indiaOffer()],
      costs({ customsAndDutiesPaise: { amountPaise: null, certainty: "unknown", sourceUrl: null, checkedAt: null } }),
    ).status,
    "insufficient_data",
  );
  assert.equal(
    compare(
      [indiaOffer({ configuration: { ram: "32GB", storage: "2TB", gpu: "RTX 5070" } })],
      costs(),
    ).status,
    "insufficient_data",
  );
  assert.equal(
    compare(
      [indiaOffer({ condition: "open_box" })],
      costs(),
    ).status,
    "insufficient_data",
  );
  assert.equal(
    compare(
      [indiaOffer({ purchasable: false })],
      costs(),
    ).status,
    "insufficient_data",
  );
});
test("explicitly non-applicable costs are allowed; savings below 30% stay below the rule", () => {
  const result = compare(
    [indiaOffer({ pricePaise: 10000000 })],
    costs({
      salesTaxUsdCents: costLine(0, "not_applicable"),
      usShippingUsdCents: costLine(0, "not_applicable"),
      deliveryToIndiaPaise: costLine(0, "not_applicable"),
      customsAndDutiesPaise: costLine(0, "not_applicable"),
    }),
  );
  assert.equal(result.savingsPercent, 20);
  assert.equal(result.meetsThirtyPercent, false);
});
test("stale India/US evidence and unsubstantiated zero customs cannot qualify", () => {
  const old = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const staleIndia = compareIndiaUsa(
    { ram: "32GB", storage: "1TB", gpu: "RTX 5070" },
    [indiaOffer({ checkedAt: old })],
    costs(),
    60 * 60 * 1000,
  );
  assert.equal(staleIndia.status, "insufficient_data");

  const noCustomsEvidence = compare(
    [indiaOffer()],
    costs({
      customsAndDutiesPaise: {
        amountPaise: 0,
        certainty: "not_applicable",
        sourceUrl: null,
        checkedAt: null,
        note: "Assumed zero because a friend is carrying it",
      },
    }),
  );
  assert.equal(noCustomsEvidence.status, "insufficient_data");
});
