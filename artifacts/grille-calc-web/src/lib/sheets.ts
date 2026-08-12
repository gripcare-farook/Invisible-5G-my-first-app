import { Opening, ProjectTotals, SharedInputs } from "./calculations";

export interface SyncResult {
  sent: boolean;
  message: string;
}

export interface SheetsSyncPayload {
  action: "saveFullProject";
  savedAt: string;
  projectId: string;
  projectName: string;
  clientName: string;
  mobileNumber: string;
  siteLocation: string;
  openingsCount: number;
  totalSqft: number;
  totalRopeLines: number;
  totalRopeMeters: number;
  totalChannelFeet: number;
  totalChannelPcs: number;
  totalFasteners: number;
  totalStiffnerMeters: number;
  labourCost: number;
  shippingCost: number;
  miscCost: number;
  totalCost: number;
  costPerSqft: number;
  sellingPrice: number;
  recommendedSellingPrice: number;
  totalProfit: number;
  profitPerSqft: number;
  notes: string;
  openings: OpeningPayload[];
}

interface OpeningPayload {
  projectId: string;
  savedAt: string;
  openingIndex: number;
  label: string;
  widthFt: number;
  heightFt: number;
  quantity: number;
  sqft: number;
  modelType: string;
  gapInches: number;
  ropeLines: number;
  ropeMeters: number;
  channelPcs: number;
  channelFeet: number;
  fasteners: number;
  stiffnerLines: number;
  stiffnerMeters: number;
  wireCost: number;
  channelCost: number;
  fastenerCost: number;
  stiffnerCost: number;
  labourCost: number;
  subtotal: number;
}

export async function syncToGoogleSheets(
  appsScriptUrl: string,
  projectId: string,
  projectName: string,
  openings: Opening[],
  shared: SharedInputs,
  totals: ProjectTotals,
  notes: string = "",
): Promise<SyncResult> {
  if (!appsScriptUrl.trim()) {
    return { sent: false, message: "Apps Script URL not configured in Settings." };
  }

  const payload = buildSheetsSyncPayload(projectId, projectName, openings, shared, totals, notes);

  try {
    const resp = await fetch("/api/sheets/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appsScriptUrl, payload }),
    });

    const data = (await resp.json()) as { success?: boolean; message?: string };

    if (!resp.ok || !data.success) {
      return { sent: false, message: data.message ?? `Server error (HTTP ${resp.status}).` };
    }
    return { sent: true, message: data.message ?? "Synced to Google Sheets successfully." };
  } catch (err) {
    return { sent: false, message: err instanceof Error ? err.message : "Network error — could not reach sync server." };
  }
}

export function buildSheetsSyncPayload(
  projectId: string,
  projectName: string,
  openings: Opening[],
  shared: SharedInputs,
  totals: ProjectTotals,
  notes: string = "",
): SheetsSyncPayload {
  const savedAt = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const payload: SheetsSyncPayload = {
    action: "saveFullProject",
    savedAt,
    projectId,
    projectName,
    clientName: shared.clientName,
    mobileNumber: shared.mobileNumber ?? "",
    siteLocation: shared.siteLocation,
    openingsCount: openings.length,
    totalSqft: round2(totals.totalSqft),
    totalRopeLines: totals.totalRopeLines,
    totalRopeMeters: round2(totals.totalRopeMeters),
    totalChannelFeet: round2(totals.totalChannelFeet),
    totalChannelPcs: totals.totalChannelPieces,
    totalFasteners: totals.totalFasteners,
    totalStiffnerMeters: round2(totals.totalStiffnerMeters),
    labourCost: Math.round(totals.labourCost),
    shippingCost: Math.round(totals.shippingCost),
    miscCost: Math.round(shared.miscCost || 0),
    totalCost: Math.round(totals.totalCost),
    costPerSqft: round2(totals.costPerSqft),
    sellingPrice: shared.sellingPricePerSqft || 0,
    recommendedSellingPrice: round2(totals.recommendedSellingPrice),
    totalProfit: Math.round(totals.totalProfit),
    profitPerSqft: round2(totals.profitPerSqft),
    notes,
    openings: openings.map((o, i) => {
      const r = totals.openings[i];
      return {
        projectId,
        savedAt,
        openingIndex: i + 1,
        label: o.label.trim() || `Opening ${i + 1}`,
        widthFt: o.width,
        heightFt: o.height,
        quantity: o.quantity || 1,
        sqft: round2(r.sqft),
        modelType: o.modelType === "vertical" ? "Vertical" : "Horizontal",
        gapInches: o.gapInches,
        ropeLines: r.ropeLineCount,
        ropeMeters: round2(r.totalRopeMeters),
        channelPcs: r.channelPieces,
        channelFeet: round2(r.totalChannelFeet),
        fasteners: r.fastenerQty,
        stiffnerLines: r.stiffnerLineCount,
        stiffnerMeters: round2(r.totalStiffnerMeters),
        wireCost: Math.round(r.wireCost),
        channelCost: Math.round(r.channelCost),
        fastenerCost: Math.round(r.fastenerCost),
        stiffnerCost: Math.round(r.stiffnerCost),
        labourCost: Math.round(r.labourCost),
        subtotal: Math.round(r.subtotal),
      };
    }),
  };

  return payload;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
