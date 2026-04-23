export type ModelType = "vertical" | "horizontal";
export type GapInches = 2 | 3 | 4;
export type StiffnerCostMode = "perPiece" | "perMeter";
export type ShippingMode = "manual" | "distance";

export interface ProjectInputs {
  width: number;
  height: number;
  modelType: ModelType;
  gapInches: GapInches;
  stiffnerLineCount: number;
  clientName: string;

  channelOverride: number | null;

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

export interface CalcResults {
  sqft: number;
  ropeLineCount: number;
  totalRopeFeet: number;
  totalRopeMeters: number;
  channelPieces: number;
  totalChannelFeet: number;
  fastenerQty: number;
  stiffnerLineCount: number;
  totalStiffnerFeet: number;
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

export function calculate(i: ProjectInputs): CalcResults {
  const width = num(i.width);
  const height = num(i.height);
  const gap = i.gapInches;
  const sqft = width * height;

  const widthInches = width * 12;
  const heightInches = height * 12;

  let ropeLineCount = 0;
  let lineLengthFt = 0;
  if (i.modelType === "vertical") {
    ropeLineCount = gap > 0 ? Math.floor(widthInches / gap) + 1 : 0;
    lineLengthFt = height;
  } else {
    ropeLineCount = gap > 0 ? Math.floor(heightInches / gap) + 1 : 0;
    lineLengthFt = width;
  }
  const totalRopeFeet = ropeLineCount * lineLengthFt;
  const totalRopeMeters = totalRopeFeet * FT_TO_M;

  const autoChannelPieces =
    i.modelType === "vertical"
      ? Math.ceil(width / 10) * 2
      : Math.ceil(height / 10) * 2;
  const channelPieces =
    i.channelOverride && i.channelOverride > 0
      ? i.channelOverride
      : autoChannelPieces;
  const totalChannelFeet = channelPieces * 10;
  const fastenerQty = totalChannelFeet;

  const stiffnerLineLen = i.modelType === "vertical" ? width : height;
  const stiffnerLineCount = num(i.stiffnerLineCount);
  const totalStiffnerFeet = stiffnerLineCount * stiffnerLineLen;
  const totalStiffnerMeters = totalStiffnerFeet * FT_TO_M;

  const wireCost = totalRopeMeters * num(i.wireCostPerMeter);
  const channelCost = channelPieces * num(i.channelCostPerPiece);
  const fastenerCost = fastenerQty * num(i.fastenerCostPerPiece);
  const stiffnerCost =
    i.stiffnerCostMode === "perPiece"
      ? stiffnerLineCount * num(i.stiffnerCostPerPiece)
      : totalStiffnerMeters * num(i.stiffnerCostPerMeter);
  const labourCost = sqft * num(i.labourCostPerSqft);
  const shippingCost =
    i.shippingMode === "manual"
      ? num(i.shippingCostManual)
      : num(i.distanceKm) * num(i.costPerKm);
  const otherCost = num(i.miscCost) + num(i.connectorCost);

  const totalCost =
    wireCost +
    channelCost +
    fastenerCost +
    stiffnerCost +
    labourCost +
    shippingCost +
    otherCost;
  const costPerSqft = sqft > 0 ? totalCost / sqft : 0;

  const profitPerSqft = num(i.sellingPricePerSqft) - costPerSqft;
  const totalProfit = profitPerSqft * sqft;
  const recommendedSellingPrice = costPerSqft + num(i.targetProfitPerSqft);

  return {
    sqft,
    ropeLineCount,
    totalRopeFeet,
    totalRopeMeters,
    channelPieces,
    totalChannelFeet,
    fastenerQty,
    stiffnerLineCount,
    totalStiffnerFeet,
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
