// WhatsApp Template Variable Registry
// Friendly named variables that get auto-mapped to Twilio's {{1}}, {{2}} format on submit.
//
// The hierarchical registry now lives in `src/lib/variables/registry.ts` and
// declares a `source` per leaf so the picker and backend resolver stay in
// lockstep. This file re-exports for back-compat with existing callers.

import {
  VARIABLE_REGISTRY as REGISTRY,
  getResolvableRegistry,
  ALL_LEAVES,
  TOKEN_SOURCE_MAP,
  RESOLVER_KINDS,
  type VariableEntity,
  type VariableCategory,
  type VariableLeaf,
  type VariableSource,
} from "@/lib/variables/registry";

export {
  REGISTRY as VARIABLE_REGISTRY,
  getResolvableRegistry,
  ALL_LEAVES,
  TOKEN_SOURCE_MAP,
  RESOLVER_KINDS,
};
export type { VariableEntity, VariableCategory, VariableLeaf, VariableSource };

// Legacy flat groups still consumed by the WhatsApp Templates page.
// Built from the new registry so they cannot drift.
export const VARIABLE_GROUPS: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {};
  for (const e of REGISTRY) {
    out[e.label] = e.categories.flatMap((c) => c.variables.map((v) => v.name));
  }
  return out;
})();

export const ALL_VARIABLES = ALL_LEAVES.map((v) => v.name);


export const MARKER_REGEX = /\n?<!--vars:(\{[^}]*\})-->/;

/**
 * Extract friendly variable names (in order of first appearance) from a body.
 * Returns ["customer_name", "order_id"] for "Hello {{customer_name}}, order {{order_id}}".
 * Numeric placeholders ({{1}}) are ignored.
 */
export function extractFriendlyVariables(body: string): string[] {
  const matches = body.matchAll(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g);
  const seen: string[] = [];
  for (const m of matches) {
    if (!seen.includes(m[1])) seen.push(m[1]);
  }
  return seen;
}

/**
 * Convert a friendly body to Twilio numeric format and return the mapping.
 * "Hello {{customer_name}}, order {{order_id}}"
 *  -> { twilioBody: "Hello {{1}}, order {{2}}", mapping: { "1": "customer_name", "2": "order_id" } }
 */
export function transformFriendlyToTwilio(body: string): {
  twilioBody: string;
  mapping: Record<string, string>;
} {
  const vars = extractFriendlyVariables(body);
  const mapping: Record<string, string> = {};
  let twilioBody = body;
  vars.forEach((name, idx) => {
    const num = String(idx + 1);
    mapping[num] = name;
    twilioBody = twilioBody.split(`{{${name}}}`).join(`{{${num}}}`);
  });
  return { twilioBody, mapping };
}

/**
 * Convert a numeric Twilio body back to friendly using a mapping.
 */
export function transformTwilioToFriendly(
  body: string,
  mapping: Record<string, string>
): string {
  let result = body;
  Object.entries(mapping).forEach(([num, name]) => {
    result = result.split(`{{${num}}}`).join(`{{${name}}}`);
  });
  return result;
}

/**
 * Build the full body to store in DB: numeric Twilio body + hidden mapping marker.
 */
export function buildStoredBody(friendlyBody: string): {
  storedBody: string;
  twilioBody: string;
  mapping: Record<string, string>;
} {
  const { twilioBody, mapping } = transformFriendlyToTwilio(friendlyBody);
  const hasMapping = Object.keys(mapping).length > 0;
  const storedBody = hasMapping
    ? `${twilioBody}\n<!--vars:${JSON.stringify(mapping)}-->`
    : twilioBody;
  return { storedBody, twilioBody, mapping };
}

/**
 * Parse a stored body: extract clean Twilio body and mapping (if marker present).
 */
export function parseStoredBody(stored: string): {
  twilioBody: string;
  mapping: Record<string, string> | null;
} {
  const match = stored.match(MARKER_REGEX);
  if (!match) return { twilioBody: stored, mapping: null };
  try {
    const mapping = JSON.parse(match[1]) as Record<string, string>;
    const twilioBody = stored.replace(MARKER_REGEX, "").trimEnd();
    return { twilioBody, mapping };
  } catch {
    return { twilioBody: stored.replace(MARKER_REGEX, "").trimEnd(), mapping: null };
  }
}

/**
 * Strip the hidden marker line — used server-side before sending to Twilio.
 */
export function stripMarker(body: string): string {
  return body.replace(MARKER_REGEX, "").trimEnd();
}

/**
 * Validation result for a friendly body.
 */
export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  variables: string[];
}

export function validateFriendlyBody(body: string): ValidationResult {
  const warnings: string[] = [];
  const variables = extractFriendlyVariables(body);

  // Check for malformed placeholders e.g. {{ }} or {{1abc}}
  const allPlaceholders = body.match(/\{\{[^}]*\}\}/g) || [];
  for (const ph of allPlaceholders) {
    const inner = ph.slice(2, -2).trim();
    if (!inner) {
      warnings.push("Empty placeholder {{}} found");
    } else if (/^\d+$/.test(inner)) {
      warnings.push(`Numeric placeholder {{${inner}}} found — use named variables instead`);
    } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(inner)) {
      warnings.push(`Malformed variable: {{${inner}}}`);
    }
  }

  return { valid: warnings.length === 0, warnings, variables };
}
