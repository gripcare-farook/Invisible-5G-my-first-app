import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { Wrench, LogOut, ClipboardList, MapPin, Loader2 } from "lucide-react";

export default function WorkerDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) { navigate("/login", { replace: true }); return; }
    if (user.role !== "labour_worker") { navigate("/login", { replace: true }); }
  }, [user, navigate]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#1e3a8a]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background max-w-xl mx-auto">
      <div className="bg-[#1e3a8a] text-white px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Wrench size={20} /> My Tasks
          </h1>
          <p className="text-blue-200 text-xs">Welcome, {user.name}</p>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg font-medium"
        >
          <LogOut size={13} /> Sign Out
        </button>
      </div>

      <div className="px-4 py-4 space-y-4 pb-10">
        <div className="bg-white border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList size={16} className="text-[#1e3a8a]" />
            <h2 className="font-bold text-sm">Today's Work</h2>
            <span className="text-xs text-muted-foreground ml-auto">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
            </span>
          </div>
          <div className="text-center py-10 text-muted-foreground">
            <ClipboardList size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No tasks assigned today</p>
            <p className="text-xs mt-1">Your contractor will assign work here.</p>
          </div>
        </div>

        <div className="bg-white border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={16} className="text-[#1e3a8a]" />
            <h2 className="font-bold text-sm">Site Locations</h2>
          </div>
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-xs">Site addresses will appear once projects are assigned.</p>
          </div>
        </div>

        <div className="bg-[#1e3a8a]/5 border border-[#1e3a8a]/20 rounded-2xl p-4">
          <h2 className="font-bold text-sm text-[#1e3a8a] mb-2">Work Status</h2>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>This week</span>
              <span className="font-semibold text-foreground">—</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Completed sites</span>
              <span className="font-semibold text-green-600">0</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Pending sites</span>
              <span className="font-semibold text-orange-600">0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
