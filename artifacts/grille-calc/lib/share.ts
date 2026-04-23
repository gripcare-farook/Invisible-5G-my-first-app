import { Share } from "react-native";
import { CalcResults, ProjectInputs, fmtINR, fmtNum } from "./calculations";

export function buildSummaryText(
  inputs: ProjectInputs,
  r: CalcResults,
): string {
  const lines: string[] = [];
  lines.push("*5G INVISIBLE GRILLE - QUOTATION*");
  if (inputs.clientName) lines.push(`Client: ${inputs.clientName}`);
  lines.push("");
  lines.push("*PROJECT*");
  lines.push(
    `Size: ${fmtNum(inputs.width)} ft x ${fmtNum(inputs.height)} ft = ${fmtNum(r.sqft)} sqft`,
  );
  lines.push(
    `Model: ${inputs.modelType === "vertical" ? "Vertical" : "Horizontal"}  |  Gap: ${inputs.gapInches}"`,
  );
  if (inputs.siteLocation) lines.push(`Site: ${inputs.siteLocation}`);
  lines.push("");
  lines.push("*MATERIAL*");
  lines.push(
    `Rope: ${r.ropeLineCount} lines  =  ${fmtNum(r.totalRopeMeters)} m`,
  );
  lines.push(
    `Channel: ${r.channelPieces} pcs  (${fmtNum(r.totalChannelFeet, 0)} ft)`,
  );
  lines.push(`Fasteners: ${fmtNum(r.fastenerQty, 0)} pcs`);
  lines.push(
    `Stiffner: ${r.stiffnerLineCount} lines  =  ${fmtNum(r.totalStiffnerMeters)} m`,
  );
  lines.push("");
  lines.push("*COST BREAKDOWN*");
  lines.push(`Wire:      ${fmtINR(r.wireCost)}`);
  lines.push(`Channel:   ${fmtINR(r.channelCost)}`);
  lines.push(`Fastener:  ${fmtINR(r.fastenerCost)}`);
  lines.push(`Stiffner:  ${fmtINR(r.stiffnerCost)}`);
  lines.push(`Labour:    ${fmtINR(r.labourCost)}`);
  lines.push(`Shipping:  ${fmtINR(r.shippingCost)}`);
  if (r.otherCost > 0) lines.push(`Other:     ${fmtINR(r.otherCost)}`);
  lines.push(`-------------------`);
  lines.push(`*TOTAL COST: ${fmtINR(r.totalCost)}*`);
  lines.push(`Cost / sqft: ${fmtINR(r.costPerSqft)}`);
  lines.push("");
  lines.push("*QUOTATION*");
  lines.push(`Selling / sqft: ${fmtINR(inputs.sellingPricePerSqft)}`);
  lines.push(`Recommended:    ${fmtINR(r.recommendedSellingPrice)}`);
  lines.push(`Profit / sqft:  ${fmtINR(r.profitPerSqft)}`);
  lines.push(`*Total Profit:  ${fmtINR(r.totalProfit)}*`);
  return lines.join("\n");
}

export async function shareSummary(
  inputs: ProjectInputs,
  r: CalcResults,
): Promise<void> {
  const message = buildSummaryText(inputs, r);
  try {
    await Share.share({ message });
  } catch {
    // ignore
  }
}
