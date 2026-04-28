## Add Purchase Intent Handler to WhatsApp Webhook

Insert a new "purchase intent" handler in `supabase/functions/whatsapp-inbound/index.ts` that runs between the assistance check and the order-history check, returning a deterministic TwiML reply pointing users to the Trayi Jewellers product catalogue.

### Execution order (after change)

1. Greeting (`hi`/`hello`/...) → welcome message
2. Assistance keywords (`help`, `support`, `issue`, ...) → falls through to fallback (logs request)
3. **Purchase intent (NEW)** → guided catalogue reply
4. Order history → last 3 orders
5. Store location → address reply
6. Product inquiry → Twilio template
7. Fallback → apology + log assistance request

### Changes to `supabase/functions/whatsapp-inbound/index.ts`

**1. Add constants near the other intent regexes (around line 50):**

```ts
const PURCHASE_INTENT_PATTERNS: RegExp[] = [
  /place.*order/i,
  /need.*buy/i,
  /want.*buy/i,
  /want.*purchase/i,
  /would.*like.*buy/i,
  /would.*like.*purchase/i,
  /\bbuy\b/i,
  /\bpurchase\b/i,
];
const isPurchaseIntent = (text: string): boolean =>
  PURCHASE_INTENT_PATTERNS.some((re) => re.test(text));

const PURCHASE_INTENT_REPLY =
  "That's wonderful to hear! At Trayi Jewellers, we specialise in finely curated jewellery, including exquisite diamonds and necklaces.\n\nYou can explore our latest collections here:\nhttps://trayijewellers.in/";
```

Note: `\bbuy\b` / `\bpurchase\b` use word boundaries so unrelated words like "buyer's remorse" or "purchaser" won't unnecessarily over-trigger, while still catching the requested bare "buy" / "purchase".

**2. Insert the handler immediately AFTER the assistance check and BEFORE the order-history block (around line 432):**

```ts
// 2a) Purchase intent — deterministic guided reply to the catalogue.
//     Runs before order-history so "want to buy" doesn't get misrouted.
const purchaseIntentDetected = !isAssistanceIntent && isPurchaseIntent(body);
if (purchaseIntentDetected) {
  console.log("[whatsapp-inbound] purchase-intent matched", {
    bodyPreview: body.slice(0, 120),
  });
  await logMessages(false);
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && serviceKey && normalizedFrom) {
      const sb = createClient(supabaseUrl, serviceKey);
      await sb.from("whatsapp_messages").insert({
        phone: normalizedFrom,
        customer_id: null,
        direction: "outbound",
        message: PURCHASE_INTENT_REPLY,
        message_type: "text",
        status: "sent",
        is_read: true,
      });
    }
  } catch (e) {
    console.error("[whatsapp-inbound] purchase-intent outbound log err", e);
  }
  return twiml(PURCHASE_INTENT_REPLY);
}
```

**3. Update the existing order-history gate (line 432) so purchase intent takes precedence:**

```ts
const orderIntentDetected =
  !isAssistanceIntent && !purchaseIntentDetected && isOrderHistoryIntent(body);
```

This prevents "place order" / "want to buy" from being captured by the `/\borders?\b/i` pattern in `ORDER_HISTORY_PATTERNS`.

### Constraints honoured

- No DB lookup performed for matching/responding — reply is fully static.
- Returned synchronously via TwiML (single Twilio round-trip, sub-second).
- Conversation thread logging is best-effort and wrapped in try/catch — never blocks the reply.
- Existing assistance, order-history, store-location, product, and fallback flows remain unchanged.

### Files touched

- `supabase/functions/whatsapp-inbound/index.ts` (edits only — no new files, no migrations, no UI changes)