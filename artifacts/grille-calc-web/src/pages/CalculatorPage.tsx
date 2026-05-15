import { useEffect, useState } from "react";
import { Plus, Share2, Save, ChevronDown, ChevronUp, Trash2, RefreshCw, CheckCircle, XCircle, RotateCcw } from "lucide-react";
import {
  Opening, SharedInputs, ProjectTotals, ModelType, GapInches,
  ChannelInputMode, StiffnerCostMode, ShippingMode,
  calculateProject, fmtINR, fmtNum, CHANNEL_STANDARD_LENGTH_FT,
} from "@/lib/calculations";
import {
  Settings, loadSettings, saveProject, newId,
} from "@/lib/storage";
import { shareViaWhatsApp } from "@/lib/share";
import { syncToGoogleSheets } from "@/lib/sheets";
import { LoadedProject } from "@/App";

type SyncState = "idle" | "syncing" | "sent" | "error";

interface OpeningForm {
  id: string;
  label: string;
  width: string;
  height: string;
  modelType: ModelType;
  gapInches: GapInches;
  stiffnerLineCount: string;
  channelInputMode: ChannelInputMode;
  channelOverride: string;
  expanded: boolean;
}

function emptyOpening(id?: string): OpeningForm {
  return {
    id: id ?? newId(),
    label: "",
    width: "",
    height: "",
    modelType: "vertical",
    gapInches: 2,
    stiffnerLineCount: "0",
    channelInputMode: "pcs",
    channelOverride: "",
    expanded: true,
  };
}

