import { useEffect, useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import {
  Calculator, Truck, LogOut, Plus, Trash2, ChevronDown, ChevronUp,
  Phone, MapPin, Loader2, Bell, Users, TrendingUp, UserCheck, Briefcase,
} from "lucide-react";
import {
  PROJECT_STATUSES, PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS,
  type ProjectStatus,
} from "@/lib/storage";

interface Stats {
  transport: { total: number; completed: number; pending: number };
  leads: { total: number; open: number; converted: number };
  projects: { total: number; byStatus: Record<string, number> };
  users: Array<{ role: string; count: number }>;
}

interface Lead {
  id: number;
  name: string;
  phone: string;
  location: string;
  requirement: string;
  source: string;
  followUpDate: string | null;
  status: "new" | "contacted" | "interested" | "not_interested" | "converted" | "lost";
  notes: string;
  nextAction: string;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  clientName: string;
  siteLocation: string;
  notes: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

const LEAD_STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-yellow-100 text-yellow-800",
  interested: "bg-purple-100 text-purple-800",
  not_interested: "bg-gray-100 text-gray-600",
  converted: "bg-green-100 text-green-800",
  lost: "bg-red-100 text-red-700",
};

const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  interested: "Interested",
  not_interested: "Not Interested",
  converted: "Converted",
  lost: "Lost",
};

const EMPTY_LEAD = {
  name: "", phone: "", location: "", requirement: "",
  source: "", followUpDate: "", status: "new" as Lead["status"],
  notes: "", nextAction: "",
};

const EMPTY_PROJECT = {
  name: "", clientName: "", siteLocation: "", notes: "", status: "new" as ProjectStatus,
};

