import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { HardHat, LogOut, Calendar, Briefcase, IndianRupee, Loader2 } from "lucide-react";

export default function LabourDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) { navigate("/login", { replace: true }); return; }
    if (user.role !== "labour_contractor") { navigate("/login", { replace: true }); }
  }, [user, navigate]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#1e3a8a]" />
      </div>
    );
  }

  const today = new Date();
  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const currentDay = today.getDay();

  return (
    <div className="min-h-screen bg-background max-w-xl mx-auto">
      <div className="bg-[#1e3a8a] text-white px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <HardHat size={20} /> Labour Dashboard
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
            <Calendar size={16} className="text-[#1e3a8a]" />
            <h2 className="font-bold text-sm">This Week</h2>
          </div>
          <div className="flex gap-1.5">
            {weekDays.map((day, i) => {
              const dayNum = i + 1;
              const isToday = currentDay === dayNum;
              const isPast = currentDay > dayNum;
              return (
                <div
                  key={day}
                  className={`flex-1 rounded-xl py-2 text-center text-xs font-semibold ${
                    isToday
                      ? "bg-[#1e3a8a] text-white"
                      : isPast
                      ? "bg-green-100 text-green-700"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {day}
                  <div className={`text-xs mt-0.5 ${isToday ? "text-blue-200" : isPast ? "text-green-600" : "text-muted-foreground"}`}>
                    {isPast ? "✓" : isToday ? "Today" : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-border rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <IndianRupee size={16} className="text-[#1e3a8a]" />
            <h2 className="font-bold text-sm">Payment Summary</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-foreground">—</div>
              <div className="text-xs text-muted-foreground">This week</div>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-green-700">—</div>
              <div className="text-xs text-muted-foreground">Received</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center pt-1">
            Payment data appears once projects are synced from admin.
          </p>
        </div>

        <div className="bg-white border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Briefcase size={16} className="text-[#1e3a8a]" />
            <h2 className="font-bold text-sm">Assigned Projects</h2>
          </div>
          <div className="text-center py-8 text-muted-foreground">
            <Briefcase size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No projects assigned</p>
            <p className="text-xs mt-1">Projects will appear here once assigned by admin.</p>
          </div>
        </div>

        <div className="bg-white border border-border rounded-2xl p-4">
          <h2 className="font-bold text-sm mb-3">Completed Projects</h2>
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-xs">Finished project details will appear here.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
