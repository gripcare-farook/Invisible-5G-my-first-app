import { useState } from "react";
import { Calculator, FolderOpen, Settings } from "lucide-react";
import CalculatorPage from "@/pages/CalculatorPage";
import ProjectsPage from "@/pages/ProjectsPage";
import SettingsPage from "@/pages/SettingsPage";
import { SavedProject } from "@/lib/storage";
import { Opening, SharedInputs } from "@/lib/calculations";

type Tab = "calculator" | "projects" | "settings";

export interface LoadedProject {
  id: string;
  name: string;
  notes?: string;
  openings: Opening[];
  shared: SharedInputs;
}

export default function App() {
  const [tab, setTab] = useState<Tab>("calculator");
  const [loadProject, setLoadProject] = useState<LoadedProject | null>(null);

  function handleLoadProject(p: SavedProject) {
    setLoadProject({ id: p.id, name: p.name, notes: p.notes, openings: p.openings, shared: p.shared });
    setTab("calculator");
  }

  function handleProjectLoaded() {
    setLoadProject(null);
  }

  return (
    <div className="min-h-screen flex flex-col max-w-xl mx-auto bg-background">
      <div className="flex-1 overflow-y-auto pb-20">
        {/* Keep Calculator always mounted to preserve form state across tab switches */}
        <div className={tab !== "calculator" ? "hidden" : ""}>
          <CalculatorPage
            isActive={tab === "calculator"}
            loadProject={loadProject}
            onProjectLoaded={handleProjectLoaded}
          />
        </div>
        {tab === "projects" && (
          <ProjectsPage onLoad={handleLoadProject} />
        )}
        {tab === "settings" && <SettingsPage />}
      </div>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-xl bg-white border-t border-border flex z-50">
        {(
          [
            { key: "calculator", label: "Calculator", Icon: Calculator },
            { key: "projects", label: "Projects", Icon: FolderOpen },
            { key: "settings", label: "Settings", Icon: Settings },
          ] as { key: Tab; label: string; Icon: typeof Calculator }[]
        ).map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
              tab === key
                ? "text-[#1e3a8a]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon size={22} strokeWidth={tab === key ? 2.5 : 1.8} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