function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${PROJECT_STATUS_COLORS[status]}`}>
      {PROJECT_STATUS_LABELS[status]}
    </span>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <div className={`rounded-2xl p-4 ${color ?? "bg-white border border-border"}`}>
      <div className={`text-2xl font-bold ${color ? "text-white" : "text-foreground"}`}>{value}</div>
      <div className={`text-xs font-semibold mt-0.5 ${color ? "text-white/80" : "text-muted-foreground"}`}>{label}</div>
      {sub && <div className={`text-xs mt-0.5 ${color ? "text-white/60" : "text-muted-foreground"}`}>{sub}</div>}
    </div>
  );
}

function ProjectCard({
  project,
  onStatusChange,
  onDelete,
}: {
  project: Project;
  onStatusChange: (id: string, status: ProjectStatus) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  async function updateStatus(newStatus: ProjectStatus) {
    setSaving(true);
    const resp = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: newStatus }),
    });
    setSaving(false);
    if (resp.ok) onStatusChange(project.id, newStatus);
  }

  async function handleDelete() {
    if (!confirm(`Delete project "${project.name}"?`)) return;
    await fetch(`/api/projects/${project.id}`, { method: "DELETE", credentials: "include" });
    onDelete(project.id);
  }

  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-foreground truncate">{project.name}</span>
            <StatusBadge status={project.status} />
          </div>
          {(project.clientName || project.siteLocation) && (
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
              {project.clientName && <span className="flex items-center gap-1"><Phone size={11} />{project.clientName}</span>}
              {project.siteLocation && <span className="flex items-center gap-1"><MapPin size={11} />{project.siteLocation}</span>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 ml-2 shrink-0">
          {saving && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
          {expanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {project.notes && (
            <div className="text-sm"><span className="text-muted-foreground">Notes: </span>{project.notes}</div>
          )}

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Project Status
            </label>
            <select
              value={project.status}
              onChange={(e) => updateStatus(e.target.value as ProjectStatus)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40"
            >
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleDelete}
            className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-medium"
          >
            <Trash2 size={13} /> Delete project
          </button>
        </div>
      )}
    </div>
  );
}

function AddProjectForm({
  onSave,
  onCancel,
}: {
  onSave: (project: Project) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(EMPTY_PROJECT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(key: keyof typeof EMPTY_PROJECT, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Project name is required."); return; }
    setSaving(true);
    setError("");
    const resp = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(form),
    });
    const data = (await resp.json()) as { success: boolean; project?: Project };
    setSaving(false);
    if (data.success && data.project) {
      onSave(data.project);
    } else {
      setError("Failed to save project.");
    }
  }

  const inp = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40";

  return (
    <form onSubmit={handleSubmit} className="bg-[#1e3a8a]/5 border border-[#1e3a8a]/20 rounded-2xl p-4 space-y-3">
      <h3 className="font-semibold text-sm text-[#1e3a8a]">New Project</h3>
      <div className="space-y-2">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Project Name *</label>
          <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Ramesh Balcony Grille" className={inp} required />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Client Name</label>
            <input type="text" value={form.clientName} onChange={(e) => set("clientName", e.target.value)} placeholder="Client name" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Site Location</label>
            <input type="text" value={form.siteLocation} onChange={(e) => set("siteLocation", e.target.value)} placeholder="Area / address" className={inp} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Initial Status</label>
          <select value={form.status} onChange={(e) => set("status", e.target.value)} className={inp}>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Notes</label>
          <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Any notes…" className={`${inp} resize-none`} />
        </div>
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button type="button" onClick={onCancel} className="border border-border text-muted-foreground font-semibold rounded-xl py-2.5 text-sm hover:bg-muted">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="flex items-center justify-center gap-1.5 bg-[#1e3a8a] text-white font-semibold rounded-xl py-2.5 text-sm hover:bg-[#1e3a8a]/90 disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Save Project
        </button>
      </div>
    </form>
  );
}

function LeadCard({
  lead,
  onUpdate,
  onDelete,
}: {
  lead: Lead;
  onUpdate: (id: number, patch: Partial<Lead>) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState(lead.status);
  const [saving, setSaving] = useState(false);

  async function updateStatus(newStatus: Lead["status"]) {
    setSaving(true);
    setStatus(newStatus);
    await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: newStatus }),
    });
    setSaving(false);
    onUpdate(lead.id, { status: newStatus });
  }

  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-foreground truncate">{lead.name}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${LEAD_STATUS_COLORS[lead.status] ?? ""}`}>
              {LEAD_STATUS_LABELS[lead.status] ?? lead.status}
            </span>
          </div>
          {lead.phone && (
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Phone size={11} /> {lead.phone}
              {lead.location && <> · <MapPin size={11} /> {lead.location}</>}
            </div>
          )}
          {lead.followUpDate && (
            <div className="text-xs text-orange-600 mt-0.5">Follow-up: {lead.followUpDate}</div>
          )}
        </div>
        <div className="flex items-center gap-2 ml-2 shrink-0">
          {saving && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
          {expanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {lead.requirement && <div className="text-sm"><span className="text-muted-foreground">Requirement: </span>{lead.requirement}</div>}
          {lead.source && <div className="text-sm"><span className="text-muted-foreground">Source: </span>{lead.source}</div>}
          {lead.notes && <div className="text-sm"><span className="text-muted-foreground">Notes: </span>{lead.notes}</div>}
          {lead.nextAction && <div className="text-sm"><span className="text-muted-foreground">Next Action: </span>{lead.nextAction}</div>}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Update Status</label>
            <select
              value={status}
              onChange={(e) => updateStatus(e.target.value as Lead["status"])}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40"
            >
              {Object.entries(LEAD_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => onDelete(lead.id)}
            className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-medium"
          >
            <Trash2 size={13} /> Delete lead
          </button>
        </div>
      )}
    </div>
  );
}

function AddLeadForm({ onSave, onCancel }: { onSave: (lead: Lead) => void; onCancel: () => void }) {
  const [form, setForm] = useState(EMPTY_LEAD);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(key: keyof typeof EMPTY_LEAD, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name is required."); return; }
    setSaving(true);
    setError("");
    const resp = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(form),
    });
    const data = (await resp.json()) as { success: boolean; lead?: Lead };
    setSaving(false);
    if (data.success && data.lead) {
      onSave(data.lead);
    } else {
      setError("Failed to save lead.");
    }
  }

  const input = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40";

  return (
    <form onSubmit={handleSubmit} className="bg-[#1e3a8a]/5 border border-[#1e3a8a]/20 rounded-2xl p-4 space-y-3">
      <h3 className="font-semibold text-sm text-[#1e3a8a]">New Lead</h3>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Name *</label>
          <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Client name" className={input} required />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Phone</label>
          <input type="text" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Mobile" className={input} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Follow-up Date</label>
          <input type="date" value={form.followUpDate} onChange={(e) => set("followUpDate", e.target.value)} className={input} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Location</label>
          <input type="text" value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Area / address" className={input} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Requirement</label>
          <input type="text" value={form.requirement} onChange={(e) => set("requirement", e.target.value)} placeholder="Balcony, window…" className={input} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Source</label>
          <input type="text" value={form.source} onChange={(e) => set("source", e.target.value)} placeholder="WhatsApp, referral…" className={input} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Notes</label>
          <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Any notes…" className={`${input} resize-none`} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Next Action</label>
          <input type="text" value={form.nextAction} onChange={(e) => set("nextAction", e.target.value)} placeholder="Call tomorrow, send quote…" className={input} />
        </div>
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button type="button" onClick={onCancel} className="border border-border text-muted-foreground font-semibold rounded-xl py-2.5 text-sm hover:bg-muted">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="flex items-center justify-center gap-1.5 bg-[#1e3a8a] text-white font-semibold rounded-xl py-2.5 text-sm hover:bg-[#1e3a8a]/90 disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Save Lead
        </button>
      </div>
    </form>
  );
}

