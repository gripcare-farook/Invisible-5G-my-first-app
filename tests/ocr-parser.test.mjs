import assert from "node:assert/strict";
import test from "node:test";

import { parse_transport_data } from "../artifacts/api-server/src/routes/ocr.ts";

test("OCR transport parser keeps numbered route rows and skips OCR noise", () => {
  const sample = `
Channa 19 - 1000
13 - Baumbach
6 - Nov
5G - 2
1) 5G  Annanagel
2) 5G  Nugambakkam
3) Guindy  5G
17) 5G - virugambakkam
`;

  const result = parse_transport_data(sample, "sample.txt");

  assert.equal(result.transportRows.length, 4);
  assert.deepEqual(
    result.transportRows.map((row) => [row.rowNumber, row.startingPoint, row.endingPoint]),
    [
      [1, "5G", "Annanagel"],
      [2, "5G", "Nugambakkam"],
      [3, "Guindy", "5G"],
      [17, "5G", "virugambakkam"],
    ],
  );
  assert.equal(result.transportRows.some((row) => row.rawOcrLine === "Channa 19 - 1000"), false);
  assert.equal(result.transportRows.some((row) => row.rawOcrLine === "13 - Baumbach"), false);
  assert.equal(result.transportRows.some((row) => row.rawOcrLine === "6 - Nov"), false);
  assert.equal(result.transportRows.some((row) => row.rawOcrLine === "5G - 2"), false);
});

test("OCR transport parser handles wrapped multi-stop route rows", () => {
  const sample = `
24) 5G  Bolini  Chomompet
26) 5G  Shiram park63
32) 5G  Moyeppevit / Mangadu
 Ruby Horizon  Kalam
34) Guindy - 5G (100)
`;

  const result = parse_transport_data(sample, "sample.txt");

  assert.equal(result.transportRows.length, 4);
  assert.deepEqual(
    result.transportRows.map((row) => [row.rowNumber, row.startingPoint, row.endingPoint, row.reviewNeeded]),
    [
      [24, "5G", "Bolini  Chomompet", "YES"],
      [26, "5G", "Sriram park63", "YES"],
      [32, "5G", "Moyeppevit / Mangadu Ruby Horizon  Kalam", "YES"],
      [34, "Guindy", "5G", "NO"],
    ],
  );
});

test("OCR transport parser corrects common place OCR mistakes", () => {
  const result = parse_transport_data("1) 5G -> East than baram", "sample.txt");

  assert.equal(result.transportRows.length, 1);
  assert.equal(result.transportRows[0].startingPoint, "5G");
  assert.equal(result.transportRows[0].endingPoint, "East Tambaram");
  assert.equal(result.transportRows[0].correctedFrom, "East than baram");
});
