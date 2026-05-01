import { useState, useEffect } from "react";
import { Trash2, FolderOpen } from "lucide-react";
import { SavedProject, loadProjects, deleteProject } from "@/lib/storage";
import { fmtINR, fmtNum, calculateProject } from "@/lib/calculations";

interface Props {
  onLoad: (p: SavedProject) => void;
}

export default function ProjectsPage({ onLoad }: Props) {
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    setProjects(loadProjects());
  }, []);

  function handleDelete(id: string) {
    deleteProject(id);
    setProjects(loadProjects());
    setConfirmId(null);
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="bg-[#1e3a8a] text-white rounded-2xl px-4 py-4">
        <h1 className="text-lg font-bold">Saved Projects</h1>
        <p className="text-blue-200 text-xs">{projects.length} project{projects.length !== 1 ? "s" : ""} saved</p>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FolderOpen size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No saved projects yet.</p>
          <p className="text-xs mt-1">Save a project from the Calculator tab.</p>
        </div>
      ) : (
        projects.map((p) => {
          let totalCost = 0;
          let totalSqft = 0;
          try {
            const t = calculateProject(p.openings, p.shared);
            totalCost = t.totalCost;
            totalSqft = t.totalSqft;
          } catch {
            // ignore
          }

          const date = new Date(p.updatedAt).toLocaleDateString("en-IN", {
            day: "numeric", month: "short", year: "numeric",
          });

          return (
            <div key={p.id} className="bg-white rounded-2xl border border-border overflow-hidden">
              <div className="px-4 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-foreground truncate">{p.name}</h3>
                    {p.shared.clientName && (
                      <p className="text-xs text-muted-foreground mt-0.5">{p.shared.clientName}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">{date}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmId(confirmId === p.id ? null : p.id)}
                    className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="flex gap-3 mt-3 text-sm">
                  <div className="flex-1 bg-muted rounded-lg p-2.5">
                    <div className="text-xs text-muted-foreground">Area</div>
                    <div className="font-semibold">{fmtNum(totalSqft)} sqft</div>
                  </div>
                  <div className="flex-1 bg-[#1e3a8a] rounded-lg p-2.5 text-white">
                    <div className="text-xs text-blue-200">Total Cost</div>
                    <div className="font-semibold">{fmtINR(totalCost)}</div>
                  </div>
                  <div className="flex-1 bg-muted rounded-lg p-2.5">
                    <div className="text-xs text-muted-foreground">Openings</div>
                    <div className="font-semibold">{p.openings.length}</div>
                  </div>
                </div>

                {confirmId === p.id ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      className="flex-1 bg-destructive text-white text-sm font-semibold rounded-xl py-2.5 hover:opacity-90"
                    >
                      Confirm Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      className="flex-1 bg-muted text-foreground text-sm font-semibold rounded-xl py-2.5 hover:opacity-90"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onLoad(p)}
                    className="mt-3 w-full bg-[#1e3a8a] text-white text-sm font-semibold rounded-xl py-2.5 hover:bg-[#1e3a8a]/90 transition-colors"
                  >
                    Load Project
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
