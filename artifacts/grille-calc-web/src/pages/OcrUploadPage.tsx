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

const monthPattern = "JANUAR|JANUARY|JAN|FEBRUARY|FEB|MARCH|MAR|APRIL|APR|MAY|JUNE|JUN|JULY|JUL|AUGUST|AUG|SEPTEMBER|SEP|OCTOBER|OCT|NOVEMBER|NOV|DECEMBER|DEC";
const datePrefixPattern = new RegExp(`^\\s*(\\d{1,2})[-\\s]?(?:${monthPattern})\\b\\s*`, "i");

function mostlyNumbers(value: string) {
  const letters = (value.match(/[a-z]/gi) ?? []).length;
  const digits = (value.match(/\d/g) ?? []).length;
  return digits > 0 && digits > letters;
}

function hasRouteText(value: string) {
  return /[a-z]/i.test(value) && !mostlyNumbers(value);
}

function cleanPoint(value: string) {
  return value.trim().replace(/\s*\(\d+\)\s*$/, "").trim();
}

function splitFallbackRouteLine(line: string) {
  const arrow = /->|→/.exec(line);
  if (arrow?.index !== undefined) return { index: arrow.index, length: arrow[0].length, usedArrow: true };

  const spaced = /\s{2,}/.exec(line);
  if (spaced?.index !== undefined) return { index: spaced.index, length: spaced[0].length, usedArrow: false };

  const hyphen = /\s+-\s+/.exec(line);
  if (hyphen?.index !== undefined && hasRouteText(line.slice(0, hyphen.index)) && hasRouteText(line.slice(hyphen.index + hyphen[0].length))) {
    return { index: hyphen.index, length: hyphen[0].length, usedArrow: false };
  }

  return null;
}

function buildFullTransportPreviewRows(ocrText: string): TransportPreviewRow[] {
  const rows: TransportPreviewRow[] = [];
  let rowNumber = 1;

  for (const line of ocrText.split(/\r?\n/)) {
    const rawOcrLine = line.trim();
    if (!rawOcrLine) continue;

    const dated = datePrefixPattern.exec(rawOcrLine);
    const body = rawOcrLine.replace(datePrefixPattern, "").trim();
    const split = splitFallbackRouteLine(body);
    if (!split) continue;

    const startingPoint = cleanPoint(body.slice(0, split.index));
    const endingPoint = cleanPoint(body.slice(split.index + split.length));
    if (!split.usedArrow && (!hasRouteText(startingPoint) || !hasRouteText(endingPoint))) continue;

    rows.push({
      rowNumber: dated ? Number(dated[1]) : rowNumber++,
      startingPoint,
      endingPoint,
      rawOcrLine,
      reviewNeeded: split.usedArrow
        ? !startingPoint || !endingPoint || /->|\u2192/.test(endingPoint) ? "YES" : "NO"
        : /\s{2,}/.test(endingPoint) ? "YES" : "NO",
    });
  }

  return rows;
}

function withTransportPreviewFallback(data: OcrResult): OcrResult {
  if (data.documentType !== "Transport Data" || data.transportRows.length > 0) return data;
  const transportRows = buildFullTransportPreviewRows(data.ocrText);
  return {
    ...data,
    transportRows,
    reviewNeededCount: transportRows.filter((row) => row.reviewNeeded === "YES").length,
  };
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
  const [transportRows, setTransportRows] = useState<TransportPreviewRow[]>([]);
  const hasBlankTransportRows = transportRows.some((row) => !row.startingPoint.trim() || !row.endingPoint.trim());
  const reviewNeededCount = transportRows.filter((row) => row.reviewNeeded === "YES").length;

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
    setTransportRows([]);

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
      const nextResult = withTransportPreviewFallback(data);
      setResult(nextResult);
      setTransportRows(nextResult.transportRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "OCR processing failed.");
    } finally {
      setLoading(false);
    }
  }

  function updateRow(index: number, patch: Partial<TransportPreviewRow>) {
    setSaveError("");
    setSaveMessage("");
    setTransportRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    setSaveError("");
    setSaveMessage("");
    setTransportRows((current) => current.filter((_, i) => i !== index));
  }

  function addRow() {
    setSaveError("");
    setSaveMessage("");
    setTransportRows((current) => {
      const nextNumber = Math.max(0, ...current.map((row) => row.rowNumber)) + 1;
      return [
        ...current,
        { rowNumber: nextNumber, startingPoint: "", endingPoint: "", rawOcrLine: "", reviewNeeded: "YES" },
      ];
    });
  }

  async function saveTransportRows() {
    if (!result || transportRows.length === 0) return;
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
        body: JSON.stringify({ sourceFile: result.sourceFile, rows: transportRows }),
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
              <p className="text-xs text-muted-foreground">{reviewNeededCount} row{reviewNeededCount === 1 ? "" : "s"} need review</p>
            </div>
            {transportRows.length === 0 && (
              <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">No transport route rows detected.</p>
            )}
            {transportRows.length > 0 && (
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
                    {transportRows.map((row, index) => (
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
              disabled={savingTransport || transportRows.length === 0 || hasBlankTransportRows}
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
