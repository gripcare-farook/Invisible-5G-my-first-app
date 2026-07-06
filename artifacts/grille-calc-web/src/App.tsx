import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Calculator, FileText, FolderOpen, Settings, Truck, LogIn, Loader2 } from "lucide-react";
import CalculatorPage from "@/pages/CalculatorPage";
import ProjectsPage from "@/pages/ProjectsPage";
import SettingsPage from "@/pages/SettingsPage";
import OcrUploadPage from "@/pages/OcrUploadPage";
import LoginPage from "@/pages/LoginPage";
import TransportPage from "@/pages/TransportPage";
import AdminDashboardPage from "@/pages/AdminDashboardPage";
import LabourDashboardPage from "@/pages/LabourDashboardPage";
import WorkerDashboardPage from "@/pages/WorkerDashboardPage";
import { AuthProvider, useAuth, roleDashboard } from "@/lib/auth-context";
import { SavedProject } from "@/lib/storage";
import { Opening, SharedInputs } from "@/lib/calculations";
import { TransportData } from "@/lib/transport";

type Tab = "calculator" | "projects" | "ocr" | "settings";

export interface LoadedProject {
  id: string;
  name: string;
  notes?: string;
  openings: Opening[];
  shared: SharedInputs;
  transportData?: TransportData;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) navigate("/login", { replace: true });
      else navigate(roleDashboard(user.role), { replace: true });
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-[#1e3a8a]" />
    </div>
  );
}

function MainApp() {
  const location = useLocation();
  const [tab, setTab] = useState<Tab>(() => (location.pathname === "/ocr" ? "ocr" : "calculator"));
  const [loadProject, setLoadProject] = useState<LoadedProject | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  function handleLoadProject(p: SavedProject) {
    setLoadProject({
      id: p.id,
      name: p.name,
      notes: p.notes,
      openings: p.openings,
      shared: p.shared,
      transportData: p.transportData,
    });
    setTab("calculator");
  }

  function handleProjectLoaded() {
    setLoadProject(null);
  }

  return (
    <div className="min-h-screen flex flex-col max-w-xl mx-auto bg-background">
      <div className="flex-1 overflow-y-auto pb-20">
        <div className={tab !== "calculator" ? "hidden" : ""}>
          <CalculatorPage
            isActive={tab === "calculator"}
            loadProject={loadProject}
            onProjectLoaded={handleProjectLoaded}
          />
        </div>
        {tab === "projects" && <ProjectsPage onLoad={handleLoadProject} />}
        {tab === "ocr" && <OcrUploadPage />}
        {tab === "settings" && <SettingsPage />}
      </div>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-xl bg-white border-t border-border flex z-50">
        {(
          [
            { key: "calculator", label: "Calculator", Icon: Calculator },
            { key: "projects", label: "Projects", Icon: FolderOpen },
            { key: "ocr", label: "OCR", Icon: FileText },
            { key: "settings", label: "Settings", Icon: Settings },
          ] as { key: Tab; label: string; Icon: typeof Calculator }[]
        ).map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
              tab === key ? "text-[#1e3a8a]" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon size={22} strokeWidth={tab === key ? 2.5 : 1.8} />
            {label}
          </button>
        ))}
        {user ? (
          <button
            onClick={() => navigate(roleDashboard(user.role))}
            className="flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium text-muted-foreground hover:text-[#1e3a8a] transition-colors"
          >
            <Truck size={22} strokeWidth={1.8} />
            Dashboard
          </button>
        ) : (
          <button
            onClick={() => navigate("/login")}
            className="flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogIn size={22} strokeWidth={1.8} />
            Login
          </button>
        )}
      </nav>
    </div>
  );
}

export default function App() {
  const basename = import.meta.env.BASE_URL.replace(/\/+$/, "");
  return (
    <BrowserRouter basename={basename}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/calculator" element={<MainApp />} />
          <Route path="/ocr" element={<MainApp />} />
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/transport" element={<TransportPage />} />
          <Route path="/labour" element={<LabourDashboardPage />} />
          <Route path="/worker" element={<WorkerDashboardPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
