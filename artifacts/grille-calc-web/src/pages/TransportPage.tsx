import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { MapPin, CheckCircle, XCircle, ChevronDown, ChevronUp, Truck, LogOut, Navigation, Loader2, AlertCircle } from "lucide-react";
import { fmtINR } from "@/lib/calculations";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS, type ProjectStatus } from "@/lib/storage";

interface Delivery {
  id: string;
  routeId: string;
  stopOrder: number;
  locationName: string;
  customerName: string;
  contactNumber: string;
  perStopToll: string;
  status: "pending" | "delivered" | "failed";
  deliveryNotes: string | null;
  failureReason: string | null;
  deliveredAt: string | null;
}

interface Route {
  id: string;
  projectId: string;
  projectName: string;
  clientName: string;
  siteLocation: string;
  startLocation: string;
  returnToGodown: boolean;
  totalKmEstimated: string | null;
  totalKmActual: string | null;
  ratePerKm: string;
  calculatedCost: string;
  balancePayable: string;
  advancePaid: string;
  actualToll: string | null;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  completionNotes: string | null;
  deliveries: Delivery[];
}

function StatusBadge({ status }: { status: Delivery["status"] | Route["status"] }) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800" },
    in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-800" },
    delivered: { label: "Delivered", className: "bg-green-100 text-green-800" },
    completed: { label: "Completed", className: "bg-green-100 text-green-800" },
    failed: { label: "Failed", className: "bg-red-100 text-red-800" },
    cancelled: { label: "Cancelled", className: "bg-gray-100 text-gray-700" },
  };
  const s = map[status] ?? { label: status, className: "bg-gray-100 text-gray-700" };
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.className}`}>{s.label}</span>;
}

function DeliveryCard({ delivery, routeId, onUpdate }: { delivery: Delivery; routeId: string; onUpdate: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(delivery.deliveryNotes ?? "");
  const [failReason, setFailReason] = useState(delivery.failureReason ?? "");
  const [saving, setSaving] = useState(false);

  async function updateStatus(status: "delivered" | "failed") {
    setSaving(true);
    await fetch(`/api/transport/deliveries/${delivery.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status, notes, failureReason: status === "failed" ? failReason : undefined }),
    });
    setSaving(false);
    onUpdate();
  }

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(delivery.locationName)}`;

  return (
    <div className={`border rounded-xl overflow-hidden ${delivery.status === "delivered" ? "border-green-200 bg-green-50" : delivery.status === "failed" ? "border-red-200 bg-red-50" : "border-border bg-white"}`}>
      <button type="button" onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 text-left">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${delivery.status === "delivered" ? "bg-green-500" : delivery.status === "failed" ? "bg-red-500" : "bg-[#1e3a8a]"}`}>
            {delivery.stopOrder}
          </div>
          <div>
            <div className="font-semibold text-sm text-foreground">{delivery.locationName || "Stop " + delivery.stopOrder}</div>
            {delivery.customerName && <div className="text-xs text-muted-foreground">{delivery.customerName}</div>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={delivery.status} />
          {expanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {delivery.contactNumber && (
            <div className="text-sm">
              <span className="text-muted-foreground">Contact: </span>
              <a href={`tel:${delivery.contactNumber}`} className="text-[#1e3a8a] font-medium">{delivery.contactNumber}</a>
            </div>
          )}

          <a href={mapsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-[#1e3a8a] font-medium">
            <Navigation size={14} />
            Open in Google Maps
          </a>

          {delivery.status === "pending" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Delivery Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Proof of delivery, notes…" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Failure Reason (if failed)</label>
                <input value={failReason} onChange={(e) => setFailReason(e.target.value)} placeholder="Customer not home, etc." className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => updateStatus("delivered")} disabled={saving} className="flex items-center justify-center gap-1.5 bg-green-600 text-white text-sm font-semibold rounded-xl py-2.5 hover:bg-green-700 disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Delivered
                </button>
                <button type="button" onClick={() => updateStatus("failed")} disabled={saving} className="flex items-center justify-center gap-1.5 bg-red-500 text-white text-sm font-semibold rounded-xl py-2.5 hover:bg-red-600 disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Failed
                </button>
              </div>
            </>
          )}

          {delivery.status !== "pending" && delivery.deliveryNotes && (
            <div className="text-sm text-muted-foreground">Notes: {delivery.deliveryNotes}</div>
          )}
          {delivery.status === "failed" && delivery.failureReason && (
            <div className="text-sm text-red-600">Reason: {delivery.failureReason}</div>
          )}
        </div>
      )}
    </div>
  );
}

