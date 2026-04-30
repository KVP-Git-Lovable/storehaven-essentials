/**
 * Generates a unique-ish customer code in the form CUST-XXXXXXXX
 * (timestamp tail + random). Validated server-side via UNIQUE constraint.
 */
export function generateCustomerCode(): string {
  const ts = Date.now().toString(36).toUpperCase().slice(-6);
  const rnd = Math.floor(Math.random() * 1296).toString(36).toUpperCase().padStart(2, "0");
  return `CUST-${ts}${rnd}`;
}

export const CUSTOMER_CODE_REGEX = /^[A-Za-z0-9 _-]+$/;