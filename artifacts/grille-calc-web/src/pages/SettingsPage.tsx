import { useState } from "react";
import { Settings, loadSettings, saveSettings } from "@/lib/storage";

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

export default function SettingsPage() {
  const [form, setForm] = useState<Settings>(loadSettings);
  const [saved, setSaved] = useState(false);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((p) => ({ ...p, [key]: value }));
    setSaved(false);
  }

  function handleSave() {
    saveSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function numField(key: keyof Settings, label: string, placeholder = "0") {
    return (
      <div>
        <Label>{label}</Label>
        <Input
          type="number"
          inputMode="decimal"
          value={form[key] as number}
          onChange={(e) => update(key, parseFloat(e.target.value) || 0)}
          placeholder={placeholder}
        />
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="bg-[#1e3a8a] text-white rounded-2xl px-4 py-4">
        <h1 className="text-lg font-bold">Settings</h1>
        <p className="text-blue-200 text-xs">Default rates for new projects</p>
      </div>

      <div className="bg-white rounded-2xl border border-border p-4 space-y-3">
        <h2 className="font-semibold text-sm text-[#1e3a8a]">Location</h2>
        <div>
          <Label>Base Location</Label>
          <Input
            value={form.baseLocation}
            onChange={(e) => update("baseLocation", e.target.value)}
            placeholder="e.g. Tambaram, Chennai"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border p-4 space-y-3">
        <h2 className="font-semibold text-sm text-[#1e3a8a]">Material Rates</h2>
        {numField("wireCostPerMeter", "Wire Cost / Meter (₹)")}
        {numField("channelCostPerPiece", "Channel Cost / Piece (₹)")}
        {numField("fastenerCostPerPiece", "Fastener Cost / Piece (₹)")}
        {numField("stiffnerCostPerPiece", "Stiffner Cost / Piece (₹)")}
        {numField("stiffnerCostPerMeter", "Stiffner Cost / Meter (₹)")}
      </div>

      <div className="bg-white rounded-2xl border border-border p-4 space-y-3">
        <h2 className="font-semibold text-sm text-[#1e3a8a]">Labour & Shipping</h2>
        {numField("labourCostPerSqft", "Labour Cost / Sqft (₹)")}
        {numField("costPerKm", "Shipping Cost / Km (₹)")}
      </div>

      <div className="bg-white rounded-2xl border border-border p-4 space-y-3">
        <h2 className="font-semibold text-sm text-[#1e3a8a]">Profit Target</h2>
        {numField("targetProfitPerSqft", "Target Profit / Sqft (₹)")}
      </div>

      <button
        type="button"
        onClick={handleSave}
        className="w-full bg-[#1e3a8a] text-white font-semibold rounded-xl py-3.5 text-sm hover:bg-[#1e3a8a]/90 transition-colors"
      >
        {saved ? "Saved!" : "Save Settings"}
      </button>

      <div className="pb-4 text-center text-xs text-muted-foreground">
        Settings apply to all new projects. Existing saved projects keep their own rates.
      </div>
    </div>
  );
}
