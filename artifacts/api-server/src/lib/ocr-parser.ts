interface TransportRow {
  rowNumber: number;
  startingPoint: string;
  endingPoint: string;
  rawOcrLine: string;
  reviewNeeded: "YES" | "NO";
  correctedFrom?: string;
}

const placeCorrections = new Map<string, string>([
  ["east than baram", "East Tambaram"],
  ["shiram", "Sriram"],
  ["adavoy", "Adyar"],
  ["panugudi", "perugudi"],
  ["koyembedu", "Koyambedu"],
  ["nugambakkam", "Nungambakkam"],
  ["mangadu", "Mangadu"],
  ["rwd", "RWD"],
  ["5g", "5G"],
]);

const monthPattern = "JANUAR|JANUARY|JAN|FEBRUARY|FEB|MARCH|MAR|APRIL|APR|MAY|JUNE|JUN|JULY|JUL|AUGUST|AUG|SEPTEMBER|SEP|OCTOBER|OCT|NOVEMBER|NOV|DECEMBER|DEC";
const datePrefixPattern = new RegExp(`^\\s*(\\d{1,2})[-\\s]?(?:${monthPattern})\\b\\s*`, "i");

function mostlyNumbers(value: string) {
  const letters = (value.match(/[a-z]/gi) ?? []).length;
  const digits = (value.match(/\d/g) ?? []).length;
  return digits > 0 && digits > letters;
}

function hasPlaceText(value: string) {
  return /[a-z]/i.test(value) && !mostlyNumbers(value);
}

function cleanPoint(value: string) {
  return value.trim().replace(/\s*\(\d+\)\s*$/, "").trim();
}

function correctPlace(value: string) {
  let corrected = value;
  const originals: string[] = [];

  for (const [wrong, right] of placeCorrections) {
    const pattern = new RegExp(`\\b${wrong.replace(/\s+/g, "\\s+")}\\b`, "gi");
    corrected = corrected.replace(pattern, (match) => {
      if (match !== right) originals.push(match);
      return right;
    });
  }

  return { value: corrected, correctedFrom: originals.join(", ") };
}

function hasSuspiciousOcrWord(value: string) {
  return value.split(/\s+/).some((word) => {
    const stripped = word.replace(/[^a-z0-9]/gi, "");
    return /[a-z]/i.test(stripped) && /\d/.test(stripped) && !/^(5g|rwd)$/i.test(stripped);
  });
}

function stripDatePrefix(value: string) {
  return value.replace(datePrefixPattern, "").trim();
}

