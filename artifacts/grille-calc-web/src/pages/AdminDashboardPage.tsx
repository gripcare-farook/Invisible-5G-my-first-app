import { useEffect, useState, FormEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { QuotationPreview } from "@/components/QuotationPreview";
import {
  Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Calculator, Truck, LogOut, Plus, Trash2, ChevronDown, ChevronUp,
  Phone, MapPin, Loader2, Bell, Users, TrendingUp, UserCheck, Briefcase,
  Clock, FolderKanban, RefreshCw,
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
  clientMobile: string;
  siteLocation: string;
  notes: string;
  status: ProjectStatus;
  totalAmount: string;
  advanceAmount: string;
  receivedAmount: string;
  balanceAmount: string;
  paymentStatus: PaymentStatus;
  receivedDate: string | null;
  paymentNotes: string;
  createdAt: string;
  updatedAt: string;
}

interface ActivityLog {
  id: number;
  actorId: number;
  actorName: string;
  actorRole: string;
  action: string;
  projectId: string | null;
  message: string;
  createdAt: string;
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
  name: "", clientName: "", clientMobile: "", siteLocation: "", notes: "", status: "new" as ProjectStatus,
};

type PaymentStatus = "unpaid" | "partial" | "paid";

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  partial: "Partial",
  paid: "Paid",
};

const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  unpaid: "bg-red-100 text-red-700",
  partial: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
};

const QUOTATION_COMPANY = {
  name: "5G Invisible Grille",
  email: "5ginvisiblegrille@gmail.com",
  mobile: "+91 86800 72597, +91 74488 88221",
};

async function readApiError(resp: Response, fallback: string): Promise<string> {
  try {
    const data = (await resp.json()) as { success?: boolean; error?: string; message?: string };
    return data.error || data.message || fallback;
  } catch {
    return fallback;
  }
}

function cleanMobile(value: string): string {
  return value.replace(/\D/g, "");
}

function moneyValue(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fmtMoney(value: string | number | null | undefined): string {
  return `Rs. ${moneyValue(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function textOrDash(value: string): string {
  return value.trim() || "-";
}

function quotationShareText(project: Project): string {
  return [
    `Quotation from ${QUOTATION_COMPANY.name}`,
    `Project: ${textOrDash(project.name)}`,
    `Client: ${textOrDash(project.clientName)}`,
    `Site: ${textOrDash(project.siteLocation)}`,
    `Total amount: ${fmtMoney(project.totalAmount)}`,
    `Balance: ${fmtMoney(project.balanceAmount)}`,
    `Contact: ${QUOTATION_COMPANY.mobile}`,
    `Email: ${QUOTATION_COMPANY.email}`,
  ].join("\n");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]!);
}

function quotationPrintHtml(project: Project): string {
  const quotation = renderToStaticMarkup(<QuotationPreview project={project} />);
  const title = escapeHtml(`Quotation - ${project.name}`);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <base href="${window.location.origin}/" />
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #0f172a; font-family: Inter, Arial, sans-serif; }
    #quotation-print-root { width: 100%; max-width: none; min-height: 0; margin: 0; padding: 4mm; background: #fff; }
    header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; border-bottom: 2px solid #1e3a8a; padding-bottom: 20px; }
    header > div:first-child { display: flex; align-items: flex-start; gap: 16px; }
    img { width: 64px; height: 64px; object-fit: contain; }
    h1 { margin: 0; color: #1e3a8a; font-size: 24px; line-height: 32px; font-weight: 700; }
    h2 { margin: 0; color: #0f172a; font-size: 20px; line-height: 28px; font-weight: 700; text-transform: uppercase; letter-spacing: .025em; }
    h3 { margin: 0 0 8px; color: #1e3a8a; font-size: 14px; line-height: 20px; font-weight: 700; text-transform: uppercase; letter-spacing: .025em; }
    p { margin: 0; }
    header p { color: #475569; font-size: 12px; line-height: 1.625; }
    header p:first-of-type { margin-top: 4px; max-width: 384px; }
    header p:nth-of-type(2) { margin-top: 8px; color: #334155; }
    header > div:last-child { text-align: right; }
    header > div:last-child p { margin-top: 4px; font-size: 14px; line-height: 20px; }
    section { margin-top: 24px; }
    section:first-of-type { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    dl, section > div, ol { border: 1px solid #e2e8f0; border-radius: 8px; }
    dl { margin: 0; padding: 0 16px; }
    dl > div { display: flex; justify-content: space-between; gap: 16px; border-bottom: 1px solid #e2e8f0; padding: 8px 0; font-size: 14px; line-height: 20px; }
    dl > div:last-child { border-bottom: 0; }
    dt { color: #64748b; font-weight: 500; }
    dd { margin: 0; color: #0f172a; font-weight: 600; text-align: right; }
    section:nth-of-type(2) > div { min-height: 80px; padding: 16px; color: #334155; font-size: 14px; line-height: 1.625; }
    ol { margin: 0; padding: 16px 16px 16px 32px; color: #334155; font-size: 14px; line-height: 1.625; }
    footer { margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px; color: #475569; text-align: center; font-size: 12px; line-height: 1.625; }
    footer p:first-child { color: #0f172a; font-weight: 600; }
    @media print {
      html, body, #quotation-print-root { width: 100%; overflow: visible; }
    }
  </style>
</head>
<body>
  ${quotation}
  <script>
    let printed = false;
    function printNow() {
      if (printed) return;
      printed = true;
      window.focus();
      window.print();
    }
    window.onafterprint = () => window.close();
    const logo = document.querySelector("img");
    if (logo && !logo.complete) {
      logo.addEventListener("load", printNow, { once: true });
      logo.addEventListener("error", printNow, { once: true });
      setTimeout(printNow, 1000);
    } else {
      setTimeout(printNow, 50);
    }
  </script>
</body>
</html>`;
}

function printQuotation(project: Project): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow pop-ups to print the quotation.");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(quotationPrintHtml(project));
  printWindow.document.close();
}

