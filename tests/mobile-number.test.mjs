import assert from "node:assert/strict";
import test from "node:test";

import { normalizeMobileNumber, validateMobileNumber } from "../artifacts/grille-calc-web/src/lib/mobile-number.ts";
import { parseMobileNumber } from "../artifacts/api-server/src/lib/mobile-number.ts";

test("blank optional mobile number is accepted", () => {
  assert.equal(validateMobileNumber(""), true);
  assert.equal(parseMobileNumber(null), "");
});

test("valid 10-digit mobile number is preserved", () => {
  assert.equal(validateMobileNumber("9876543210"), true);
  assert.equal(parseMobileNumber("9876543210"), "9876543210");
});

test("letters and symbols are removed before validation", () => {
  assert.equal(normalizeMobileNumber("+91 (987) 654-3210"), "9198765432");
  assert.equal(parseMobileNumber("987-654-3210"), "9876543210");
});

test("fewer or more than 10 digits are rejected", () => {
  assert.equal(validateMobileNumber("123456789"), false);
  assert.equal(validateMobileNumber("12345678901"), false);
  assert.throws(() => parseMobileNumber("123456789"), /exactly 10 digits/);
  assert.throws(() => parseMobileNumber("12345678901"), /exactly 10 digits/);
});

test("save payload preserves the mobile number", () => {
  const shared = { clientName: "Client", mobileNumber: "9876543210" };
  const payload = { mobileNumber: shared.mobileNumber ?? "" };
  assert.equal(payload.mobileNumber, "9876543210");
});

test("existing saved records without mobileNumber still load", () => {
  const project = { id: "old", shared: { clientName: "Legacy" } };
  project.shared = { ...project.shared, mobileNumber: project.shared.mobileNumber ?? "" };
  assert.equal(project.shared.mobileNumber, "");
});
