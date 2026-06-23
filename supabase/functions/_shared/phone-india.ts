// Minimal India-only phone normalizer for WhatsApp/SMS send paths.
// Accepts the common stored variants and returns strict E.164 (+91XXXXXXXXXX),
// or null if the value cannot be unambiguously normalized.
export function toWhatsAppE164IN(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  // Already a valid E.164 number — keep as-is.
  if (trimmed.startsWith("+") && /^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed;
  // 7336199819 -> +917336199819
  if (digits.length === 10) return `+91${digits}`;
  // 917336199819 -> +917336199819
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  // 07336199819 -> +917336199819
  if (digits.length === 11 && digits.startsWith("0")) return `+91${digits.slice(1)}`;
  return null;
}