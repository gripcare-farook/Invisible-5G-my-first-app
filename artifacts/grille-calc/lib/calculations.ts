export type ModelType = "vertical" | "horizontal";
export type GapInches = 2 | 3 | 4;
export type StiffnerCostMode = "perPiece" | "perMeter";
export type ShippingMode = "manual" | "distance" | "route";
export type ChannelInputMode = "pcs" | "feet";

export const CHANNEL_STANDARD_LENGTH_FT = 10;

export interface Opening {
  id: string;
  label: string;
  width: number;
  height: number;
  quantity: number;
  modelType: ModelType;
  gapInches: GapInches;
  stiffnerLineCount?: number;
  channelInputMode: ChannelInputMode;
  channelOverride: number | null;
}

export interface SharedInputs {
  clientName: string;

  wireCostPerMeter: number;
  labourCostPerSqft: number;
  channelCostPerPiece: number;
  fastenerCostPerPiece: number;
  stiffnerCostMode: StiffnerCostMode;
  stiffnerCostPerPiece: number;
  stiffnerCostPerMeter: number;
  miscCost: number;
  connectorCost: number;

  baseLocation: string;
  siteLocation: string;
  shippingMode: ShippingMode;
  shippingCostManual: number;
  distanceKm: number;
  costPerKm: number;

  sellingPricePerSqft: number;
  targetProfitPerSqft: number;
}

export interface OpeningResults {
  sqft: number;
  ropeLineCount: number;
  totalRopeFeet: number;
  totalRopeMeters: number;
  channelPieces: number;
  totalChannelFeet: number;
  channelInputMode: ChannelInputMode;
  channelEnteredFeet: number;
  channelUsedFeet: number;
  channelBalanceFeet: number;
  channelRatePerFoot: number;
  fastenerQty: number;
  stiffnerPiecesPerLine: number;
  stiffnerPieces: number;
  stiffnerLineCount: number;
  totalStiffnerFeet: number;
  totalStiffnerMeters: number;

  wireCost: number;
  channelCost: number;
  fastenerCost: number;
  stiffnerCost: number;
  labourCost: number;

  subtotal: number;
}

export interface ProjectTotals {
  openings: OpeningResults[];

  totalSqft: number;
  totalRopeLines: number;
  totalRopeMeters: number;
  totalChannelPieces: number;
  totalChannelFeet: number;
  totalFasteners: number;
  totalStiffnerLines: number;
  totalStiffnerMeters: number;

  wireCost: number;
  channelCost: number;
  fastenerCost: number;
  stiffnerCost: number;
  labourCost: number;
  shippingCost: number;
  otherCost: number;

  totalCost: number;
  costPerSqft: number;

  profitPerSqft: number;
  totalProfit: number;
  recommendedSellingPrice: number;
}

const FT_TO_M = 0.3048;

export function calculateOpening(
  o: Opening,
  s: SharedInputs,
): OpeningResults {
  const width = num(o.width);
  const height = num(o.height);
  const gap = o.gapInches;
  const sqft = width * height;

  const widthInches = width * 12;
  const heightInches = height * 12;

  let ropeLineCount = 0;
  let lineLengthFt = 0;
  if (o.modelType === "vertical") {
    ropeLineCount = gap > 0 ? Math.floor(widthInches / gap) + 1 : 0;
    lineLengthFt = height;
  } else {
    ropeLineCount = gap > 0 ? Math.floor(heightInches / gap) + 1 : 0;
    lineLengthFt = width;
  }
  const totalRopeFeet = ropeLineCount * lineLengthFt;
  const totalRopeMeters = totalRopeFeet * FT_TO_M;

  const qty = Math.max(1, Math.round(num(o.quantity) || 1));
  const stdLen = CHANNEL_STANDARD_LENGTH_FT;
  const autoVerticalChannelFeet = width * 2 * qty;
  const autoChannelPieces =
    o.modelType === "vertical"
      ? Math.ceil(autoVerticalChannelFeet / stdLen)
      : Math.ceil(height / stdLen) * 2;

  const overrideVal =
    o.channelOverride && o.channelOverride > 0 ? o.channelOverride : 0;
  const inputMode: ChannelInputMode = o.channelInputMode ?? "pcs";

  let channelPieces: number;
  let channelEnteredFeet = 0;
  let channelUsedFeet: number;
  let channelBalanceFeet = 0;

  if (overrideVal > 0 && inputMode === "feet") {
    channelEnteredFeet = overrideVal;
    channelPieces = Math.ceil(overrideVal / stdLen);
    channelUsedFeet = overrideVal;
    channelBalanceFeet = channelPieces * stdLen - overrideVal;
  } else if (overrideVal > 0) {
    channelPieces = overrideVal;
    channelUsedFeet = channelPieces * stdLen;
  } else {
    channelPieces = autoChannelPieces;
    channelUsedFeet =
      o.modelType === "vertical" ? autoVerticalChannelFeet : channelPieces * stdLen;
    channelBalanceFeet = channelPieces * stdLen - channelUsedFeet;
  }

  const isAutoVertical = o.modelType === "vertical" && overrideVal === 0;
  const totalChannelFeet = isAutoVertical ? channelUsedFeet : channelPieces * stdLen;
  const fastenerQty = totalChannelFeet;

  const stiffnerDimFt = o.modelType === "vertical" ? width : height;
  const stiffnerPiecesPerLine = gap > 0 ? Math.round((stiffnerDimFt * 12) / gap) : 0;
  const stiffnerLineCount = o.stiffnerLineCount != null ? num(o.stiffnerLineCount) : 1;
  const stiffnerPieces = stiffnerPiecesPerLine * stiffnerLineCount;
  const totalStiffnerFeet = stiffnerDimFt * stiffnerLineCount;
  const totalStiffnerMeters = totalStiffnerFeet * FT_TO_M;

  const wireCost = totalRopeMeters * num(s.wireCostPerMeter);
  const channelRatePerFoot = num(s.channelCostPerPiece) / stdLen;
  const channelCost = channelUsedFeet * channelRatePerFoot;
  const fastenerCost = fastenerQty * num(s.fastenerCostPerPiece);
  const stiffnerCost =
    s.stiffnerCostMode === "perPiece"
      ? stiffnerPieces * num(s.stiffnerCostPerPiece)
      : totalStiffnerMeters * num(s.stiffnerCostPerMeter);
  const labourCost = sqft * num(s.labourCostPerSqft);

  const channelQtyMultiplier = isAutoVertical ? 1 : qty;
  const subtotal =
    wireCost * qty +
    channelCost * channelQtyMultiplier +
    fastenerCost * channelQtyMultiplier +
    stiffnerCost * qty +
    labourCost * qty;
  return {
    sqft: sqft * qty,
    ropeLineCount: ropeLineCount * qty,
    totalRopeFeet: totalRopeFeet * qty,
    totalRopeMeters: totalRopeMeters * qty,
    channelPieces: channelPieces * channelQtyMultiplier,
    totalChannelFeet: totalChannelFeet * channelQtyMultiplier,
    channelInputMode: inputMode,
    channelEnteredFeet: channelEnteredFeet * channelQtyMultiplier,
    channelUsedFeet: channelUsedFeet * channelQtyMultiplier,
    channelBalanceFeet: channelBalanceFeet * channelQtyMultiplier,
    channelRatePerFoot,
    fastenerQty: fastenerQty * channelQtyMultiplier,
    stiffnerPiecesPerLine,
    stiffnerPieces: stiffnerPieces * qty,
    stiffnerLineCount: stiffnerLineCount * qty,
    totalStiffnerFeet: totalStiffnerFeet * qty,
    totalStiffnerMeters: totalStiffnerMeters * qty,
    wireCost: wireCost * qty,
    channelCost: channelCost * channelQtyMultiplier,
    fastenerCost: fastenerCost * channelQtyMultiplier,
    stiffnerCost: stiffnerCost * qty,
    labourCost: labourCost * qty,
    subtotal,
  };
}

