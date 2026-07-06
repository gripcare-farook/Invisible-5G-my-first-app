import { FormEvent, useState } from "react";
import { AlertCircle, FileText, Loader2 } from "lucide-react";

type DocumentType = "Auto Detect" | "Transport Data" | "Measurement Data";

interface OcrResult {
  success: true;
  sourceFile: string;
  documentType: DocumentType;
  ocrText: string;
  pageCount: number;
}

export default function OcrUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType>("Auto Detect");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<OcrResult | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Choose a JPG, PNG, or PDF file first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    const body = new FormData();
    body.append("file", file);
    body.append("documentType", documentType);

    try {
      const response = await fetch("/api/ocr/upload", {
        method: "POST",
        credentials: "include",
        body,
      });
      const data = (await response.json()) as OcrResult | { success: false; message?: string };
      if (!response.ok || !data.success) throw new Error("message" in data ? data.message : "OCR processing failed.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "OCR processing failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="bg-[#1e3a8a] text-white rounded-2xl px-4 py-4">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <FileText size={20} /> OCR Upload
        </h1>
        <p className="text-blue-200 text-xs">Scan transport notes or measurement drawings</p>
      </div>

      <form onSubmit={submit} className="bg-white rounded-2xl border border-border p-4 space-y-4">
        <div>
          <label htmlFor="ocr-file" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
            File
          </label>
          <input
            id="ocr-file"
            type="file"
            accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40"
          />
        </div>

        <div>
          <label htmlFor="ocr-document-type" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
            Document Type
          </label>
          <select
            id="ocr-document-type"
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value as DocumentType)}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40"
          >
            <option>Auto Detect</option>
            <option>Transport Data</option>
            <option>Measurement Data</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#1e3a8a] text-white font-semibold rounded-xl py-3.5 text-sm hover:bg-[#1e3a8a]/90 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? "Processing..." : "Upload / Process"}
        </button>
      </form>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <section className="bg-white rounded-2xl border border-border p-4 space-y-3">
          <div>
            <h2 className="font-semibold text-sm text-[#1e3a8a]">Extracted OCR Text</h2>
            <p className="text-xs text-muted-foreground">
              {result.sourceFile} · {result.documentType} · {result.pageCount} page{result.pageCount === 1 ? "" : "s"}
            </p>
          </div>
          <pre className="whitespace-pre-wrap break-words rounded-xl bg-muted p-3 text-sm leading-relaxed text-foreground">
            {result.ocrText || "No text found."}
          </pre>
        </section>
      )}
    </div>
  );
}
