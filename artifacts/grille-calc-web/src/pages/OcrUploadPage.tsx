import { FormEvent, useState } from "react";
import { AlertCircle, FileText, Loader2 } from "lucide-react";

type DocumentType = "Auto Detect" | "Transport Data" | "Measurement Data";
type ReviewNeeded = "YES" | "NO";

interface TransportPreviewRow {
  rowNumber: number;
  startingPoint: string;
  endingPoint: string;
  rawOcrLine: string;
  reviewNeeded: ReviewNeeded;
  correctedFrom?: string;
}

interface OcrResult {
  success: true;
  sourceFile: string;
  documentType: DocumentType;
  ocrText: string;
  pageCount: number;
  reviewNeededCount: number;
  transportRows: TransportPreviewRow[];
}

export default function OcrUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType>("Auto Detect");
  const [loading, setLoading] = useState(false);
  const [savingTransport, setSavingTransport] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [result, setResult] = useState<OcrResult | null>(null);
  const hasBlankTransportRows = result?.transportRows.some((row) => !row.startingPoint.trim() || !row.endingPoint.trim()) ?? false;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Choose a JPG, PNG, or PDF file first.");
      return;
    }

    setLoading(true);
    setError("");
    setSaveError("");
    setSaveMessage("");
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

  function updateRow(index: number, patch: Partial<TransportPreviewRow>) {
    setSaveError("");
    setSaveMessage("");
    setResult((current) => {
      if (!current) return current;
      const transportRows = current.transportRows.map((row, i) => (i === index ? { ...row, ...patch } : row));
      return {
        ...current,
        transportRows,
        reviewNeededCount: transportRows.filter((row) => row.reviewNeeded === "YES").length,
      };
    });
  }

  function removeRow(index: number) {
    setSaveError("");
    setSaveMessage("");
    setResult((current) => {
      if (!current) return current;
      const transportRows = current.transportRows.filter((_, i) => i !== index);
      return {
        ...current,
        transportRows,
        reviewNeededCount: transportRows.filter((row) => row.reviewNeeded === "YES").length,
      };
    });
  }

  function addRow() {
    setSaveError("");
    setSaveMessage("");
    setResult((current) => {
      if (!current) return current;
      const nextNumber = Math.max(0, ...current.transportRows.map((row) => row.rowNumber)) + 1;
      return {
        ...current,
        reviewNeededCount: current.reviewNeededCount + 1,
        transportRows: [
          ...current.transportRows,
          { rowNumber: nextNumber, startingPoint: "", endingPoint: "", rawOcrLine: "", reviewNeeded: "YES" },
        ],
      };
    });
  }

  async function saveTransportRows() {
    if (!result || result.transportRows.length === 0) return;
    if (hasBlankTransportRows) {
      setSaveError("Fix blank starting or ending points before saving.");
      setSaveMessage("");
      return;
    }
    setSavingTransport(true);
    setSaveError("");
    setSaveMessage("");

    try {
      const response = await fetch("/api/ocr/transport/save", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceFile: result.sourceFile, rows: result.transportRows }),
      });
      const data = (await response.json()) as { success: true; rowsAdded: number } | { success: false; message?: string };
      if (!response.ok || !data.success) throw new Error("message" in data ? data.message : "Could not save transport rows.");
      setSaveMessage(`Transport rows added: ${data.rowsAdded}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save transport rows.");
    } finally {
      setSavingTransport(false);
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
        <>
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

          <section className="bg-white rounded-2xl border border-border p-4 space-y-3">
            <div>
              <h2 className="font-semibold text-sm text-[#1e3a8a]">Transport Preview</h2>
              <p className="text-xs text-muted-foreground">{result.reviewNeededCount} row{result.reviewNeededCount === 1 ? "" : "s"} need review</p>
            </div>
            {result.transportRows.length === 0 && (
              <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">No transport route rows detected.</p>
            )}
            {result.transportRows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="text-xs uppercase text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="py-2 pr-3 font-semibold">Row Number</th>
                      <th className="py-2 pr-3 font-semibold">Starting Point</th>
                      <th className="py-2 pr-3 font-semibold">Ending Point</th>
                      <th className="py-2 pr-3 font-semibold">Review Needed</th>
                      <th className="py-2 pr-3 font-semibold">Raw OCR Line</th>
                      <th className="py-2 font-semibold">Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.transportRows.map((row, index) => (
                      <tr key={`${row.rowNumber}-${index}`} className="border-b border-border last:border-0 align-top">
                        <td className="py-2 pr-3 font-medium">{row.rowNumber}</td>
                        <td className="py-2 pr-3">
                          <input
                            aria-label={`Starting point for row ${row.rowNumber}`}
                            value={row.startingPoint}
                            onChange={(event) => updateRow(index, { startingPoint: event.target.value })}
                            className="w-full min-w-36 rounded-lg border border-border bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            aria-label={`Ending point for row ${row.rowNumber}`}
                            value={row.endingPoint}
                            onChange={(event) => updateRow(index, { endingPoint: event.target.value })}
                            className="w-full min-w-44 rounded-lg border border-border bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          {row.reviewNeeded === "YES" && <span className="mb-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">Review</span>}
                          <select
                            aria-label={`Review needed for row ${row.rowNumber}`}
                            value={row.reviewNeeded}
                            onChange={(event) => updateRow(index, { reviewNeeded: event.target.value as ReviewNeeded })}
                            className="rounded-lg border border-border bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40"
                          >
                            <option>YES</option>
                            <option>NO</option>
                          </select>
                        </td>
                        <td className="py-2 pr-3">
                          <p className="max-w-64 text-xs text-muted-foreground">{row.rawOcrLine || "-"}</p>
                          {row.correctedFrom && <p className="mt-1 text-xs text-[#1e3a8a]">Corrected from: {row.correctedFrom}</p>}
                        </td>
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={() => removeRow(index)}
                            className="rounded-lg border border-red-200 px-2 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button
              type="button"
              onClick={addRow}
              className="w-full rounded-xl border border-[#1e3a8a]/30 py-2.5 text-sm font-semibold text-[#1e3a8a] hover:bg-[#1e3a8a]/5"
            >
              Add Row
            </button>
            <button
              type="button"
              onClick={saveTransportRows}
              disabled={savingTransport || result.transportRows.length === 0 || hasBlankTransportRows}
              className="w-full rounded-xl bg-[#1e3a8a] py-3 text-sm font-semibold text-white hover:bg-[#1e3a8a]/90 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {savingTransport && <Loader2 size={16} className="animate-spin" />}
              {savingTransport ? "Saving..." : "Save Transport Rows"}
            </button>
            {hasBlankTransportRows && <p className="text-sm text-amber-700">Fix blank starting or ending points before saving.</p>}
            {saveMessage && <p className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">{saveMessage}</p>}
            {saveError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                <AlertCircle size={16} className="shrink-0" />
                {saveError}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
