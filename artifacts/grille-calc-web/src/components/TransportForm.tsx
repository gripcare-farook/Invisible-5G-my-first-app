import { useEffect, useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, Truck } from "lucide-react";
import { TransportData, TransportStop, TransportResult, calcTransport, newStopId } from "@/lib/transport";
import { fmtINR } from "@/lib/calculations";
import { useAuth } from "@/lib/auth-context";

interface Driver { id: number; name: string; }

interface Props {
  value: TransportData;
  onChange: (data: TransportData) => void;
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{children}</label>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} className={`w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40 ${props.className ?? ""}`} />
  );
}

function num(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export default function TransportForm({ value, onChange }: Props) {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);

  useEffect(() => {
    if (user?.role === "admin") {
      fetch("/api/transport/drivers", { credentials: "include" })
        .then((r) => r.json() as Promise<{ success: boolean; drivers: Driver[] }>)
        .then((d) => setDrivers(d.drivers ?? []))
        .catch(() => {});
    }
  }, [user]);

  const result: TransportResult = calcTransport(value);

  function update<K extends keyof TransportData>(key: K, val: TransportData[K]) {
    onChange({ ...value, [key]: val });
  }

  function updateStop(idx: number, key: keyof TransportStop, val: string | number) {
    const stops = value.stops.map((s, i) => i === idx ? { ...s, [key]: val } : s);
    onChange({ ...value, stops });
  }

  function addStop() {
    onChange({ ...value, stops: [...value.stops, { id: newStopId(), locationName: "", customerName: "", contactNumber: "", perStopToll: 0 }] });
  }

  function removeStop(idx: number) {
    onChange({ ...value, stops: value.stops.filter((_, i) => i !== idx) });
  }

  function moveStop(idx: number, dir: -1 | 1) {
    const stops = [...value.stops];
    const target = idx + dir;
    if (target < 0 || target >= stops.length) return;
    [stops[idx], stops[target]] = [stops[target]!, stops[idx]!];
    onChange({ ...value, stops });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
        <Truck size={14} className="shrink-0" />
        <span>Route mode: transport cost replaces shipping cost in the total.</span>
      </div>

      <div>
        <Label>Start Location / Godown</Label>
        <Input value={value.startLocation} onChange={(e) => update("startLocation", e.target.value)} placeholder="Tambaram, Chennai" />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Delivery Stops</Label>
          <button type="button" onClick={addStop} className="flex items-center gap-1 text-xs text-[#1e3a8a] font-semibold hover:opacity-70">
            <Plus size={13} /> Add Stop
          </button>
        </div>

        {value.stops.map((stop, idx) => (
          <div key={stop.id} className="border border-border rounded-xl p-3 space-y-2 bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1e3a8a]">Stop {idx + 1}</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => moveStop(idx, -1)} disabled={idx === 0} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <ArrowUp size={14} />
                </button>
                <button type="button" onClick={() => moveStop(idx, 1)} disabled={idx === value.stops.length - 1} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
                  <ArrowDown size={14} />
                </button>
                {value.stops.length > 1 && (
                  <button type="button" onClick={() => removeStop(idx)} className="p-1 text-destructive hover:opacity-70">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
            <Input value={stop.locationName} onChange={(e) => updateStop(idx, "locationName", e.target.value)} placeholder="Delivery location" />
            <div className="grid grid-cols-2 gap-2">
              <Input value={stop.customerName} onChange={(e) => updateStop(idx, "customerName", e.target.value)} placeholder="Customer name" />
              <Input value={stop.contactNumber} onChange={(e) => updateStop(idx, "contactNumber", e.target.value)} placeholder="Phone" />
            </div>
            <div>
              <Label>Per-stop Toll (₹)</Label>
              <Input type="number" inputMode="numeric" value={stop.perStopToll || ""} onChange={(e) => updateStop(idx, "perStopToll", num(e.target.value))} placeholder="0" />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <input
          id="rtg"
          type="checkbox"
          checked={value.returnToGodown}
          onChange={(e) => update("returnToGodown", e.target.checked)}
          className="w-4 h-4 rounded border-border text-[#1e3a8a]"
        />
        <label htmlFor="rtg" className="text-sm font-medium">Return to Godown</label>
      </div>

      <div>
        <Label>Total KM (manual entry)</Label>
        <Input type="number" inputMode="decimal" value={value.totalKm || ""} onChange={(e) => update("totalKm", num(e.target.value))} placeholder="0" />
        <p className="text-xs text-muted-foreground mt-1">Enter actual driving distance. Google Maps calculation coming soon.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Rate / KM (₹)</Label>
          <Input type="number" inputMode="numeric" value={value.ratePerKm || ""} onChange={(e) => update("ratePerKm", num(e.target.value))} placeholder="25" />
        </div>
        <div>
          <Label>Min. Charge (₹)</Label>
          <Input type="number" inputMode="numeric" value={value.minimumCharge || ""} onChange={(e) => update("minimumCharge", num(e.target.value))} placeholder="0" />
        </div>
        <div>
          <Label>Common Toll (₹)</Label>
          <Input type="number" inputMode="numeric" value={value.commonToll || ""} onChange={(e) => update("commonToll", num(e.target.value))} placeholder="0" />
        </div>
        <div>
          <Label>Loading / Unloading (₹)</Label>
          <Input type="number" inputMode="numeric" value={value.loadingCharge || ""} onChange={(e) => update("loadingCharge", num(e.target.value))} placeholder="0" />
        </div>
        <div>
          <Label>Waiting Charges (₹)</Label>
          <Input type="number" inputMode="numeric" value={value.waitingCharge || ""} onChange={(e) => update("waitingCharge", num(e.target.value))} placeholder="0" />
        </div>
        <div>
          <Label>Advance Paid (₹)</Label>
          <Input type="number" inputMode="numeric" value={value.advancePaid || ""} onChange={(e) => update("advancePaid", num(e.target.value))} placeholder="0" />
        </div>
      </div>

      {user?.role === "admin" && (
        <div>
          <Label>Assign Driver</Label>
          <select
            value={value.assignedDriverId ?? ""}
            onChange={(e) => update("assignedDriverId", e.target.value ? parseInt(e.target.value) : null)}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40"
          >
            <option value="">— Unassigned —</option>
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {drivers.length === 0 && <p className="text-xs text-muted-foreground mt-1">No transport persons found. Add driver accounts via env vars.</p>}
        </div>
      )}

      <div className="bg-[#1e3a8a]/5 border border-[#1e3a8a]/20 rounded-xl p-4 space-y-2 text-sm">
        <div className="font-semibold text-[#1e3a8a] text-xs uppercase tracking-wide mb-2">Transport Cost Breakdown</div>
        {[
          { label: "KM Cost", value: fmtINR(result.kmCost), hint: value.totalKm > 0 ? `${value.totalKm} km × ₹${value.ratePerKm}/km${value.minimumCharge > 0 ? ` (min ₹${value.minimumCharge})` : ""}` : undefined },
          { label: "Total Toll", value: fmtINR(result.totalToll), hint: `Common ₹${value.commonToll} + Stop tolls ₹${result.stopTollTotal}` },
          ...(value.loadingCharge > 0 ? [{ label: "Loading / Unloading", value: fmtINR(value.loadingCharge) }] : []),
          ...(value.waitingCharge > 0 ? [{ label: "Waiting", value: fmtINR(value.waitingCharge) }] : []),
        ].map((r) => (
          <div key={r.label}>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="font-medium">{r.value}</span>
            </div>
            {r.hint && <div className="text-xs text-muted-foreground">{r.hint}</div>}
          </div>
        ))}
        <div className="border-t border-[#1e3a8a]/20 my-2" />
        <div className="flex justify-between font-bold text-[#1e3a8a]">
          <span>Transport Total</span>
          <span>{fmtINR(result.totalCost)}</span>
        </div>
        {value.advancePaid > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Advance Paid</span>
            <span className="font-medium text-green-600">− {fmtINR(value.advancePaid)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-orange-600">
          <span>Balance Payable</span>
          <span>{fmtINR(result.balancePayable)}</span>
        </div>
      </div>
    </div>
  );
}