function toNum(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function formToOpening(f: OpeningForm): Opening {
  return {
    id: f.id,
    label: f.label.trim(),
    width: toNum(f.width),
    height: toNum(f.height),
    modelType: f.modelType,
    gapInches: f.gapInches,
    stiffnerLineCount: toNum(f.stiffnerLineCount),
    channelInputMode: f.channelInputMode,
    channelOverride: f.channelOverride ? toNum(f.channelOverride) : null,
  };
}

interface SharedForm {
  projectName: string;
  clientName: string;
  siteLocation: string;
  shippingMode: ShippingMode;
  shippingCostManual: string;
  distanceKm: string;
  miscCost: string;
  connectorCost: string;
  sellingPricePerSqft: string;
  stiffnerCostMode: StiffnerCostMode;
}

function settingsToSharedInputs(s: Settings, f: SharedForm): SharedInputs {
  return {
    clientName: f.clientName.trim(),
    wireCostPerMeter: s.wireCostPerMeter,
    labourCostPerSqft: s.labourCostPerSqft,
    channelCostPerPiece: s.channelCostPerPiece,
    fastenerCostPerPiece: s.fastenerCostPerPiece,
    stiffnerCostMode: f.stiffnerCostMode,
    stiffnerCostPerPiece: s.stiffnerCostPerPiece,
    stiffnerCostPerMeter: s.stiffnerCostPerMeter,
    miscCost: toNum(f.miscCost),
    connectorCost: toNum(f.connectorCost),
    baseLocation: s.baseLocation,
    siteLocation: f.siteLocation.trim(),
    shippingMode: f.shippingMode,
    shippingCostManual: toNum(f.shippingCostManual),
    distanceKm: toNum(f.distanceKm),
    costPerKm: s.costPerKm,
    sellingPricePerSqft: toNum(f.sellingPricePerSqft),
    targetProfitPerSqft: s.targetProfitPerSqft,
  };
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{children}</label>;
}

function Input({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40 ${className}`}
    />
  );
}

function ToggleGroup<T extends string | number>({
  options, value, onChange,
}: { options: { label: string; value: T }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-lg border border-border overflow-hidden text-sm">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 py-2 font-medium transition-colors ${
            value === o.value
              ? "bg-[#1e3a8a] text-white"
              : "bg-white text-muted-foreground hover:bg-muted"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function StatGrid({ items }: { items: { label: string; value: string; highlight?: boolean }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 mt-3">
      {items.map((item) => (
        <div key={item.label} className={`rounded-lg p-2.5 ${item.highlight ? "bg-[#1e3a8a] text-white" : "bg-muted"}`}>
          <div className={`text-xs font-medium ${item.highlight ? "text-blue-200" : "text-muted-foreground"}`}>{item.label}</div>
          <div className={`text-sm font-bold ${item.highlight ? "text-white" : "text-foreground"} mt-0.5`}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}

interface Props {
  isActive: boolean;
  loadProject: LoadedProject | null;
  onProjectLoaded: () => void;
}

export default function CalculatorPage({ isActive, loadProject, onProjectLoaded }: Props) {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [openings, setOpenings] = useState<OpeningForm[]>([emptyOpening()]);
  const [shared, setShared] = useState<SharedForm>({
    projectName: "",
    clientName: "",
    siteLocation: "",
    shippingMode: "manual",
    shippingCostManual: "",
    distanceKm: "",
    miscCost: "",
    connectorCost: "",
    sellingPricePerSqft: "",
    stiffnerCostMode: "perPiece",
  });
  const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState("");
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [syncMsg, setSyncMsg] = useState("");

  useEffect(() => {
    if (isActive) setSettings(loadSettings());
  }, [isActive]);

  useEffect(() => {
    if (!loadProject) return;
    setShared((prev) => ({
      ...prev,
      projectName: loadProject.name,
      clientName: loadProject.shared.clientName,
      siteLocation: loadProject.shared.siteLocation,
      shippingMode: loadProject.shared.shippingMode,
      shippingCostManual: loadProject.shared.shippingCostManual ? String(loadProject.shared.shippingCostManual) : "",
      distanceKm: loadProject.shared.distanceKm ? String(loadProject.shared.distanceKm) : "",
      miscCost: loadProject.shared.miscCost ? String(loadProject.shared.miscCost) : "",
      connectorCost: loadProject.shared.connectorCost ? String(loadProject.shared.connectorCost) : "",
      sellingPricePerSqft: loadProject.shared.sellingPricePerSqft ? String(loadProject.shared.sellingPricePerSqft) : "",
      stiffnerCostMode: loadProject.shared.stiffnerCostMode,
    }));
    setNotes(loadProject.notes ?? "");
    setEditingId(loadProject.id);
    setOpenings(
      loadProject.openings.map((o) => ({
        id: o.id,
        label: o.label,
        width: o.width ? String(o.width) : "",
        height: o.height ? String(o.height) : "",
        modelType: o.modelType,
        gapInches: o.gapInches,
        stiffnerLineCount: String(o.stiffnerLineCount || 0),
        channelInputMode: o.channelInputMode ?? "pcs",
        channelOverride: o.channelOverride ? String(o.channelOverride) : "",
        expanded: false,
      }))
    );
    onProjectLoaded();
  }, [loadProject]);

  function updateOpening<K extends keyof OpeningForm>(idx: number, key: K, val: OpeningForm[K]) {
    setOpenings((prev) => prev.map((o, i) => (i === idx ? { ...o, [key]: val } : o)));
  }

  function addOpening() {
    setOpenings((prev) => [...prev, emptyOpening()]);
  }

  function removeOpening(idx: number) {
    setOpenings((prev) => prev.filter((_, i) => i !== idx));
  }

  const openingData = openings.map(formToOpening);
  const sharedInputs = settingsToSharedInputs(settings, shared);
  const totals: ProjectTotals | null = openingData.some((o) => o.width > 0 && o.height > 0)
    ? calculateProject(openingData, sharedInputs)
    : null;

  function handleSave() {
    const name = shared.projectName.trim() || shared.clientName.trim() || `Project ${new Date().toLocaleDateString("en-IN")}`;
    const now = Date.now();
    const id = editingId ?? newId();
    saveProject({
      id,
      name,
      notes: notes.trim() || undefined,
      createdAt: now,
      updatedAt: now,
      openings: openingData,
      shared: sharedInputs,
    });
    setEditingId(id);
    setSaveMsg(editingId ? "Updated!" : "Saved!");
    setTimeout(() => setSaveMsg(""), 2000);
  }

  function handleReset() {
    if (!window.confirm("Start a new project? Unsaved changes will be lost.")) return;
    setOpenings([emptyOpening()]);
    setShared({
      projectName: "", clientName: "", siteLocation: "",
      shippingMode: "manual", shippingCostManual: "", distanceKm: "",
      miscCost: "", connectorCost: "", sellingPricePerSqft: "", stiffnerCostMode: "perPiece",
    });
    setNotes("");
    setEditingId(null);
    setSaveMsg("");
    setSyncState("idle");
  }

  function handleShare() {
    if (!totals) return;
    shareViaWhatsApp(openingData, sharedInputs, totals, shared.projectName, notes);
  }

  async function handleSync() {
    if (!totals || syncState === "syncing") return;
    const url = settings.appsScriptUrl?.trim();
    if (!url) {
      setSyncState("error");
      setSyncMsg("Apps Script URL not set. Go to Settings and add it.");
      setTimeout(() => setSyncState("idle"), 4000);
      return;
    }
    setSyncState("syncing");
    setSyncMsg("Sending to Google Sheets...");
    const projectId = editingId ?? newId();
    const projectName = shared.projectName.trim() || shared.clientName.trim() || `Project ${new Date().toLocaleDateString("en-IN")}`;
    const result = await syncToGoogleSheets(url, projectId, projectName, openingData, sharedInputs, totals, notes);
    if (result.sent) {
      setSyncState("sent");
      setSyncMsg(result.message);
      saveProject({ id: projectId, name: projectName, notes: notes.trim() || undefined, createdAt: Date.now(), updatedAt: Date.now(), openings: openingData, shared: sharedInputs });
      setEditingId(projectId);
      setTimeout(() => setSyncState("idle"), 5000);
    } else {
      setSyncState("error");
      setSyncMsg(result.message);
      setTimeout(() => setSyncState("idle"), 5000);
    }
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="bg-[#1e3a8a] text-white rounded-2xl px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">5G Invisible Grille</h1>
          <p className="text-blue-200 text-xs">Smart Calculator</p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 rounded-xl px-3 py-2 text-xs font-semibold transition-colors"
          title="New Project"
        >
          <RotateCcw size={13} />
          New
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-border p-4 space-y-3">
        <h2 className="font-semibold text-sm text-[#1e3a8a]">Project Details</h2>
        <div>
          <Label>Project Name</Label>
          <Input value={shared.projectName} onChange={(e) => setShared((p) => ({ ...p, projectName: e.target.value }))} placeholder="e.g. Smith Apartment" />
        </div>
        <div>
          <Label>Client Name</Label>
          <Input value={shared.clientName} onChange={(e) => setShared((p) => ({ ...p, clientName: e.target.value }))} placeholder="Client name" />
        </div>
        <div>
          <Label>Site Location</Label>
          <Input value={shared.siteLocation} onChange={(e) => setShared((p) => ({ ...p, siteLocation: e.target.value }))} placeholder="e.g. Anna Nagar" />
        </div>
      </div>

      {openings.map((o, idx) => {
        const res = totals?.openings[idx];
        const openingLabel = o.label.trim() || `Opening ${idx + 1}`;
        return (
          <div key={o.id} className="bg-white rounded-2xl border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => updateOpening(idx, "expanded", !o.expanded)}
              className="w-full flex items-center justify-between px-4 py-3 bg-[#1e3a8a]/5 hover:bg-[#1e3a8a]/10"
            >
              <span className="font-semibold text-sm text-[#1e3a8a]">{openingLabel}</span>
              <div className="flex items-center gap-2">
                {res && res.sqft > 0 && (
                  <span className="text-xs text-muted-foreground">{fmtNum(res.sqft)} sqft</span>
                )}
                {openings.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeOpening(idx); }}
                    className="text-destructive hover:opacity-70 p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                {o.expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>

            {o.expanded && (
              <div className="px-4 py-4 space-y-3">
                <div>
                  <Label>Opening Label</Label>
                  <Input value={o.label} onChange={(e) => updateOpening(idx, "label", e.target.value)} placeholder={`Opening ${idx + 1}`} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Width (ft)</Label>
                    <Input type="number" inputMode="decimal" value={o.width} onChange={(e) => updateOpening(idx, "width", e.target.value)} placeholder="0" />
                  </div>
                  <div>
                    <Label>Height (ft)</Label>
                    <Input type="number" inputMode="decimal" value={o.height} onChange={(e) => updateOpening(idx, "height", e.target.value)} placeholder="0" />
                  </div>
                </div>
                <div>
                  <Label>Model Type</Label>
                  <ToggleGroup
                    options={[{ label: "Vertical", value: "vertical" }, { label: "Horizontal", value: "horizontal" }]}
                    value={o.modelType}
                    onChange={(v) => updateOpening(idx, "modelType", v)}
                  />
                </div>
                <div>
                  <Label>Gap Size</Label>
                  <ToggleGroup
                    options={[{ label: '2"', value: 2 }, { label: '3"', value: 3 }, { label: '4"', value: 4 }] as { label: string; value: GapInches }[]}
                    value={o.gapInches}
                    onChange={(v) => updateOpening(idx, "gapInches", v)}
                  />
                </div>
                <div>
                  <Label>Stiffner Lines</Label>
                  <Input type="number" inputMode="numeric" value={o.stiffnerLineCount} onChange={(e) => updateOpening(idx, "stiffnerLineCount", e.target.value)} placeholder="0" />
                </div>
                <div>
                  <Label>Channel Unit</Label>
                  <ToggleGroup
                    options={[{ label: "Pcs", value: "pcs" }, { label: "Feet", value: "feet" }]}
                    value={o.channelInputMode}
                    onChange={(v) => updateOpening(idx, "channelInputMode", v)}
                  />
                </div>
                <div>
                  <Label>
                    Channel{" "}
                    {o.channelInputMode === "feet" ? "(feet — blank = auto)" : "(pieces — blank = auto)"}
                  </Label>
                  <div className="relative">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={o.channelOverride}
                      onChange={(e) => updateOpening(idx, "channelOverride", e.target.value)}
                      placeholder="auto"
                      className="pr-12"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      {o.channelInputMode === "feet" ? "ft" : "pcs"}
                    </span>
                  </div>
                </div>

                {res && res.sqft > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Results</div>
                    <StatGrid items={[
                      { label: "Area", value: `${fmtNum(res.sqft)} sqft` },
                      { label: "Rope", value: `${fmtNum(res.totalRopeMeters)} m`, },
                      { label: "Rope Lines", value: `${res.ropeLineCount} lines` },
                      { label: "Channel", value: `${res.channelPieces} pcs` },
                      ...(res.channelInputMode === "feet" && res.channelEnteredFeet > 0
                        ? [
                            { label: "Used", value: `${fmtNum(res.channelUsedFeet)} ft` },
                            { label: "Balance", value: `${fmtNum(res.channelBalanceFeet)} ft` },
                          ]
                        : []),
                      { label: "Fasteners", value: `${fmtNum(res.fastenerQty, 0)} pcs` },
                      ...(res.stiffnerLineCount > 0
                        ? [{ label: "Stiffner", value: `${fmtNum(res.totalStiffnerMeters)} m` }]
                        : []),
                      { label: "Subtotal", value: fmtINR(res.subtotal), highlight: true },
                    ]} />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={addOpening}
        className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-[#1e3a8a]/40 text-[#1e3a8a] font-semibold rounded-2xl py-3 text-sm hover:bg-[#1e3a8a]/5 transition-colors"
      >
        <Plus size={18} />
        Add Opening
      </button>

      <div className="bg-white rounded-2xl border border-border p-4 space-y-3">
        <h2 className="font-semibold text-sm text-[#1e3a8a]">Shipping</h2>
        <div>
          <Label>Mode</Label>
          <ToggleGroup
            options={[{ label: "Manual", value: "manual" }, { label: "By Distance", value: "distance" }]}
            value={shared.shippingMode}
            onChange={(v) => setShared((p) => ({ ...p, shippingMode: v }))}
          />
        </div>
        {shared.shippingMode === "manual" ? (
          <div>
            <Label>Shipping Cost (₹)</Label>
            <Input type="number" inputMode="numeric" value={shared.shippingCostManual} onChange={(e) => setShared((p) => ({ ...p, shippingCostManual: e.target.value }))} placeholder="0" />
          </div>
        ) : (
          <div>
            <Label>Distance (km)</Label>
            <Input type="number" inputMode="decimal" value={shared.distanceKm} onChange={(e) => setShared((p) => ({ ...p, distanceKm: e.target.value }))} placeholder="0" />
            <p className="text-xs text-muted-foreground mt-1">Rate: ₹{settings.costPerKm}/km (from Settings)</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-border p-4 space-y-3">
        <h2 className="font-semibold text-sm text-[#1e3a8a]">Other Costs</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Misc Cost (₹)</Label>
            <Input type="number" inputMode="numeric" value={shared.miscCost} onChange={(e) => setShared((p) => ({ ...p, miscCost: e.target.value }))} placeholder="0" />
          </div>
          <div>
            <Label>Connector Cost (₹)</Label>
            <Input type="number" inputMode="numeric" value={shared.connectorCost} onChange={(e) => setShared((p) => ({ ...p, connectorCost: e.target.value }))} placeholder="0" />
          </div>
        </div>
        <div>
          <Label>Stiffner Cost Mode</Label>
          <ToggleGroup
            options={[{ label: "Per Piece", value: "perPiece" }, { label: "Per Meter", value: "perMeter" }]}
            value={shared.stiffnerCostMode}
            onChange={(v) => setShared((p) => ({ ...p, stiffnerCostMode: v }))}
          />
        </div>
      </div>

      {totals && (
        <div className="bg-white rounded-2xl border border-border p-4">
          <h2 className="font-semibold text-sm text-[#1e3a8a] mb-3">Grand Total</h2>

          <div className="space-y-1.5 text-sm">
            {[
              { label: "Total Area", value: `${fmtNum(totals.totalSqft)} sqft` },
              { label: "Rope", value: `${fmtNum(totals.totalRopeMeters)} m` },
              { label: "Channel", value: `${totals.totalChannelPieces} pcs` },
              { label: "Fasteners", value: `${fmtNum(totals.totalFasteners, 0)} pcs` },
            ].map((r) => (
              <div key={r.label} className="flex justify-between">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-medium">{r.value}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-border my-3" />

          <div className="space-y-1.5 text-sm">
            {[
              { label: "Wire", value: fmtINR(totals.wireCost) },
              { label: "Channel", value: fmtINR(totals.channelCost) },
              { label: "Fastener", value: fmtINR(totals.fastenerCost) },
              { label: "Stiffner", value: fmtINR(totals.stiffnerCost) },
              { label: "Labour", value: fmtINR(totals.labourCost) },
              { label: "Shipping", value: fmtINR(totals.shippingCost) },
              ...(totals.otherCost > 0 ? [{ label: "Other", value: fmtINR(totals.otherCost) }] : []),
            ].map((r) => (
              <div key={r.label} className="flex justify-between">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-medium">{r.value}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-border my-3" />

          <div className="flex justify-between font-bold text-[#1e3a8a]">
            <span>Total Cost</span>
            <span>{fmtINR(totals.totalCost)}</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground mt-1">
            <span>Cost / sqft</span>
            <span>{fmtINR(totals.costPerSqft)}</span>
          </div>

          <div className="border-t border-border my-3" />

          <div>
            <Label>Selling Price / sqft (₹)</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={shared.sellingPricePerSqft}
              onChange={(e) => setShared((p) => ({ ...p, sellingPricePerSqft: e.target.value }))}
              placeholder="0"
            />
          </div>

          {totals.totalSqft > 0 && (
            <div className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recommended / sqft</span>
                <span className="font-medium text-[#f97316]">{fmtINR(totals.recommendedSellingPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Profit / sqft</span>
                <span className={`font-medium ${totals.profitPerSqft >= 0 ? "text-green-600" : "text-destructive"}`}>{fmtINR(totals.profitPerSqft)}</span>
              </div>
              <div className="flex justify-between font-bold text-base">
                <span>Total Profit</span>
                <span className={totals.totalProfit >= 0 ? "text-green-600" : "text-destructive"}>{fmtINR(totals.totalProfit)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-border p-4 space-y-3">
        <h2 className="font-semibold text-sm text-[#1e3a8a]">Notes</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any site notes, special requirements, etc."
          rows={3}
          className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40 resize-none"
        />
      </div>

      {syncState !== "idle" && (
        <div className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm ${
          syncState === "syncing" ? "bg-blue-50 text-blue-800 border border-blue-200" :
          syncState === "sent" ? "bg-green-50 text-green-800 border border-green-200" :
          "bg-red-50 text-red-800 border border-red-200"
        }`}>
          {syncState === "syncing" && <RefreshCw size={16} className="animate-spin mt-0.5 shrink-0" />}
          {syncState === "sent" && <CheckCircle size={16} className="mt-0.5 shrink-0" />}
          {syncState === "error" && <XCircle size={16} className="mt-0.5 shrink-0" />}
          <span>{syncMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={handleSave}
          className="flex items-center justify-center gap-2 bg-[#1e3a8a] text-white font-semibold rounded-xl py-3 text-sm hover:bg-[#1e3a8a]/90 transition-colors"
        >
          <Save size={16} />
          {saveMsg || (editingId ? "Update" : "Save")}
        </button>
        <button
          type="button"
          onClick={handleShare}
          disabled={!totals}
          className="flex items-center justify-center gap-2 bg-[#f97316] text-white font-semibold rounded-xl py-3 text-sm hover:bg-[#f97316]/90 disabled:opacity-40 transition-colors"
        >
          <Share2 size={16} />
          WhatsApp
        </button>
      </div>

      <button
        type="button"
        onClick={handleSync}
        disabled={!totals || syncState === "syncing"}
        className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-semibold rounded-xl py-3.5 text-sm hover:bg-green-700 disabled:opacity-40 transition-colors mb-4"
      >
        {syncState === "syncing"
          ? <><RefreshCw size={16} className="animate-spin" /> Syncing...</>
          : <><RefreshCw size={16} /> Save &amp; Sync to Google Sheets</>
        }
      </button>
    </div>
  );
}
