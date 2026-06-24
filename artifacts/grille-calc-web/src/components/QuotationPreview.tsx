import { PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/storage";

type PaymentStatus = "unpaid" | "partial" | "paid";

export interface QuotationProject {
  name: string;
  clientName: string;
  clientMobile: string;
  siteLocation: string;
  notes: string;
  status: ProjectStatus;
  totalAmount: string | number;
  advanceAmount: string | number;
  receivedAmount: string | number;
  balanceAmount: string | number;
  paymentStatus: PaymentStatus;
}

const COMPANY = {
  name: "5G Invisible Grille",
  email: "5ginvisiblegrille@gmail.com",
  mobile: "+91 86800 72597, +91 74488 88221",
  address: "No. 4, Sriram Nagar, 2nd north Main Road, West Tambaram, Chennai - 600 045.",
};

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  partial: "Partial",
  paid: "Paid",
};

function money(value: string | number): string {
  const amount = Number(value || 0);
  return `Rs. ${Number.isFinite(amount) ? amount.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "0"}`;
}

function valueOrDash(value: string): string {
  return value.trim() || "-";
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-200 py-2 text-sm">
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="text-right font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

export function QuotationPreview({ project }: { project: QuotationProject }) {
  const generatedDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <article id="quotation-print-root" className="quotation-print quotation-print-root mx-auto min-h-[297mm] w-full max-w-[210mm] bg-white p-6 text-slate-900 print:min-h-0 print:max-w-none print:p-0">
      <header className="flex items-start justify-between gap-6 border-b-2 border-[#1e3a8a] pb-5">
        <div className="flex items-start gap-4">
          <img src="/5g-ivg-logo.png" alt="5G Invisible Grille logo" className="h-16 w-16 object-contain" />
          <div>
            <h1 className="text-2xl font-bold text-[#1e3a8a]">{COMPANY.name}</h1>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-600">{COMPANY.address}</p>
            <p className="mt-2 text-xs text-slate-700">{COMPANY.email}</p>
            <p className="text-xs text-slate-700">{COMPANY.mobile}</p>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold uppercase tracking-wide text-slate-900">Quotation</h2>
          <p className="mt-1 text-sm text-slate-600">Generated: {generatedDate}</p>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-[#1e3a8a]">Project Details</h3>
          <dl className="rounded-lg border border-slate-200 px-4">
            <InfoRow label="Project" value={valueOrDash(project.name)} />
            <InfoRow label="Client" value={valueOrDash(project.clientName)} />
            <InfoRow label="Mobile" value={valueOrDash(project.clientMobile)} />
            <InfoRow label="Site" value={valueOrDash(project.siteLocation)} />
            <InfoRow label="Status" value={PROJECT_STATUS_LABELS[project.status]} />
          </dl>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-[#1e3a8a]">Payment Summary</h3>
          <dl className="rounded-lg border border-slate-200 px-4">
            <InfoRow label="Total" value={money(project.totalAmount)} />
            <InfoRow label="Advance" value={money(project.advanceAmount)} />
            <InfoRow label="Received" value={money(project.receivedAmount)} />
            <InfoRow label="Balance" value={money(project.balanceAmount)} />
            <InfoRow label="Payment Status" value={PAYMENT_STATUS_LABELS[project.paymentStatus]} />
          </dl>
        </div>
      </section>

      <section className="mt-6">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-[#1e3a8a]">Notes</h3>
        <div className="min-h-20 rounded-lg border border-slate-200 p-4 text-sm leading-relaxed text-slate-700">
          {valueOrDash(project.notes)}
        </div>
      </section>

      <section className="mt-6">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-[#1e3a8a]">Terms</h3>
        <ol className="list-decimal space-y-1 rounded-lg border border-slate-200 p-4 pl-8 text-sm leading-relaxed text-slate-700">
          <li>Quotation validity, installation schedule, and warranty terms to be confirmed.</li>
          <li>Final measurements and site conditions may affect the final amount.</li>
          <li>Payment terms to be agreed before installation.</li>
        </ol>
      </section>

      <footer className="mt-8 border-t border-slate-200 pt-4 text-center text-xs leading-relaxed text-slate-600">
        <p className="font-semibold text-slate-900">{COMPANY.name}</p>
        <p>{COMPANY.email} | {COMPANY.mobile}</p>
        <p>{COMPANY.address}</p>
      </footer>
    </article>
  );
}
