import { Share } from "react-native";
import {
  Opening,
  ProjectTotals,
  SharedInputs,
  fmtINR,
  fmtNum,
} from "./calculations";

export function buildSummaryText(
  openings: Opening[],
  shared: SharedInputs,
  totals: ProjectTotals,
  projectName = "",
  notes = "",
): string {
  const lines: string[] = [];
  lines.push("*5G INVISIBLE GRILLE - QUOTATION*");
  if (projectName) lines.push(`Project: ${projectName}`);
  if (shared.clientName) lines.push(`Client: ${shared.clientName}`);
  if (shared.siteLocation) lines.push(`Site: ${shared.siteLocation}`);
  lines.push("");

  openings.forEach((o, i) => {
    const r = totals.openings[i];
    if (!r) return;
    const qty = Math.max(1, Math.round(o.quantity || 1));
    const label = o.label.trim() || `Opening ${i + 1}`;
    lines.push(`*${i + 1}. ${label}${qty > 1 ? ` ×${qty}` : ""}*`);
    if (qty > 1) {
      lines.push(
        `   ${fmtNum(o.width)} × ${fmtNum(o.height)} ft each | Qty: ${qty} = ${fmtNum(r.sqft)} sqft total`,
      );
    } else {
      lines.push(
        `   Size: ${fmtNum(o.width)} × ${fmtNum(o.height)} ft = ${fmtNum(r.sqft)} sqft`,
      );
    }
    lines.push(
      `   ${o.modelType === "vertical" ? "Vertical" : "Horizontal"} | Gap ${o.gapInches}"`,
    );
    lines.push(
      `   Rope ${r.ropeLineCount} lines = ${fmtNum(r.totalRopeMeters)} m`,
    );
    lines.push(
      `   Channel ${r.channelPieces} pcs | ${fmtNum(r.channelUsedFeet)} ft @ ${fmtINR(r.channelRatePerFoot)}/ft = ${fmtINR(r.channelCost)}`,
    );
    if (r.channelInputMode === "feet" && r.channelBalanceFeet > 0) {
      lines.push(`   Balance: ${fmtNum(r.channelBalanceFeet)} ft`);
    }
    lines.push(`   Fasteners: ${fmtNum(r.fastenerQty, 0)} pcs`);
    if (r.stiffnerLineCount > 0) {
      lines.push(
        `   Stiffner ${r.stiffnerLineCount} lines = ${fmtNum(r.totalStiffnerMeters)} m`,
      );
    }
    lines.push(`   Subtotal: ${fmtINR(r.subtotal)}`);
    lines.push("");
  });

  lines.push("*MATERIAL TOTAL*");
  lines.push(`Total Sqft:     ${fmtNum(totals.totalSqft)}`);
  lines.push(`Rope:           ${fmtNum(totals.totalRopeMeters)} m`);
  lines.push(
    `Channel:        ${totals.totalChannelPieces} pcs (${fmtNum(totals.totalChannelFeet, 0)} ft)`,
  );
  lines.push(`Fasteners:      ${fmtNum(totals.totalFasteners, 0)} pcs`);
  lines.push(
    `Stiffner:       ${totals.totalStiffnerLines} lines = ${fmtNum(totals.totalStiffnerMeters)} m`,
  );
  lines.push("");

  lines.push("*COST BREAKDOWN*");
  lines.push(`Wire:      ${fmtINR(totals.wireCost)}`);
  lines.push(`Channel:   ${fmtINR(totals.channelCost)}`);
  lines.push(`Fastener:  ${fmtINR(totals.fastenerCost)}`);
  lines.push(`Stiffner:  ${fmtINR(totals.stiffnerCost)}`);
  lines.push(`Labour:    ${fmtINR(totals.labourCost)}`);
  lines.push(`Shipping:  ${fmtINR(totals.shippingCost)}`);
  if (totals.otherCost > 0) lines.push(`Other:     ${fmtINR(totals.otherCost)}`);
  lines.push(`-------------------`);
  lines.push(`*TOTAL COST: ${fmtINR(totals.totalCost)}*`);
  lines.push(`Cost / sqft: ${fmtINR(totals.costPerSqft)}`);
  lines.push("");

  lines.push("*QUOTATION*");
  lines.push(`Selling / sqft: ${fmtINR(shared.sellingPricePerSqft)}`);
  lines.push(`Recommended:    ${fmtINR(totals.recommendedSellingPrice)}`);
  lines.push(`Profit / sqft:  ${fmtINR(totals.profitPerSqft)}`);
  lines.push(`*Total Profit:  ${fmtINR(totals.totalProfit)}*`);
  if (notes.trim()) {
    lines.push("");
    lines.push(`*Notes:* ${notes.trim()}`);
  }
  return lines.join("\n");
}

export async function shareSummary(
  openings: Opening[],
  shared: SharedInputs,
  totals: ProjectTotals,
  projectName = "",
  notes = "",
): Promise<void> {
  const message = buildSummaryText(openings, shared, totals, projectName, notes);
  try {
    await Share.share({ message });
  } catch {
    // ignore
  }
}
