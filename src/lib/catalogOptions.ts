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

/** Metal colour -> the letter used in Shopify image filenames (e.g. DER001134_W1.jpg). */
export const COLOR_CODE: Record<string, string> = {
  "Yellow Gold": "Y",
  "Rose Gold": "R",
  "White Gold": "W",
};

/**
 * Rewrite the colour token in a product image URL to match the selected metal colour.
 * `..._W1.jpg?v=1` + "Rose Gold" -> `..._R1.jpg?v=1`.
 * Returns the URL unchanged when there is no colour token or the colour is unknown.
 */
export function imageUrlForColor(url?: string | null, color?: string | null): string {
  if (!url) return "";
  const code = color ? COLOR_CODE[normalizeMetalColor(color)] : undefined;
  if (!code) return url;
  // Split off the query string so `?v=...` is never touched.
  const [path, query] = url.split("?");
  // Replace only the LAST _<Y|R|W><digit> token in the path.
  const re = /_([YRW])(\d)(?=[^/]*$)/gi;
  let lastIndex = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(path)) !== null) lastIndex = m.index;
  if (lastIndex === -1) return url;
  const digit = path[lastIndex + 2];
  const newPath = path.slice(0, lastIndex) + `_${code}${digit}` + path.slice(lastIndex + 3);
  return query ? `${newPath}?${query}` : newPath;
}
