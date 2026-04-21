

## Publish Trayi Jewellery promo image as a public marketing URL

Make the uploaded image available as a permanent, hot-linkable URL on `https://storeops.quickapp.ai` so it can be used in WhatsApp/Email campaigns, social posts, and ads.

### What will be done

1. Copy the uploaded image into the project at:
   - `public/marketing/trayi-jewellery-10-percent-discount.jpg`
   
   Files in `public/` are served as-is at the site root, so after the next publish it will be available at:
   - **https://storeops.quickapp.ai/marketing/trayi-jewellery-10-percent-discount.jpg**
   - (Also on the preview: `https://toreops.lovable.app/marketing/trayi-jewellery-10-percent-discount.jpg`)

2. File naming chosen for marketing best practice:
   - lowercase, hyphenated, descriptive (good for SEO + readable in WhatsApp/email previews)
   - `.jpg` extension (smaller payload than PNG; ideal for photographic banners and for WhatsApp template media which prefers JPG/PNG ≤ 5 MB)

3. No app code, routes, or components are touched — purely a static asset drop in `public/`.

### Activation

Static assets in `public/` are part of the frontend bundle, so the URL goes live on the custom domain only **after you click "Publish → Update"** in the editor. The preview URL works immediately.

### Files

- **New:** `public/marketing/trayi-jewellery-10-percent-discount.jpg` (copied from the uploaded screenshot)

No other files modified. No DB, no edge functions, no UI changes.

### After approval, you'll get

- Final marketing URL: `https://storeops.quickapp.ai/marketing/trayi-jewellery-10-percent-discount.jpg`
- Ready to paste into WhatsApp template media, email banners, or campaign links.

