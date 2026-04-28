import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { AppErrorBoundary } from "./components/shared/AppErrorBoundary";

// Detect Lovable preview / iframe / dev environments where service workers
// from previously-published builds can serve stale module chunks and white-screen the app.
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const host = window.location.hostname;
const isPreviewHost =
  host.includes("lovableproject.com") ||
  host.includes("lovable.app") ||
  host.includes("id-preview--") ||
  host === "localhost" ||
  host === "127.0.0.1";

const isProdBuild = import.meta.env.PROD;

// Unregister stale service workers + clear caches in dev/preview/iframe contexts.
// In a true production deployment (not a preview iframe), leave the SW alone.
if ("serviceWorker" in navigator && (!isProdBuild || isInIframe || host.includes("id-preview--"))) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => regs.forEach((r) => r.unregister()))
    .catch(() => {});
  if ("caches" in window) {
    caches
      .keys()
      .then((keys) => keys.forEach((k) => caches.delete(k)))
      .catch(() => {});
  }
}

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
