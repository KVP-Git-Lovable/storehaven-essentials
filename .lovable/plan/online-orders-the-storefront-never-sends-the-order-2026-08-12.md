# Online Orders: the storefront never sends the order

## What I found

The backend on this side is working. Verified this turn:

- The `online_orders` table exists and is empty (0 rows) — nothing has ever been submitted.
- The `create_online_order` function is deployed and public; its logs show no incoming requests, only idle shutdowns.
- In the Trayi Lumina storefront, the "Place Order" handler in `src/routes/checkout.tsx` is a simulated submit: it waits 900ms, generates a random reference (`"TR" + Math.random()...`), clears the cart and navigates to the confirmation page. There is no network call at all.

So the reference `TR3ZDA9B` was invented in the browser. Nothing was ever sent to this project, which is why Online Orders stays empty.

## What needs to change

The fix belongs in the **Trayi Lumina** project. No changes are needed in this project.

In Trayi Lumina, `src/routes/checkout.tsx` should:

1. Read the submitted form values (name, email, phone, address1/2, city, state, pincode, pickup_date) instead of ignoring them.
2. Build the line items and totals from the cart store.
3. POST to this project's endpoint before navigating:
   - URL: `https://pdtasnfsdnfttayxibqy.functions.supabase.co/create_online_order`
   - Headers: `Content-Type: application/json`, plus `apikey` and `Authorization: Bearer <this project's anon key>`
   - Body: `customerName`, `customerEmail`, `customerPhone`, `fulfillmentMethod` (`"delivery"` or `"pickup"`), `shippingAddress: { line1, line2, city, state, pincode }` for delivery, `preferredPickupDate` for pickup, `items[]`, `subtotal`, `totalAmount`.
4. Use the `orderNumber` returned in the response as the confirmation reference, so the thank-you page matches the row in Online Orders. Only clear the cart and navigate on success; on failure show an error toast and keep the cart.

Note: the key used must be this project's anon key — Trayi Lumina's own backend client cannot be used for this call; it needs a plain `fetch` with this project's URL and key.

## Technical notes

- The function runs with `verify_jwt = false`, so no signed-in user is required, but the gateway still needs the `apikey`/`Authorization` headers present.
- Server-side validation: name, email, phone, valid fulfillment method, non-empty items, subtotal and totalAmount. Delivery requires `shippingAddress`; pickup requires `preferredPickupDate`.
- Once a real order arrives it appears immediately in `/transactions/online-orders` here — no further work on this side.

## Next step

Switch to the Trayi Lumina project and request this checkout change there; the payload shape above is exactly what the endpoint expects.