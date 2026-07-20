// Convert a number to Indian English words (Rupees).
// e.g. 228000 -> "Two Lakh Twenty-Eight Thousand"
const ones = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ones[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o === 0 ? tens[t] : `${tens[t]}-${ones[o]}`;
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h > 0) parts.push(`${ones[h]} Hundred`);
  if (rest > 0) parts.push(twoDigits(rest));
  return parts.join(" ");
}

export function numberToIndianWords(amount: number): string {
  if (!isFinite(amount)) return "";
  const rounded = Math.round(Math.abs(amount));
  if (rounded === 0) return "Zero";

  const crore = Math.floor(rounded / 10000000);
  const lakh = Math.floor((rounded % 10000000) / 100000);
  const thousand = Math.floor((rounded % 100000) / 1000);
  const rest = rounded % 1000;

  const parts: string[] = [];
  if (crore > 0) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh > 0) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest > 0) parts.push(threeDigits(rest));
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function amountInWords(amount: number, currency = "Rupees"): string {
  const whole = Math.floor(amount);
  const paise = Math.round((amount - whole) * 100);
  const wholeWords = numberToIndianWords(whole);
  let out = `${currency} ${wholeWords}`;
  if (paise > 0) out += ` and ${twoDigits(paise)} Paise`;
  return `${out} Only`;
}