export type IndiaOffer = {
  sourceUrl: string;
  retailer: string;
  seller: string;
  regionalSku: string;
  configuration: Record<string, string>;
  configurationEvidenceUrl: string | null;
  condition: string;
  purchasable: boolean;
  pricePaise: number;
  checkedAt: string;
  warranty: string | null;
};

export type CostLine = {
  // Scale follows the field: USD cents for tax/shipping, INR paise otherwise.
  amountPaise: number | null;
  certainty: "confirmed" | "estimated" | "not_applicable" | "unknown";
  sourceUrl: string | null;
  checkedAt: string | null;
  note?: string | null;
};

export type UsaAcquisitionCosts = {
  productUsdCents: number;
  productCondition: string;
  productWarranty: string | null;
  productSourceUrl: string | null;
  productCheckedAt: string | null;
  salesTaxUsdCents: CostLine;
  usShippingUsdCents: CostLine;
  usdInrPaisePerUsd: number | null;
  exchangeRateSourceUrl: string | null;
  exchangeRateCheckedAt: string | null;
  forexFeePaise: CostLine;
  deliveryToIndiaPaise: CostLine;
  customsAndDutiesPaise: CostLine;
  otherAcquisitionPaise: CostLine;
};

export type CrossBorderComparison = {
  status: "confirmed" | "estimated" | "insufficient_data";
  indiaOffer: IndiaOffer | null;
  usaWarranty: string | null;
  usaTotalPaise: number | null;
  indiaPricePaise: number | null;
  savingsPaise: number | null;
  savingsPercent: number | null;
  meetsThirtyPercent: boolean;
  reason: string;
};

