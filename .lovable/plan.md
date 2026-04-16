

# Plan: Fix Login Page Load Performance

## Root Cause

`LandingPage` is **eagerly imported** on line 14 of `App.tsx`. It pulls in 8 child components (`LandingHeader`, `HeroSection`, `FeatureModules`, `FeatureShowcase`, `ComparisonTable`, `IndustrySection`, `CTASection`, `LandingFooter`) plus ~20 lucide icons. All of this is bundled into the **main chunk** and downloaded before the Login page can render, even when the user navigates directly to `/login`.

This was likely introduced when eager imports were set up — Login is small and fine to keep eager, but LandingPage should not be.

## Fix

**`src/App.tsx`** — Change LandingPage from eager to lazy import:

- Remove line 14: `import LandingPage from "./pages/landing/LandingPage";`
- Add: `const LandingPage = lazy(() => import("./pages/landing/LandingPage"));`

This single change moves the entire landing page and its 8 sub-components out of the critical bundle, significantly reducing the JavaScript that must be parsed before `/login` renders.

## What Will NOT Change

- Login stays eagerly imported (it's lightweight)
- No other files modified
- No database or backend changes