function dateInputValue(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${PROJECT_STATUS_COLORS[status]}`}>
      {PROJECT_STATUS_LABELS[status]}
    </span>
  );
}

function PaymentBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${PAYMENT_STATUS_COLORS[status]}`}>
      {PAYMENT_STATUS_LABELS[status]}
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
  onUpdate,
  onDelete,
}: {
  project: Project;
  onUpdate: (id: string, patch: Partial<Project>) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [quotationOpen, setQuotationOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [paymentForm, setPaymentForm] = useState({
    totalAmount: project.totalAmount ?? "0",
    advanceAmount: project.advanceAmount ?? "0",
    receivedAmount: project.receivedAmount ?? "0",
    receivedDate: dateInputValue(project.receivedDate),
    paymentNotes: project.paymentNotes ?? "",
  });

  useEffect(() => {
    setPaymentForm({
      totalAmount: project.totalAmount ?? "0",
      advanceAmount: project.advanceAmount ?? "0",
      receivedAmount: project.receivedAmount ?? "0",
      receivedDate: dateInputValue(project.receivedDate),
      paymentNotes: project.paymentNotes ?? "",
    });
  }, [project]);

  async function updateStatus(newStatus: ProjectStatus) {
    setSaving(true);
    const resp = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: newStatus }),
    });
    setSaving(false);
    if (resp.ok) {
      const data = (await resp.json()) as { success: boolean; project?: Project };
      onUpdate(project.id, data.project ?? { status: newStatus });
    }
  }

  function setPayment(key: keyof typeof paymentForm, value: string) {
    setPaymentForm((prev) => ({ ...prev, [key]: value }));
  }

  async function savePayment(e: FormEvent) {
    e.preventDefault();
    const totalAmount = moneyValue(paymentForm.totalAmount);
    const advanceAmount = moneyValue(paymentForm.advanceAmount);
    const receivedAmount = moneyValue(paymentForm.receivedAmount);
    if (totalAmount < 0 || advanceAmount < 0 || receivedAmount < 0) {
      setPaymentError("Amounts cannot be negative.");
      return;
    }
    if (receivedAmount > totalAmount) {
      setPaymentError("Received amount cannot exceed total amount.");
      return;
    }

    setPaymentSaving(true);
    setPaymentError("");
    const resp = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        totalAmount,
        advanceAmount,
        receivedAmount,
        receivedDate: paymentForm.receivedDate,
        paymentNotes: paymentForm.paymentNotes,
      }),
    });
    setPaymentSaving(false);
    if (!resp.ok) {
      setPaymentError(await readApiError(resp, "Unable to update payment."));
      return;
    }
    const data = (await resp.json()) as { success: boolean; project?: Project; error?: string; message?: string };
    if (data.success && data.project) {
      onUpdate(project.id, data.project);
    } else {
      setPaymentError(data.error || data.message || "Unable to update payment.");
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete project "${project.name}"?`)) return;
    await fetch(`/api/projects/${project.id}`, { method: "DELETE", credentials: "include" });
    onDelete(project.id);
  }

  async function handleShareQuotation() {
    const text = quotationShareText(project);
    if (navigator.share) {
      await navigator.share({ title: `Quotation - ${project.name}`, text }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(text);
    setShareMessage("Share text copied.");
    window.setTimeout(() => setShareMessage(""), 2500);
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
            <PaymentBadge status={project.paymentStatus} />
          </div>
          {(project.clientName || project.clientMobile || project.siteLocation) && (
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
              {project.clientName && <span>{project.clientName}</span>}
              {project.clientMobile && <span className="flex items-center gap-1"><Phone size={11} />{project.clientMobile}</span>}
              {project.siteLocation && <span className="flex items-center gap-1"><MapPin size={11} />{project.siteLocation}</span>}
            </div>
          )}
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
            <span>Received {fmtMoney(project.receivedAmount)}</span>
            <span>Pending {fmtMoney(project.balanceAmount)}</span>
          </div>
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
            onClick={() => setQuotationOpen(true)}
            className="w-full rounded-xl bg-[#1e3a8a] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#1e3a8a]/90"
          >
            Quotation
          </button>

          <form onSubmit={savePayment} className="border border-border rounded-xl p-3 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-sm text-foreground">Payment Details</h3>
              <PaymentBadge status={project.paymentStatus} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-2">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Total Amount</label>
                <input type="number" min="0" step="0.01" inputMode="decimal" value={paymentForm.totalAmount} onChange={(e) => setPayment("totalAmount", e.target.value)} className="w-full border border-border rounded-lg px-3 py-2.5 sm:py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Advance Amount</label>
                <input type="number" min="0" step="0.01" inputMode="decimal" value={paymentForm.advanceAmount} onChange={(e) => setPayment("advanceAmount", e.target.value)} className="w-full border border-border rounded-lg px-3 py-2.5 sm:py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Received Amount</label>
                <input type="number" min="0" step="0.01" inputMode="decimal" value={paymentForm.receivedAmount} onChange={(e) => setPayment("receivedAmount", e.target.value)} className="w-full border border-border rounded-lg px-3 py-2.5 sm:py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Balance</label>
                <div className="w-full border border-border rounded-lg px-3 py-2.5 sm:py-2 text-sm bg-white text-muted-foreground">
                  {fmtMoney(Math.max(0, moneyValue(paymentForm.totalAmount) - moneyValue(paymentForm.receivedAmount)))}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Received Date</label>
                <input type="date" value={paymentForm.receivedDate} onChange={(e) => setPayment("receivedDate", e.target.value)} className="w-full border border-border rounded-lg px-3 py-2.5 sm:py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Payment Notes</label>
                <textarea value={paymentForm.paymentNotes} onChange={(e) => setPayment("paymentNotes", e.target.value)} rows={2} placeholder="UPI, cash, bank transfer, pending reason..." className="w-full border border-border rounded-lg px-3 py-2.5 sm:py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40 resize-none" />
              </div>
            </div>
            {paymentError && <div className="text-sm text-red-600">{paymentError}</div>}
            <button type="submit" disabled={paymentSaving} className="w-full flex items-center justify-center gap-1.5 bg-[#1e3a8a] text-white font-semibold rounded-xl py-2.5 text-sm hover:bg-[#1e3a8a]/90 disabled:opacity-50">
              {paymentSaving ? <Loader2 size={14} className="animate-spin" /> : null} Save Payment
            </button>
          </form>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center justify-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-medium sm:justify-start"
            >
              <Trash2 size={13} /> Delete project
            </button>
          </div>

          <Dialog open={quotationOpen} onOpenChange={setQuotationOpen}>
            <DialogContent className="quotation-print-shell w-[calc(100vw-1rem)] max-w-5xl max-h-[90vh] gap-0 overflow-hidden p-0">
              <DialogHeader className="border-b border-border px-4 py-3 text-left">
                <DialogTitle className="text-base">Quotation Preview</DialogTitle>
              </DialogHeader>
              <div className="quotation-print-wrapper max-h-[calc(90vh-7rem)] overflow-auto bg-slate-100 p-2 sm:p-4">
                <QuotationPreview project={project} />
              </div>
              <div className="quotation-print-ui border-t border-border px-4 py-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                  <button
                    type="button"
                    onClick={() => printQuotation(project)}
                    className="rounded-xl bg-[#1e3a8a] px-3 py-2 text-sm font-semibold text-white hover:bg-[#1e3a8a]/90"
                  >
                    Print / Save as PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleShareQuotation()}
                    className="rounded-xl border border-[#1e3a8a]/30 px-3 py-2 text-sm font-semibold text-[#1e3a8a] hover:bg-[#1e3a8a]/5"
                  >
                    Share
                  </button>
                  {shareMessage && <div className="text-center text-xs font-medium text-green-700 sm:text-left">{shareMessage}</div>}
                </div>
                <DialogClose className="mt-2 w-full rounded-xl border border-border px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted sm:w-auto">
                  Close
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>
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
    const mobile = cleanMobile(form.clientMobile);
    if (mobile && mobile.length !== 10) { setError("Client mobile number must be 10 digits."); return; }
    setSaving(true);
    setError("");
    const resp = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ...form, clientMobile: mobile }),
    });
    if (!resp.ok) {
      setError(await readApiError(resp, "Unable to save project. Please try again."));
      setSaving(false);
      return;
    }
    const data = (await resp.json()) as { success: boolean; project?: Project; error?: string; message?: string };
    setSaving(false);
    if (data.success && data.project) {
      onSave(data.project);
    } else {
      setError(data.error || data.message || "Unable to save project. Please try again.");
    }
  }

  const inp = "w-full border border-border rounded-lg px-3 py-2.5 sm:py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40";

  return (
    <form onSubmit={handleSubmit} className="bg-[#1e3a8a]/5 border border-[#1e3a8a]/20 rounded-2xl p-4 space-y-3">
      <h3 className="font-semibold text-sm text-[#1e3a8a]">New Project</h3>
      <div className="space-y-3 sm:space-y-2">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Project Name *</label>
          <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Ramesh Balcony Grille" className={inp} required />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Client Name</label>
          <input type="text" value={form.clientName} onChange={(e) => set("clientName", e.target.value)} placeholder="Client name" className={inp} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Client Mobile Number</label>
          <input type="tel" inputMode="numeric" maxLength={10} value={form.clientMobile} onChange={(e) => set("clientMobile", cleanMobile(e.target.value).slice(0, 10))} placeholder="10 digit mobile number" className={inp} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Site Location</label>
          <input type="text" value={form.siteLocation} onChange={(e) => set("siteLocation", e.target.value)} placeholder="Area / address" className={inp} />
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
    const mobile = cleanMobile(form.phone);
    if (!mobile) { setError("Mobile number is required."); return; }
    if (mobile.length !== 10) { setError("Mobile number must be 10 digits."); return; }
    setSaving(true);
    setError("");
    const resp = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ...form, phone: mobile }),
    });
    if (!resp.ok) {
      setError(await readApiError(resp, "Unable to save lead. Please try again."));
      setSaving(false);
      return;
    }
    const data = (await resp.json()) as { success: boolean; lead?: Lead; error?: string; message?: string };
    setSaving(false);
    if (data.success && data.lead) {
      onSave(data.lead);
    } else {
      setError(data.error || data.message || "Unable to save lead. Please try again.");
    }
  }

  const input = "w-full border border-border rounded-lg px-3 py-2.5 sm:py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40";

  return (
    <form onSubmit={handleSubmit} className="bg-[#1e3a8a]/5 border border-[#1e3a8a]/20 rounded-2xl p-4 space-y-3">
      <h3 className="font-semibold text-sm text-[#1e3a8a]">New Lead</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-2">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Customer Name *</label>
          <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Client name" className={input} required />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Mobile Number *</label>
          <input type="tel" inputMode="numeric" maxLength={10} value={form.phone} onChange={(e) => set("phone", cleanMobile(e.target.value).slice(0, 10))} placeholder="10 digit mobile number" className={input} required />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Status</label>
          <select value={form.status} onChange={(e) => set("status", e.target.value)} className={input}>
            {Object.entries(LEAD_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Site Location</label>
          <input type="text" value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Area / address" className={input} />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Requirement</label>
          <input type="text" value={form.requirement} onChange={(e) => set("requirement", e.target.value)} placeholder="Balcony, window…" className={input} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Follow-up Date</label>
          <input type="date" value={form.followUpDate} onChange={(e) => set("followUpDate", e.target.value)} className={input} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Source</label>
          <input type="text" value={form.source} onChange={(e) => set("source", e.target.value)} placeholder="WhatsApp, referral…" className={input} />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Requirement / Notes</label>
          <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Any notes…" className={`${input} resize-none`} />
        </div>
        <div className="sm:col-span-2">
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
  const [activeTab, setActiveTab] = useState<"projects" | "leads" | "activity">("projects");
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

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

  async function fetchActivity() {
    setLoadingActivity(true);
    try {
      const resp = await fetch("/api/activity", { credentials: "include" });
      const data = (await resp.json()) as { success: boolean; logs: ActivityLog[] };
      if (data.success) setActivityLogs(data.logs);
    } finally {
      setLoadingActivity(false);
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
  function handleProjectUpdated(id: string, patch: Partial<Project>) {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
  function handleProjectDeleted(id: string) { setProjects((prev) => prev.filter((p) => p.id !== id)); }

  const filteredLeads = leadFilter === "all" ? leads : leads.filter((l) => l.status === leadFilter);
  const filteredProjects = projectFilter === "all" ? projects : projects.filter((p) => p.status === projectFilter);
  const openLeads = leads.filter((l) => ["new", "contacted", "interested"].includes(l.status));

  const projectStatusCounts = PROJECT_STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = projects.filter((p) => p.status === s).length;
    return acc;
  }, {});
  const totalReceivedAmount = projects.reduce((sum, p) => sum + moneyValue(p.receivedAmount), 0);
  const totalPendingAmount = projects.reduce((sum, p) => sum + moneyValue(p.balanceAmount), 0);

  if (!user) return null;

  const tabCls = (t: "projects" | "leads" | "activity") =>
    `flex-1 min-w-0 text-xs sm:text-sm font-semibold py-2 sm:py-2.5 rounded-xl transition-colors ${activeTab === t ? "bg-[#1e3a8a] text-white" : "text-muted-foreground hover:text-foreground"}`;

  return (
    <div className="min-h-screen bg-background w-full max-w-6xl mx-auto">
      <div className="bg-[#1e3a8a] text-white px-4 py-4 lg:px-6 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold">5G Grille Admin</h1>
          <p className="text-blue-200 text-xs">Welcome, {user.name}</p>
        </div>
        <div className="flex w-full sm:w-auto items-center gap-2">
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

      <div className="px-4 py-4 lg:px-6 lg:py-6 space-y-5 pb-10">
        {loadingStats ? (
          <div className="flex justify-center py-6"><Loader2 size={24} className="animate-spin text-[#1e3a8a]" /></div>
        ) : stats ? (
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Projects" value={projects.length} sub={`${projectStatusCounts["in_progress"] ?? 0} active`} color="bg-[#1e3a8a]" />
            <StatCard label="Leads" value={stats.leads.total} sub={`${stats.leads.open} open`} color="bg-indigo-500" />
            <StatCard label="Converted" value={stats.leads.converted} sub="leads" color="bg-green-600" />
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Total Received" value={fmtMoney(totalReceivedAmount)} sub="project payments" color="bg-green-600" />
          <StatCard label="Total Pending" value={fmtMoney(totalPendingAmount)} sub="balance due" color="bg-orange-500" />
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          {[
            { icon: <Truck size={16} />, label: "Transport", path: "/transport" },
            { icon: <Users size={16} />, label: "Calculator", path: "/calculator" },
            { icon: <RefreshCw size={16} />, label: "Refresh", action: () => { void fetchStats(); void fetchLeads(); void fetchProjects(); void fetchActivity(); } },
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
            <Briefcase size={14} className="hidden sm:inline mr-1" />Projects ({projects.length})
          </button>
          <button onClick={() => setActiveTab("leads")} className={tabCls("leads")}>
            <UserCheck size={14} className="hidden sm:inline mr-1" />Leads
            {openLeads.length > 0 && (
              <span className="ml-1.5 text-xs bg-orange-400 text-white font-bold px-1.5 py-0.5 rounded-full">{openLeads.length}</span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab("activity"); if (activityLogs.length === 0) void fetchActivity(); }}
            className={tabCls("activity")}
          >
            <Clock size={14} className="hidden sm:inline mr-1" />Log
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

            <div className="flex flex-wrap gap-x-1.5 gap-y-2 sm:gap-y-1.5">
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
                    onUpdate={handleProjectUpdated}
                    onDelete={handleProjectDeleted}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "activity" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Clock size={16} className="text-[#1e3a8a]" />
                Activity Log
              </h2>
              <button
                onClick={() => void fetchActivity()}
                className="flex items-center gap-1 text-xs text-muted-foreground border border-border rounded-lg px-2.5 py-1.5 hover:border-[#1e3a8a]/40 hover:text-[#1e3a8a] transition-colors"
              >
                <RefreshCw size={12} /> Refresh
              </button>
            </div>

            {loadingActivity ? (
              <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-[#1e3a8a]" /></div>
            ) : activityLogs.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <FolderKanban size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">No activity yet</p>
                <p className="text-xs mt-1">Actions on projects and transport will appear here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activityLogs.map((log) => {
                  const isProject = log.action.startsWith("project.");
                  const isTransport = log.action.startsWith("transport.");
                  const dotColor = isProject
                    ? "bg-green-500"
                    : isTransport
                    ? "bg-orange-400"
                    : "bg-blue-400";
                  const roleBadgeColor: Record<string, string> = {
                    admin: "bg-[#1e3a8a]/10 text-[#1e3a8a]",
                    transport: "bg-orange-100 text-orange-700",
                    labour_contractor: "bg-purple-100 text-purple-700",
                    labour_worker: "bg-green-100 text-green-700",
                  };
                  const roleLabel: Record<string, string> = {
                    admin: "Admin",
                    transport: "Transport",
                    labour_contractor: "Contractor",
                    labour_worker: "Worker",
                  };
                  const elapsed = (() => {
                    const diff = Date.now() - new Date(log.createdAt).getTime();
                    const m = Math.floor(diff / 60000);
                    if (m < 1) return "just now";
                    if (m < 60) return `${m}m ago`;
                    const h = Math.floor(m / 60);
                    if (h < 24) return `${h}h ago`;
                    return `${Math.floor(h / 24)}d ago`;
                  })();

                  return (
                    <div key={log.id} className="bg-white border border-border rounded-xl px-4 py-3 flex gap-3">
                      <div className="mt-1.5 shrink-0">
                        <span className={`block w-2.5 h-2.5 rounded-full ${dotColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <span className="text-xs font-semibold text-foreground">{log.actorName}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${roleBadgeColor[log.actorRole] ?? "bg-gray-100 text-gray-600"}`}>
                            {roleLabel[log.actorRole] ?? log.actorRole}
                          </span>
                          <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{elapsed}</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{log.message}</p>
                      </div>
                    </div>
                  );
                })}
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

            <div className="flex flex-wrap gap-x-1.5 gap-y-2 sm:gap-y-1.5">
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
