export function parseMobileNumber(value: unknown): string {
  const mobileNumber = String(value ?? "").replace(/\D/g, "");
  if (mobileNumber && mobileNumber.length !== 10) {
    throw new Error("Mobile number must be exactly 10 digits.");
  }
  return mobileNumber;
}