export function parse_transport_data(ocrText: string, sourceFile: string) {
  void sourceFile;
  const lines = ocrText.split(/\r?\n/);
  const markerIndex = lines.findIndex((line) => /^#?\s*transports?\b/i.test(line.trim()));
  const routeLines = markerIndex === -1 ? lines : lines.slice(markerIndex + 1);
  const transportRows: TransportRow[] = [];
  let fallbackRowNumber = 1;

  for (let i = 0; i < routeLines.length; i += 1) {
    const rawLine = routeLines[i];
    const rawOcrLine = rawLine.trim();
    if (!rawOcrLine) continue;

    const numbered = /^(\d+)[).]\s*(.+)$/.exec(rawOcrLine);
    const dated = datePrefixPattern.exec(rawOcrLine);
    const rowNumber = numbered ? Number(numbered[1]) : dated ? Number(dated[1]) : fallbackRowNumber++;
    const allowLooseSeparators = Boolean(numbered);

    let body = numbered ? numbered[2].trim() : stripDatePrefix(rawOcrLine);
    if (!allowLooseSeparators && !body.includes("->")) continue;
    let combinedRawOcrLine = rawOcrLine;
    let continued = false;
    const nextLine = routeLines[i + 1]?.trim() ?? "";
    if (nextLine && !/^\d+[).]\s*/.test(nextLine) && (/(?:->|→|-|,|\bto\b|\bTO\b)\s*$/.test(body) || body.includes("/"))) {
      body = `${body} ${nextLine}`.trim();
      combinedRawOcrLine = `${combinedRawOcrLine} ${nextLine}`;
      continued = true;
      i += 1;
    }

    const arrowMatches = [...body.matchAll(/->/g)];
    const separatorMatches = body.includes("->") ? arrowMatches : [...body.matchAll(/\s*(→|,|-|\bto\b|\bTO\b|\s{2,})\s*/g)];
    const separator = separatorMatches.find((match) => match.index !== 0);
    if (!separator || separator.index === undefined) continue;

    const startCorrection = correctPlace(cleanPoint(body.slice(0, separator.index)));
    const endCorrection = correctPlace(cleanPoint(body.slice(separator.index + separator[0].length)));
    const startingPoint = startCorrection.value;
    const endingPoint = endCorrection.value;
    if (!hasPlaceText(startingPoint) || !hasPlaceText(endingPoint)) continue;

    const correctedFrom = [startCorrection.correctedFrom, endCorrection.correctedFrom].filter(Boolean).join("; ");
    const needsReview = continued || separatorMatches.length > 1 || hasSuspiciousOcrWord(startingPoint) || hasSuspiciousOcrWord(endingPoint);
    transportRows.push({
      rowNumber,
      startingPoint,
      endingPoint,
      rawOcrLine: combinedRawOcrLine,
      reviewNeeded: needsReview ? "YES" : "NO",
      ...(correctedFrom ? { correctedFrom } : {}),
    });
  }

  return {
    transportRows,
    reviewNeededCount: transportRows.filter((row) => row.reviewNeeded === "YES").length,
  };
}

function parse_transport_arrow_fallback(ocrText: string) {
  const lines = ocrText.split(/\r?\n/);
  const transportRows: TransportRow[] = [];
  let fallbackRowNumber = 1;

  for (let i = 0; i < lines.length; i += 1) {
    const rawOcrLine = (lines[i] ?? "").trim();
    if (!rawOcrLine.includes("->")) continue;

    const dated = datePrefixPattern.exec(rawOcrLine);
    let body = stripDatePrefix(rawOcrLine);
    let combinedRawOcrLine = rawOcrLine;
    let continued = false;

    if (/->\s*$/.test(body)) {
      let nextIndex = i + 1;
      while (nextIndex < lines.length && !(lines[nextIndex] ?? "").trim()) nextIndex += 1;
      if (nextIndex < lines.length) {
        const nextLine = (lines[nextIndex] ?? "").trim();
        body = `${body} ${nextLine}`.trim();
        combinedRawOcrLine = `${combinedRawOcrLine} ${nextLine}`;
        continued = true;
        i = nextIndex;
      }
    }

    const arrowIndex = body.indexOf("->");
    const startingPoint = cleanPoint(body.slice(0, arrowIndex));
    const endingPoint = cleanPoint(body.slice(arrowIndex + 2));
    if (!hasPlaceText(startingPoint) || !hasPlaceText(endingPoint)) continue;

    transportRows.push({
      rowNumber: dated ? Number(dated[1]) : fallbackRowNumber++,
      startingPoint,
      endingPoint,
      rawOcrLine: combinedRawOcrLine,
      reviewNeeded: continued || endingPoint.includes("->") ? "YES" : "NO",
    });
  }

  return {
    transportRows,
    reviewNeededCount: transportRows.filter((row) => row.reviewNeeded === "YES").length,
  };
}

export function parse_transport_preview_data(ocrText: string, sourceFile: string, documentType: string) {
  const parsed = parse_transport_data(ocrText, sourceFile);
  if (documentType !== "Transport Data" || parsed.transportRows.length > 0 || !ocrText.includes("->")) return parsed;
  return parse_transport_arrow_fallback(ocrText);
}
