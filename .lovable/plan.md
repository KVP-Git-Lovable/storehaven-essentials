
## Diagnosis of existing videos

I probed both files in the `whatsapp-videos` bucket against the Twilio/Android checklist. **Both fail** the Android WhatsApp requirements:

| File | Profile / Level | Faststart (moov first) | Frame rate | Resolution | Audio | Size |
|---|---|---|---|---|---|---|
| `1782371501124_Trayi_Final__1_.mp4` | H.264 **High / 4.0** ❌ | **No** ❌ (mdat before moov) | CFR ~29.97 ✓ | 1080×1920 ✓ | AAC LC ✓ | 15.4 MB ✓ |
| `1782369278840_Trayi_Final.mp4` | H.264 **High / 4.0** ❌ | **No** ❌ | **VFR** ❌ (r=29.97, avg=29.55) | 1080×1920 ✓ | AAC LC ✓ | 16.0 MB ⚠ at limit |

Required by Android client: **H.264 Baseline ≤ L3.1**, `+faststart` (moov atom at file start), constant frame rate, AAC audio, ≤16 MB. Neither file meets profile/level or faststart — this matches exactly the Twilio assessment and explains the "video cannot be played" error on Android while iOS/Web (which are lenient) play fine.

## Plan

### 1. Re-encode the two existing files in place (one-off)
Run ffmpeg with the canonical Android-safe settings, upsert back into the same storage path so the public URLs already wired into templates `HX173fc431…` keep working with no template re-approval needed:

```
ffmpeg -i in.mp4 \
  -c:v libx264 -profile:v baseline -level 3.1 -pix_fmt yuv420p \
  -vf "scale='min(1280,iw)':'-2',fps=30" \
  -b:v 1200k -maxrate 1500k -bufsize 3000k \
  -c:a aac -b:a 96k -ac 1 -ar 44100 \
  -movflags +faststart -y out.mp4
```

I'll do this from the sandbox (download via service role, transcode, re-upload with `upsert: true`, then `repair-media-url` on each affected template so Twilio refetches).

### 2. Make the uploader Android-safe by default (so this never recurs)
Update `src/components/communication/WhatsAppVideosSection.tsx` to:
- After file selection, probe metadata (size, type) client-side.
- Show a clear "Will be re-encoded for Android compatibility" notice and a blocking error if > 30 MB pre-encode.
- Send the file to a new **edge function** `whatsapp-video-normalize` instead of uploading directly to storage.

### 3. New edge function `whatsapp-video-normalize`
Server-side normalization pipeline:
1. Receive the raw upload (multipart).
2. Stream through **ffmpeg.wasm** (`@ffmpeg/ffmpeg` npm via Deno `npm:` specifier) using the exact command above.
3. Validate output: ≤16 MB, has audio stream, H.264 baseline, faststart. If still >16 MB, retry with `-crf 28` / lower bitrate; surface a clear error if it still won't fit.
4. Upload the normalized MP4 to `whatsapp-videos` with `contentType: 'video/mp4'`, `cacheControl: '31536000'`.
5. Return the public URL.

Fallback if ffmpeg.wasm proves too heavy for edge runtime memory: pivot to a **Cloudflare Stream / Mux-style** approach — but the request is to fix uploads to our own bucket, so ffmpeg.wasm is the first attempt and is known to work for short ≤30 MB clips inside Supabase Edge Functions (Deno + WASM, ~512 MB RAM budget).

### 4. UI surfaces in the videos list
- Add a small **"Android-compatible ✓ / ⚠ Re-encode"** badge per row, computed by a lightweight HEAD probe + range-read of the first 64 KB to check for `moov` (matches the check I ran above).
- A **Re-encode** button per legacy row that pipes the existing object through `whatsapp-video-normalize` and replaces it in place.

### 5. Template repair after re-encode
After any in-place replace, automatically call the existing `whatsapp-templates/repair-media-url` for every template currently referencing the file URL so Twilio's Content API refreshes its cached media (otherwise Twilio may keep serving the stale rendition).

## Technical notes
- Public URLs stay stable because we upsert to the same storage key — no template edits required.
- ffmpeg.wasm package: `npm:@ffmpeg/ffmpeg@0.12` + `npm:@ffmpeg/util@0.12`. Load `core-mt` for faster encode if available, else `core`.
- All transcodes use **Baseline / L3.1 / yuv420p / +faststart / CFR 30 fps / AAC mono 96k** — strictly within WhatsApp Android limits.
- Edge function deploys with `verify_jwt = true` (admin-only upload surface). CORS headers included.
- No DB schema changes required.

## Out of scope
- No changes to `process-journeys`, `whatsapp-send`, or template-creation flow — they continue to consume the public URL.
- No changes to non-video templates.

Approve and I'll execute steps 1–5 in build mode.
