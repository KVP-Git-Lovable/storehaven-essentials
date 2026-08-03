/** Shared helpers for catalog product options (karat / metal colour / size). */

export const norm = (s: string) => s.toLowerCase().replace(/[\s_\-()]+/g, "");

/** Canonical option names so imports from differently-labelled sheets align. */
export function canonicalOptionName(raw: string): string {
  const n = norm(raw);
  if (["karat", "carat", "kt", "purity", "goldpurity", "goldkarat", "metalpurity"].includes(n)) {
    return "Karat";
  }
  if (
    ["color", "colour", "metal", "metalcolor", "metalcolour", "goldcolor", "goldcolour", "metaltype"].includes(n)
  ) {
    return "Color";
  }
  if (["size", "ringsize", "banglesize", "length"].includes(n)) return "Size";
  // Title-case anything else
  return raw.trim().replace(/\s+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Normalise a karat value like "18kt", "18 K", "18" -> "18K". */
export function normalizeKarat(raw: string): string {
  const m = String(raw).match(/(\d{1,2})\s*(k|kt|karat|carat)?/i);
  if (!m) return String(raw).trim();
  return `${m[1]}K`;
}

/** Normalise metal colour labels. */
export function normalizeMetalColor(raw: string): string {
  const n = norm(raw);
  if (n.includes("rose") || n.includes("pink")) return "Rose Gold";
  if (n.includes("white") || n.includes("platinum")) return "White Gold";
  if (n.includes("yellow")) return "Yellow Gold";
  if (n.includes("silver")) return "Silver";
  if (n === "gold") return "Gold";
  return String(raw).trim();
}

export function normalizeOptionValue(canonicalName: string, value: string): string {
  if (canonicalName === "Karat") return normalizeKarat(value);
  if (canonicalName === "Color") return normalizeMetalColor(value);
  return String(value).trim();
}

type OptionsMap = Record<string, string[]> | null | undefined;

/** Read an option list case-insensitively (handles legacy raw keys). */
export function getOptionValues(options: OptionsMap, canonical: string): string[] {
  if (!options) return [];
  for (const [k, v] of Object.entries(options)) {
    if (canonicalOptionName(k) === canonical && Array.isArray(v)) {
      return v.map((x) => normalizeOptionValue(canonical, String(x)));
    }
  }
  return [];
}

export const COLOR_SWATCH: Record<string, string> = {
  "Rose Gold": "#e0b4a0",
  "Yellow Gold": "#e5c04b",
  "White Gold": "#e8e8ee",
  Gold: "#e5c04b",
  Silver: "#c0c0c0",
};