export function calculateProject(
  openings: Opening[],
  s: SharedInputs,
): ProjectTotals {
  const results = openings.map((o) => calculateOpening(o, s));

  let totalSqft = 0;
  let totalRopeLines = 0;
  let totalRopeMeters = 0;
  let totalChannelPieces = 0;
  let totalChannelFeet = 0;
  let totalFasteners = 0;
  let totalStiffnerLines = 0;
  let totalStiffnerMeters = 0;
  let wireCost = 0;
  let channelCost = 0;
  let fastenerCost = 0;
  let stiffnerCost = 0;
  let labourCost = 0;
  let autoVerticalChannelFeet = 0;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const opening = openings[i];
    totalSqft += r.sqft;
    totalRopeLines += r.ropeLineCount;
    totalRopeMeters += r.totalRopeMeters;
    const isAutoVertical =
      opening.modelType === "vertical" &&
      !(opening.channelOverride && opening.channelOverride > 0);
    if (isAutoVertical) {
      autoVerticalChannelFeet += r.totalChannelFeet;
    } else {
      totalChannelPieces += r.channelPieces;
    }
    totalChannelFeet += r.totalChannelFeet;
    totalFasteners += r.fastenerQty;
    totalStiffnerLines += r.stiffnerLineCount;
    totalStiffnerMeters += r.totalStiffnerMeters;
    wireCost += r.wireCost;
    channelCost += r.channelCost;
    fastenerCost += r.fastenerCost;
    stiffnerCost += r.stiffnerCost;
    labourCost += r.labourCost;
  }
  totalChannelPieces += Math.ceil(autoVerticalChannelFeet / CHANNEL_STANDARD_LENGTH_FT);

  const shippingCost =
    s.shippingMode === "manual"
      ? num(s.shippingCostManual)
      : num(s.distanceKm) * num(s.costPerKm);
  const otherCost = num(s.miscCost) + num(s.connectorCost);

  const totalCost =
    wireCost + channelCost + fastenerCost + stiffnerCost + labourCost + shippingCost + otherCost;
  const costPerSqft = totalSqft > 0 ? totalCost / totalSqft : 0;
  const profitPerSqft = num(s.sellingPricePerSqft) - costPerSqft;
  const totalProfit = profitPerSqft * totalSqft;
  const recommendedSellingPrice = costPerSqft + num(s.targetProfitPerSqft);

  return {
    openings: results,
    totalSqft,
    totalRopeLines,
    totalRopeMeters,
    totalChannelPieces,
    totalChannelFeet,
    totalFasteners,
    totalStiffnerLines,
    totalStiffnerMeters,
    wireCost,
    channelCost,
    fastenerCost,
    stiffnerCost,
    labourCost,
    shippingCost,
    otherCost,
    totalCost,
    costPerSqft,
    profitPerSqft,
    totalProfit,
    recommendedSellingPrice,
  };
}

function num(v: number | string | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function fmtINR(v: number): string {
  if (!Number.isFinite(v)) return "₹0";
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  const rounded = Math.round(abs);
  return `${sign}₹${rounded.toLocaleString("en-IN")}`;
}

export function fmtNum(v: number, digits = 2): string {
  if (!Number.isFinite(v)) return "0";
  return v.toLocaleString("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}