export default function AdminDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showAddLead, setShowAddLead] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [leadFilter, setLeadFilter] = useState<"all" | Lead["status"]>("all");
  const [projectFilter, setProjectFilter] = useState<"all" | ProjectStatus>("all");
  const [activeTab, setActiveTab] = useState<"projects" | "leads">("projects");

  useEffect(() => {
    if (!user) { navigate("/login", { replace: true }); return; }
    if (user.role !== "admin") { navigate("/login", { replace: true }); return; }
    void fetchStats();
    void fetchLeads();
    void fetchProjects();
  }, [user, navigate]);

  async function fetchStats() {
    setLoadingStats(true);
    try {
      const resp = await fetch("/api/admin/stats", { credentials: "include" });
      const data = (await resp.json()) as { success: boolean; stats: Stats };
      if (data.success) setStats(data.stats);
    } finally {
      setLoadingStats(false);
    }
  }

  async function fetchLeads() {
    setLoadingLeads(true);
    try {
      const resp = await fetch("/api/leads", { credentials: "include" });
      const data = (await resp.json()) as { success: boolean; leads: Lead[] };
      if (data.success) setLeads(data.leads);
    } finally {
      setLoadingLeads(false);
    }
  }

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

  function handleLeadAdded(lead: Lead) { setLeads((prev) => [lead, ...prev]); setShowAddLead(false); }
  function handleLeadUpdated(id: number, patch: Partial<Lead>) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }
  async function handleLeadDeleted(id: number) {
    await fetch(`/api/leads/${id}`, { method: "DELETE", credentials: "include" });
    setLeads((prev) => prev.filter((l) => l.id !== id));
  }

  function handleProjectAdded(project: Project) { setProjects((prev) => [project, ...prev]); setShowAddProject(false); }
  function handleProjectStatusChange(id: string, status: ProjectStatus) {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
  }
  function handleProjectDeleted(id: string) { setProjects((prev) => prev.filter((p) => p.id !== id)); }

  const filteredLeads = leadFilter === "all" ? leads : leads.filter((l) => l.status === leadFilter);
  const filteredProjects = projectFilter === "all" ? projects : projects.filter((p) => p.status === projectFilter);
  const openLeads = leads.filter((l) => ["new", "contacted", "interested"].includes(l.status));

  const projectStatusCounts = PROJECT_STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = projects.filter((p) => p.status === s).length;
    return acc;
  }, {});

  if (!user) return null;

  const tabCls = (t: "projects" | "leads") =>
    `flex-1 text-sm font-semibold py-2.5 rounded-xl transition-colors ${activeTab === t ? "bg-[#1e3a8a] text-white" : "text-muted-foreground hover:text-foreground"}`;

  return (
    <div className="min-h-screen bg-background max-w-xl mx-auto">
      <div className="bg-[#1e3a8a] text-white px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">5G Grille Admin</h1>
          <p className="text-blue-200 text-xs">Welcome, {user.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/calculator")}
            className="flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg font-medium"
          >
            <Calculator size={13} /> Calc
          </button>
          <button
            onClick={() => navigate("/transport")}
            className="flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg font-medium"
          >
            <Truck size={13} /> Transport
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg font-medium"
          >
            <LogOut size={13} /> Out
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-5 pb-10">
        {loadingStats ? (
          <div className="flex justify-center py-6"><Loader2 size={24} className="animate-spin text-[#1e3a8a]" /></div>
        ) : stats ? (
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Projects" value={projects.length} sub={`${projectStatusCounts["in_progress"] ?? 0} active`} color="bg-[#1e3a8a]" />
            <StatCard label="Leads" value={stats.leads.total} sub={`${stats.leads.open} open`} color="bg-indigo-500" />
            <StatCard label="Converted" value={stats.leads.converted} sub="leads" color="bg-green-600" />
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-2 text-xs">
          {[
            { icon: <Truck size={16} />, label: "Transport", path: "/transport" },
            { icon: <Users size={16} />, label: "Calculator", path: "/calculator" },
            { icon: <TrendingUp size={16} />, label: "Refresh", action: () => { void fetchStats(); void fetchLeads(); void fetchProjects(); } },
          ].map((item) => (
            <button
              key={item.label}
              onClick={item.action ?? (() => navigate(item.path!))}
              className="flex flex-col items-center gap-1.5 bg-white border border-border rounded-xl py-3 font-medium text-muted-foreground hover:border-[#1e3a8a]/40 hover:text-[#1e3a8a] transition-colors"
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 bg-muted rounded-2xl p-1">
          <button onClick={() => setActiveTab("projects")} className={tabCls("projects")}>
            <Briefcase size={14} className="inline mr-1" />Projects ({projects.length})
          </button>
          <button onClick={() => setActiveTab("leads")} className={tabCls("leads")}>
            <UserCheck size={14} className="inline mr-1" />Leads
            {openLeads.length > 0 && (
              <span className="ml-1.5 text-xs bg-orange-400 text-white font-bold px-1.5 py-0.5 rounded-full">{openLeads.length}</span>
            )}
          </button>
        </div>

        {activeTab === "projects" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm text-foreground">Projects</h2>
              <button
                onClick={() => setShowAddProject(true)}
                className="flex items-center gap-1 text-xs bg-[#1e3a8a] text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-[#1e3a8a]/90"
              >
                <Plus size={13} /> Add Project
              </button>
            </div>

            {showAddProject && (
              <AddProjectForm onSave={handleProjectAdded} onCancel={() => setShowAddProject(false)} />
            )}

            <div className="flex gap-1.5 flex-wrap">
              {(["all", ...PROJECT_STATUSES] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setProjectFilter(s)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                    projectFilter === s
                      ? "bg-[#1e3a8a] text-white border-[#1e3a8a]"
                      : "bg-white text-muted-foreground border-border hover:border-[#1e3a8a]/40"
                  }`}
                >
                  {s === "all"
                    ? `All (${projects.length})`
                    : `${PROJECT_STATUS_LABELS[s]} (${projectStatusCounts[s] ?? 0})`}
                </button>
              ))}
            </div>

            {loadingProjects ? (
              <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-[#1e3a8a]" /></div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Briefcase size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">No projects yet</p>
                <p className="text-xs mt-1">Add a project to track its lifecycle.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onStatusChange={handleProjectStatusChange}
                    onDelete={handleProjectDeleted}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "leads" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm text-foreground flex items-center gap-2">
                <UserCheck size={16} className="text-[#1e3a8a]" />
                Lead Follow-ups
                {openLeads.length > 0 && (
                  <span className="text-xs bg-orange-100 text-orange-700 font-semibold px-2 py-0.5 rounded-full">{openLeads.length} open</span>
                )}
              </h2>
              <button
                onClick={() => setShowAddLead(true)}
                className="flex items-center gap-1 text-xs bg-[#1e3a8a] text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-[#1e3a8a]/90"
              >
                <Plus size={13} /> Add Lead
              </button>
            </div>

            {showAddLead && (
              <AddLeadForm onSave={handleLeadAdded} onCancel={() => setShowAddLead(false)} />
            )}

            <div className="flex gap-1.5 flex-wrap">
              {(["all", "new", "contacted", "interested", "not_interested", "converted", "lost"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setLeadFilter(s)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                    leadFilter === s
                      ? "bg-[#1e3a8a] text-white border-[#1e3a8a]"
                      : "bg-white text-muted-foreground border-border hover:border-[#1e3a8a]/40"
                  }`}
                >
                  {s === "all" ? `All (${leads.length})` : LEAD_STATUS_LABELS[s]}
                </button>
              ))}
            </div>

            {loadingLeads ? (
              <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-[#1e3a8a]" /></div>
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Bell size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">No leads yet</p>
                <p className="text-xs mt-1">Add a lead to track follow-ups.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLeads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onUpdate={handleLeadUpdated}
                    onDelete={handleLeadDeleted}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