const validHttpUrl = (value: string | null | undefined) => {
  if (!value) return false;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

const normalizedConfig = (configuration: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(configuration).map(([key, value]) => [
      key.trim().toLowerCase(),
      value.trim().toLowerCase().replace(/\s+/g, " "),
    ]),
  );
function sameConfiguration(
  expected: Record<string, string>,
  offer: Record<string, string>,
) {
  const a = normalizedConfig(expected);
  const b = normalizedConfig(offer);
  return (
    Object.keys(a).length > 0 &&
    Object.keys(a).length === Object.keys(b).length &&
    Object.entries(a).every(([key, value]) => value && b[key] === value)
  );
}

function isFresh(timestamp: string, now: number, maxAgeMs: number) {
  const checkedAt = Date.parse(timestamp);
  return (
    Number.isFinite(checkedAt) &&
    checkedAt <= now &&
    checkedAt >= now - maxAgeMs
  );
}

function comparableIndiaOffers(
  expectedConfiguration: Record<string, string>,
  offers: IndiaOffer[],
  now: number,
  maxAgeMs: number,
) {
  return offers
    .filter(
      (offer) =>
        sameConfiguration(expectedConfiguration, offer.configuration) &&
        validHttpUrl(offer.configurationEvidenceUrl) &&
        offer.condition === "new" &&
        offer.purchasable &&
        Number.isSafeInteger(offer.pricePaise) &&
        offer.pricePaise > 0 &&
        !!offer.retailer.trim() &&
        !!offer.seller.trim() &&
        !!offer.regionalSku.trim() &&
        validHttpUrl(offer.sourceUrl) &&
        isFresh(offer.checkedAt, now, maxAgeMs),
    )
    .sort((a, b) => a.pricePaise - b.pricePaise);
}

function resolveCost(line: CostLine, now: number, maxAgeMs: number) {
  if (
    line.certainty === "not_applicable" &&
    line.amountPaise === 0 &&
    !!line.note?.trim() &&
    validHttpUrl(line.sourceUrl) &&
    isFresh(line.checkedAt ?? "", now, maxAgeMs)
  )
    return { amount: 0, certainty: "confirmed" as const };
  if (
    line.certainty === "unknown" ||
    line.amountPaise === null ||
    !Number.isSafeInteger(line.amountPaise) ||
    line.amountPaise < 0 ||
    !validHttpUrl(line.sourceUrl) ||
    !isFresh(line.checkedAt ?? "", now, maxAgeMs)
  )
    return null;
  return {
    amount: line.amountPaise,
    certainty: line.certainty,
  };
}

/**
 * Compare the current lowest verified, purchasable, new India offer with the
 * complete US acquisition cost. Any unknown cost or unverified SKU match
 * fails closed; retailer strike-through prices are never an input.
 */
export function compareIndiaUsa(
  expectedConfiguration: Record<string, string>,
  offers: IndiaOffer[],
  costs: UsaAcquisitionCosts,
  maxAgeMs: number,
  now = Date.now(),
): CrossBorderComparison {
  const indiaOffer =
    comparableIndiaOffers(expectedConfiguration, offers, now, maxAgeMs)[0] ??
    null;
  const insufficient = (reason: string): CrossBorderComparison => ({
    status: "insufficient_data",
    indiaOffer,
    usaWarranty: costs.productWarranty,
    usaTotalPaise: null,
    indiaPricePaise: indiaOffer?.pricePaise ?? null,
    savingsPaise: null,
    savingsPercent: null,
    meetsThirtyPercent: false,
    reason,
  });
  if (!Number.isSafeInteger(maxAgeMs) || maxAgeMs <= 0)
    return insufficient("A valid offer freshness window was not supplied.");
  if (!indiaOffer)
    return insufficient("No verified, purchasable, equivalent new India offer.");
  if (
    !Number.isSafeInteger(costs.productUsdCents) ||
    costs.productUsdCents <= 0 ||
    costs.productCondition !== "new" ||
    !Number.isSafeInteger(costs.usdInrPaisePerUsd) ||
    costs.usdInrPaisePerUsd! <= 0 ||
    !validHttpUrl(costs.productSourceUrl) ||
    !isFresh(costs.productCheckedAt ?? "", now, maxAgeMs) ||
    !validHttpUrl(costs.exchangeRateSourceUrl) ||
    !isFresh(costs.exchangeRateCheckedAt ?? "", now, maxAgeMs)
  )
    return insufficient("US offer is not verified new or its price/rate is missing or stale.");

  const salesTax = resolveCost(costs.salesTaxUsdCents, now, maxAgeMs);
  const usShipping = resolveCost(costs.usShippingUsdCents, now, maxAgeMs);
  const forex = resolveCost(costs.forexFeePaise, now, maxAgeMs);
  const delivery = resolveCost(costs.deliveryToIndiaPaise, now, maxAgeMs);
  const customs = resolveCost(costs.customsAndDutiesPaise, now, maxAgeMs);
  const other = resolveCost(costs.otherAcquisitionPaise, now, maxAgeMs);
  if (!salesTax || !usShipping || !forex || !delivery || !customs || !other)
    return insufficient("One or more required US acquisition costs are unknown.");

  const usdTotalCents =
    costs.productUsdCents + salesTax.amount + usShipping.amount;
  const convertedPaise = Math.round(
    (usdTotalCents * costs.usdInrPaisePerUsd!) / 100,
  );
  const usaTotalPaise =
    convertedPaise +
    forex.amount +
    delivery.amount +
    customs.amount +
    other.amount;
  if (!Number.isSafeInteger(usaTotalPaise))
    return insufficient("The total acquisition cost is outside the supported range.");
  const savingsPaise = indiaOffer.pricePaise - usaTotalPaise;
  const savingsPercent = (100 * savingsPaise) / indiaOffer.pricePaise;
  const status = [
    salesTax.certainty,
    usShipping.certainty,
    forex.certainty,
    delivery.certainty,
    customs.certainty,
    other.certainty,
  ].includes("estimated")
    ? "estimated"
    : "confirmed";
  return {
    status,
    indiaOffer,
    usaWarranty: costs.productWarranty,
    usaTotalPaise,
    indiaPricePaise: indiaOffer.pricePaise,
    savingsPaise,
    savingsPercent,
    meetsThirtyPercent: status === "confirmed" && savingsPercent >= 30,
    reason:
      status === "estimated"
        ? "Savings are estimated because at least one acquisition cost is estimated."
        : "Savings use the lowest verified comparable India offer and the complete US acquisition cost.",
  };
}