function RouteCard({ route, projectStatus, onUpdate }: { route: Route; projectStatus?: ProjectStatus; onUpdate: () => void }) {
  const [expanded, setExpanded] = useState(true);
  const [showComplete, setShowComplete] = useState(false);
  const [actualKm, setActualKm] = useState(route.totalKmActual ?? route.totalKmEstimated ?? "");
  const [actualToll, setActualToll] = useState(route.actualToll ?? "");
  const [completionNotes, setCompletionNotes] = useState(route.completionNotes ?? "");
  const [completing, setCompleting] = useState(false);

  const delivered = route.deliveries.filter((d) => d.status === "delivered").length;
  const total = route.deliveries.length;
  const allDone = route.deliveries.every((d) => d.status !== "pending");

  async function submitComplete() {
    setCompleting(true);
    await fetch(`/api/transport/routes/${route.id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ actualKm: parseFloat(actualKm) || 0, actualToll: parseFloat(actualToll) || 0, completionNotes }),
    });
    setCompleting(false);
    setShowComplete(false);
    onUpdate();
  }

  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden">
      <button type="button" onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between px-4 py-3 bg-[#1e3a8a]/5">
        <div className="text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-[#1e3a8a]">{route.projectName}</span>
            {projectStatus && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PROJECT_STATUS_COLORS[projectStatus]}`}>
                {PROJECT_STATUS_LABELS[projectStatus]}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{route.clientName && `${route.clientName} · `}{route.siteLocation}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-medium text-muted-foreground">{delivered}/{total}</span>
          <StatusBadge status={route.status} />
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 py-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin size={14} className="shrink-0" />
            <span>From <strong className="text-foreground">{route.startLocation}</strong></span>
          </div>

          {route.totalKmEstimated && (
            <div className="text-sm text-muted-foreground">Est. Distance: <strong className="text-foreground">{route.totalKmEstimated} km</strong></div>
          )}

          {total > 0 && (
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${(delivered / total) * 100}%` }} />
            </div>
          )}
          <p className="text-xs text-muted-foreground text-center">{delivered} of {total} deliveries completed</p>

          <div className="space-y-2">
            {route.deliveries.map((d) => (
              <DeliveryCard key={d.id} delivery={d} routeId={route.id} onUpdate={onUpdate} />
            ))}
          </div>

          {route.status !== "completed" && route.status !== "cancelled" && allDone && (
            <div className="pt-2">
              {!showComplete ? (
                <button type="button" onClick={() => setShowComplete(true)} className="w-full flex items-center justify-center gap-2 bg-[#1e3a8a] text-white font-semibold rounded-xl py-3 text-sm hover:bg-[#1e3a8a]/90">
                  <Truck size={16} /> Complete Route
                </button>
              ) : (
                <div className="border border-[#1e3a8a]/20 rounded-xl p-4 space-y-3 bg-[#1e3a8a]/5">
                  <h3 className="font-semibold text-sm text-[#1e3a8a]">Route Completion</h3>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Actual Total KM</label>
                    <input type="number" inputMode="decimal" value={actualKm} onChange={(e) => setActualKm(e.target.value)} placeholder="0" className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Actual Toll (₹)</label>
                    <input type="number" inputMode="numeric" value={actualToll} onChange={(e) => setActualToll(e.target.value)} placeholder="0" className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Completion Notes</label>
                    <textarea value={completionNotes} onChange={(e) => setCompletionNotes(e.target.value)} rows={2} placeholder="Any notes about the route…" className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40 resize-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setShowComplete(false)} className="border border-border text-muted-foreground font-semibold rounded-xl py-2.5 text-sm hover:bg-muted">Cancel</button>
                    <button type="button" onClick={submitComplete} disabled={completing} className="flex items-center justify-center gap-1.5 bg-green-600 text-white font-semibold rounded-xl py-2.5 text-sm hover:bg-green-700 disabled:opacity-50">
                      {completing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Submit
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {route.status === "completed" && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700 flex items-center gap-2">
              <CheckCircle size={16} className="shrink-0" />
              Route completed. Balance: {fmtINR(parseFloat(route.balancePayable) || 0)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TransportPage() {
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [projectStatusMap, setProjectStatusMap] = useState<Record<string, ProjectStatus>>({});
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
    if (!loading && user && user.role === "admin") {
      // Admin can view transport but also use calculator
    }
  }, [user, loading, navigate]);

  async function loadRoutes() {
    setFetching(true);
    setError("");
    try {
      const [routeResp, projectResp] = await Promise.all([
        fetch("/api/transport/my-routes", { credentials: "include" }),
        fetch("/api/projects", { credentials: "include" }),
      ]);
      if (!routeResp.ok) throw new Error("Failed to load routes");
      const routeData = (await routeResp.json()) as { success: boolean; routes: Route[] };
      setRoutes(routeData.routes ?? []);
      if (projectResp.ok) {
        const projData = (await projectResp.json()) as { success: boolean; projects: Array<{ id: string; status: ProjectStatus }> };
        if (projData.success) {
          const map: Record<string, ProjectStatus> = {};
          for (const p of projData.projects) map[p.id] = p.status;
          setProjectStatusMap(map);
        }
      }
    } catch {
      setError("Could not load routes. Please try again.");
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    if (user) loadRoutes();
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#1e3a8a]" />
      </div>
    );
  }

  const activeRoutes = routes.filter((r) => r.status === "pending" || r.status === "in_progress");
  const completedRoutes = routes.filter((r) => r.status === "completed");
  const today = new Date().toDateString();

  return (
    <div className="min-h-screen bg-background max-w-xl mx-auto">
      <div className="bg-[#1e3a8a] text-white px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2"><Truck size={20} /> Transport</h1>
          <p className="text-blue-200 text-xs">Welcome, {user.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {user.role === "admin" && (
            <button onClick={() => navigate("/")} className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg font-medium">
              Calculator
            </button>
          )}
          <button onClick={logout} className="flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg font-medium">
            <LogOut size={13} /> Sign Out
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 pb-8">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        {fetching ? (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-[#1e3a8a]" />
          </div>
        ) : routes.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Truck size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No routes assigned</p>
            <p className="text-sm mt-1">Routes will appear here once assigned by admin.</p>
          </div>
        ) : (
          <>
            {activeRoutes.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active Routes ({activeRoutes.length})</h2>
                {activeRoutes.map((r) => <RouteCard key={r.id} route={r} projectStatus={projectStatusMap[r.projectId]} onUpdate={loadRoutes} />)}
              </div>
            )}
            {completedRoutes.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Completed ({completedRoutes.length})</h2>
                {completedRoutes.map((r) => <RouteCard key={r.id} route={r} projectStatus={projectStatusMap[r.projectId]} onUpdate={loadRoutes} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
