import { lazy, ComponentType } from "react";

const RELOAD_KEY_PREFIX = "lazyRetry:";

/**
 * Wraps React.lazy with automatic retry on dynamic import failure.
 * If the import fails (typically due to a stale chunk after a deploy),
 * we trigger a one-time hard reload with a cache-busting marker.
 * If it fails again post-reload, we surface the error so the parent
 * error boundary can show a controlled fallback.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  name: string
) {
  return lazy(async () => {
    const key = RELOAD_KEY_PREFIX + name;
    try {
      const mod = await factory();
      // Success: clear retry flag
      try {
        window.sessionStorage.removeItem(key);
      } catch {}
      return mod;
    } catch (err) {
      const alreadyRetried = (() => {
        try {
          return window.sessionStorage.getItem(key) === "1";
        } catch {
          return false;
        }
      })();

      if (!alreadyRetried) {
        try {
          window.sessionStorage.setItem(key, "1");
        } catch {}
        // Cache-bust reload
        const url = new URL(window.location.href);
        url.searchParams.set("_r", Date.now().toString());
        window.location.replace(url.toString());
        // Return a never-resolving promise while reload happens
        return new Promise(() => {}) as Promise<{ default: T }>;
      }

      // Already retried — propagate so error boundary handles it
      throw err;
    }
  });
}
