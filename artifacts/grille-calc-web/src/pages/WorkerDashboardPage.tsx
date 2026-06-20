import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { Wrench, LogOut, ClipboardList, MapPin, Loader2 } from "lucide-react";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS, type ProjectStatus } from "@/lib/storage";

interface Project {
  id: string;
  name: string;
  clientName: string;
  siteLocation: string;
  notes: string;
  status: ProjectStatus;
}

export default function WorkerDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  useEffect(() => {
    if (!user) { navigate("/login", { replace: true }); return; }
    if (user.role !== "labour_worker") { navigate("/login", { replace: true }); return; }
    void fetchProjects();
  }, [user, navigate]);

  async function fetchProjects() {
    setLoadingProjects(true);
    try {
      const resp = await fetch("/api/projects", { credentials: "include" });
      const data = (await resp.json()) as { success: boolean; projects: Project[] };
      if (data.success) setProjects(data.projects);
    } finally {
      setLoadingProjects(false);
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#1e3a8a]" />
      </div>
    );
  }

  const activeProjects = projects.filter((p) => p.status === "in_progress");
  const assignedProjects = projects.filter((p) => p.status === "assigned");

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

          {loadingProjects ? (
            <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-[#1e3a8a]" /></div>
          ) : activeProjects.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <ClipboardList size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No active tasks today</p>
              <p className="text-xs mt-1">Your contractor will assign work here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeProjects.map((p) => (
                <div key={p.id} className="border border-orange-200 bg-orange-50 rounded-xl px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-foreground truncate">{p.name}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${PROJECT_STATUS_COLORS[p.status]}`}>
                      {PROJECT_STATUS_LABELS[p.status]}
                    </span>
                  </div>
                  {p.siteLocation && (
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-0.5">
                      <MapPin size={10} />{p.siteLocation}
                    </div>
                  )}
                  {p.notes && <p className="text-xs text-muted-foreground mt-1">{p.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {assignedProjects.length > 0 && (
          <div className="bg-white border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={16} className="text-[#1e3a8a]" />
              <h2 className="font-bold text-sm">Upcoming Sites</h2>
            </div>
            <div className="space-y-2">
              {assignedProjects.map((p) => (
                <div key={p.id} className="border border-purple-200 bg-purple-50 rounded-xl px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-foreground truncate">{p.name}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${PROJECT_STATUS_COLORS[p.status]}`}>
                      {PROJECT_STATUS_LABELS[p.status]}
                    </span>
                  </div>
                  {p.siteLocation && (
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-0.5">
                      <MapPin size={10} />{p.siteLocation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-[#1e3a8a]/5 border border-[#1e3a8a]/20 rounded-2xl p-4">
          <h2 className="font-bold text-sm text-[#1e3a8a] mb-2">Work Status</h2>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Active sites</span>
              <span className="font-semibold text-orange-600">{activeProjects.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Upcoming</span>
              <span className="font-semibold text-purple-600">{assignedProjects.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
