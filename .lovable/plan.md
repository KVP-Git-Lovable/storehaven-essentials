# Themes Switcher

Add a Themes picker next to the notification bell on every page. Three themes, each user's choice persisted so it follows them across sessions and devices. No operational changes.

## 1. Theme definitions (design tokens in `src/index.css`)

All theme colors live as HSL CSS variables under theme selectors on `<html>`. Components already consume semantic tokens (`--primary`, `--sidebar-background`, etc.), so switching a class on `<html>` re-skins the whole app — including every button currently rendered in blue.

- `html.theme-amber` (**Default**)
  - Sidebar background: warm neutral grey (`220 8% 22%`) instead of near-black
  - Sidebar logo strip: gradient `linear-gradient(90deg, hsl(28 95% 55%), hsl(20 15% 15%))` set via a new `--sidebar-logo-gradient` token; the logo/company-name container uses `bg-[image:var(--sidebar-logo-gradient)]`
  - `--primary`: amber `28 95% 55%` (all blue CTAs become orange)
  - `--ring`, `--sidebar-primary`: match primary
  - Sidebar icon accent tokens (see §3) → colorful palette
- `html.theme-blue` (current look, no visual change)
  - Keeps today's `:root` values verbatim
  - Only sidebar icon accent tokens are added so icons match the colorful reference
- `html.theme-pink`
  - Sidebar background: warm neutral grey (`320 8% 24%`)
  - Sidebar logo strip: gradient `linear-gradient(90deg, hsl(330 85% 78%), hsl(280 55% 55%))`
  - `--primary`: strawberry pink `338 82% 58%`
  - `--ring`, `--sidebar-primary`: match primary
  - Sidebar icon accent tokens → colorful palette

The default (before any user preference loads) is `theme-amber` to match the stated default.

## 2. Colorful sidebar icons (all themes)

Reference screenshot shows each nav icon in its own tile color. Introduce a stable per-nav-item accent (defined once in `AppSidebar.tsx`) and render the icon inside a small rounded tile using that color. Colors are hard-coded utility classes on the tile only (they are decorative brand accents, not text/background surfaces), applied identically in all three themes as requested.

Mapping (examples): Home = indigo, AI Insights = violet, Dashboards = sky, POS = emerald, Transactions = amber, New Store Plan = rose, Store Management = teal, Employee = fuchsia, Communication Center = blue, Inventory = orange, Admin = slate.

## 3. Header control

In `src/components/layout/AppHeader.tsx`, add a `Palette` (lucide) icon button immediately left of the notification bell:

- `DropdownMenu` with three items: "Amber" (default), "Blue & Black", "Light Pink"
- Each item shows a small color swatch + label; the active theme has a check
- The trigger is wrapped in a `Tooltip` ("Themes"); each dropdown item is also wrapped in a `Tooltip` so hovering shows the theme name

## 4. Persistence per user

- Add a `theme_preference TEXT` column to `profiles` (allowed values: `amber` | `blue` | `pink`, default `amber`). Migration includes GRANTs already present for `profiles`; no policy changes needed since users can already update their own row.
- New `ThemeProvider` (`src/components/theme/ThemeProvider.tsx`) mounted inside `App.tsx` above the router:
  - On mount: read `localStorage.theme` for instant paint, then when `useAuth().profile` is available overwrite from `profile.theme_preference`
  - Applies theme by toggling `theme-amber` / `theme-blue` / `theme-pink` classes on `document.documentElement`
  - Exposes `useTheme()` hook with `{ theme, setTheme }`. `setTheme` writes to `localStorage` immediately, updates the class, and (if logged in) upserts `profiles.theme_preference` for the current `user.id`
- Extend the `Profile` type in `AuthProvider.tsx` and its `select(...)` to include `theme_preference` so it hydrates on login.

## 5. Files touched

- `src/index.css` — add `.theme-amber`, `.theme-blue`, `.theme-pink` blocks + `--sidebar-logo-gradient` token
- `src/components/theme/ThemeProvider.tsx` — new
- `src/hooks/useTheme.ts` — new
- `src/App.tsx` — wrap with `ThemeProvider`
- `src/components/auth/AuthProvider.tsx` — add `theme_preference` to profile select/type
- `src/components/layout/AppHeader.tsx` — Themes dropdown before the bell
- `src/components/layout/AppSidebar.tsx` — use `bg-sidebar` (already token-based), swap logo strip background to `var(--sidebar-logo-gradient)`, render each nav icon inside a colored tile
- Supabase migration — `ALTER TABLE public.profiles ADD COLUMN theme_preference TEXT NOT NULL DEFAULT 'amber' CHECK (theme_preference IN ('amber','blue','pink'));`

## Out of scope

No changes to any business logic, permissions, routing, or data flows.
