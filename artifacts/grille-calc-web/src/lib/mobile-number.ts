export const MOBILE_NUMBER_ERROR = "Mobile number must be exactly 10 digits.";

export function normalizeMobileNumber(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

export function validateMobileNumber(value: string): boolean {
  return value === "" || /^\d{10}$/.test(value);
}
