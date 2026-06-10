// Deno test: ensures the backend TOKEN_SOURCES stays in sync with the
// frontend registry at src/lib/variables/registry.ts. Run via the
// supabase--test_edge_functions tool.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { TOKEN_SOURCES } from "./variable-registry.ts";

// Read the frontend registry as text and extract every `{ name: "...", ... source: { kind: "..." ... } }`.
// We parse text rather than importing the TSX-adjacent module so this test
// works inside the Deno sandbox without a bundler.
async function loadFrontendTokens(): Promise<Map<string, string>> {
  const url = new URL("../../../src/lib/variables/registry.ts", import.meta.url);
  const text = await Deno.readTextFile(url);
  const leafRe = /\{\s*name:\s*"([a-zA-Z0-9_]+)"\s*,[^}]*?source:\s*\{\s*kind:\s*"([a-zA-Z_]+)"/g;
  const out = new Map<string, string>();
  let m: RegExpExecArray | null;
  while ((m = leafRe.exec(text)) !== null) {
    if (m[2] === "unimplemented") continue;
    out.set(m[1], m[2]);
  }
  return out;
}

Deno.test("every resolvable frontend token has a backend source", async () => {
  const fe = await loadFrontendTokens();
  const missing: string[] = [];
  for (const [name, kind] of fe) {
    const be = TOKEN_SOURCES[name];
    if (!be) missing.push(`${name} (${kind})`);
  }
  assertEquals(missing, [], `Tokens in frontend registry but missing from backend TOKEN_SOURCES: ${missing.join(", ")}`);
});

Deno.test("every backend token exists in frontend registry", async () => {
  const fe = await loadFrontendTokens();
  const stray: string[] = [];
  for (const name of Object.keys(TOKEN_SOURCES)) {
    if (!fe.has(name)) stray.push(name);
  }
  assertEquals(stray, [], `Tokens in backend TOKEN_SOURCES but missing from frontend registry: ${stray.join(", ")}`);
});