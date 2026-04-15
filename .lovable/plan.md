

# Plan: Improve Initial Loading Speed

## Problem

The `App.tsx` file eagerly imports **all 100+ page components** at the top level. When a user visits `/login`, the browser must download, parse, and execute JavaScript for every page in the application before anything renders — even though only the Login component is needed.

## Solution: Lazy Loading with Code Splitting

Convert all page imports to `React.lazy()` with dynamic `import()`. This tells Vite to split each page into its own chunk, so only the code needed for the current route is loaded.

### Changes

**1. `src/App.tsx`** — Convert all ~100 static imports to lazy imports with a Suspense wrapper

Replace:
```tsx
import Dashboard from "./pages/Dashboard";
import StoresList from "./pages/stores/StoresList";
// ... 100 more
```

With:
```tsx
import { lazy, Suspense } from "react";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const StoresList = lazy(() => import("./pages/stores/StoresList"));
// ... all pages
```

Wrap `<Routes>` in `<Suspense fallback={<LoadingSpinner />}>` so users see a brief loading indicator while a chunk loads.

Keep `Login` and `LandingPage` as **eager** imports since they are the primary entry points and should render instantly.

**2. Create `src/components/shared/PageLoader.tsx`** — A minimal centered spinner used as the Suspense fallback.

### Expected Impact

- `/login` bundle drops from the full app size (~2-3MB+) to just the Login component + shared UI (~100-200KB)
- Other pages load on-demand when navigated to
- First Contentful Paint (FCP) improves significantly
- No functional changes — everything works the same, just loads faster

### Technical Details

| Aspect | Detail |
|---|---|
| Files changed | `src/App.tsx`, new `src/components/shared/PageLoader.tsx` |
| Risk | Very low — lazy loading is a standard React pattern |
| Breaking changes | None |

