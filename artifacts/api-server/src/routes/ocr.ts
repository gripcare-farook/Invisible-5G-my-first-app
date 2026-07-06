import { Router, type IRouter, type Request } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".pdf"]);
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "application/pdf"]);
const maxUploadBytes = 25 * 1024 * 1024;

interface UploadedFile {
  filename: string;
  contentType: string;
  buffer: Buffer;
}

interface ParsedUpload {
  file?: UploadedFile;
  documentType: string;
}

interface TransportRow {
  rowNumber: number;
  startingPoint: string;
  endingPoint: string;
  rawOcrLine: string;
  reviewNeeded: "YES" | "NO";
}

export function parse_transport_data(ocrText: string, sourceFile: string) {
  void sourceFile;
  const transportRows: TransportRow[] = [];
  const separatorPattern = /\s*(->|,|-|\bto\b|\bTO\b)\s*/;

  for (const rawLine of ocrText.split(/\r?\n/)) {
    const rawOcrLine = rawLine.trim();
    if (!rawOcrLine || /^\d{7,}$/.test(rawOcrLine.replace(/\D/g, ""))) continue;

    const line = rawOcrLine.replace(/^\s*(?:[-*]\s*)?(?:\d+[\).:-]\s*)?/, "").trim();
    const separatorMatch = separatorPattern.exec(line);
    const parts = separatorMatch ? [line.slice(0, separatorMatch.index), line.slice(separatorMatch.index + separatorMatch[0].length)] : line.split(/\s{2,}/);
    if (parts.length < 2) continue;

    const startingPoint = parts[0]?.trim() ?? "";
    const endingPoint = parts.slice(1).join(" ").trim();
    if (!/[a-z0-9]/i.test(`${startingPoint}${endingPoint}`)) continue;

    const reviewNeeded = !/[a-z0-9]/i.test(startingPoint) || !/[a-z0-9]/i.test(endingPoint) ? "YES" : "NO";
    transportRows.push({
      rowNumber: transportRows.length + 1,
      startingPoint,
      endingPoint,
      rawOcrLine,
      reviewNeeded,
    });
  }

  return {
    transportRows,
    reviewNeededCount: transportRows.filter((row) => row.reviewNeeded === "YES").length,
  };
}

function splitBuffer(buffer: Buffer, delimiter: Buffer) {
  const parts: Buffer[] = [];
  let start = 0;
  let index = buffer.indexOf(delimiter, start);
  while (index !== -1) {
    parts.push(buffer.subarray(start, index));
    start = index + delimiter.length;
    index = buffer.indexOf(delimiter, start);
  }
  parts.push(buffer.subarray(start));
  return parts;
}

async function readBody(req: Request) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxUploadBytes) throw new Error("File is too large. Maximum size is 25MB.");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

async function parseMultipart(req: Request): Promise<ParsedUpload> {
  const contentType = req.headers["content-type"] ?? "";
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType)?.[1] ?? /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType)?.[2];
  if (!boundary) throw new Error("Missing multipart boundary.");

  const body = await readBody(req);
  const parsed: ParsedUpload = { documentType: "Auto Detect" };

  for (const rawPart of splitBuffer(body, Buffer.from(`--${boundary}`))) {
    let part = rawPart;
    if (part.subarray(0, 2).equals(Buffer.from("\r\n"))) part = part.subarray(2);
    if (part.length === 0 || part.subarray(0, 2).equals(Buffer.from("--"))) continue;

    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd === -1) continue;

    const headerText = part.subarray(0, headerEnd).toString("utf8");
    let content = part.subarray(headerEnd + 4);
    if (content.subarray(-2).equals(Buffer.from("\r\n"))) content = content.subarray(0, -2);

    const disposition = /content-disposition:\s*form-data;([^\r\n]+)/i.exec(headerText)?.[1] ?? "";
    const name = /name="([^"]+)"/i.exec(disposition)?.[1];
    const filename = /filename="([^"]*)"/i.exec(disposition)?.[1];
    const partContentType = /content-type:\s*([^\r\n]+)/i.exec(headerText)?.[1]?.trim() ?? "application/octet-stream";

    if (name === "documentType") parsed.documentType = content.toString("utf8") || "Auto Detect";
    if (filename) parsed.file = { filename, contentType: partContentType, buffer: content };
  }

  return parsed;
}

function validateFile(file: UploadedFile) {
  const lowerName = file.filename.toLowerCase();
  const extension = lowerName.slice(lowerName.lastIndexOf("."));
  if (!allowedExtensions.has(extension) || !allowedMimeTypes.has(file.contentType)) {
    throw new Error("Unsupported file type. Upload a JPG, PNG, or PDF file.");
  }
}

async function uploadToMistral(file: UploadedFile, apiKey: string) {
  const form = new FormData();
  const content = file.buffer.buffer.slice(file.buffer.byteOffset, file.buffer.byteOffset + file.buffer.byteLength) as ArrayBuffer;
  form.append("purpose", "ocr");
  form.append("file", new Blob([content], { type: file.contentType }), file.filename);

  const response = await fetch("https://api.mistral.ai/v1/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) throw new Error(`Mistral file upload failed with HTTP ${response.status}.`);
  const data = (await response.json()) as { id?: unknown };
  if (typeof data.id !== "string") throw new Error("Mistral file upload response was missing a file id.");
  return data.id;
}

async function getSignedUrl(fileId: string, apiKey: string) {
  const response = await fetch(`https://api.mistral.ai/v1/files/${encodeURIComponent(fileId)}/url`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) throw new Error(`Mistral signed URL request failed with HTTP ${response.status}.`);
  const data = (await response.json()) as { url?: unknown };
  if (typeof data.url !== "string") throw new Error("Mistral signed URL response was missing a URL.");
  return data.url;
}

async function runOcr(documentUrl: string, apiKey: string) {
  const response = await fetch("https://api.mistral.ai/v1/ocr", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "mistral-ocr-latest",
      document: { type: "document_url", document_url: documentUrl },
    }),
  });

  if (!response.ok) throw new Error(`Mistral OCR failed with HTTP ${response.status}.`);
  const data = (await response.json()) as { pages?: Array<{ markdown?: unknown; text?: unknown }> };
  const pages = Array.isArray(data.pages) ? data.pages : [];
  return {
    pageCount: pages.length,
    ocrText: pages
      .map((page) => (typeof page.markdown === "string" ? page.markdown : typeof page.text === "string" ? page.text : ""))
      .filter(Boolean)
      .join("\n\n"),
  };
}

router.post("/ocr/upload", async (req, res) => {
  try {
    const apiKey = process.env["MISTRAL_API_KEY"];
    if (!apiKey) {
      res.status(500).json({ success: false, message: "MISTRAL_API_KEY is not configured on the server." });
      return;
    }

    const { file, documentType } = await parseMultipart(req);
    if (!file) {
      res.status(400).json({ success: false, message: "Upload one file named file." });
      return;
    }

    validateFile(file);
    const fileId = await uploadToMistral(file, apiKey);
    const documentUrl = await getSignedUrl(fileId, apiKey);
    const { ocrText, pageCount } = await runOcr(documentUrl, apiKey);
    const { transportRows, reviewNeededCount } = parse_transport_data(ocrText, file.filename);

    res.json({
      success: true,
      sourceFile: file.filename,
      documentType,
      ocrText,
      pageCount,
      transportRows,
      reviewNeededCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "OCR processing failed.";
    logger.error({ err: message }, "ocr/upload failed");
    res.status(message.startsWith("Unsupported") || message.startsWith("Missing") ? 400 : 502).json({
      success: false,
      message,
    });
  }
});

export default router;
