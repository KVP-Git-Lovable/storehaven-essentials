import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Unregister any stale service workers and clear caches in the preview/dev sandbox
// to prevent "Failed to fetch dynamically imported module" white-screens caused
// by a previously-installed PWA service worker serving outdated chunk hashes.
const isPreviewOrDev =
  typeof window !== "undefined" &&
  (window.location.hostname.endsWith(".lovableproject.com") ||
    window.location.hostname.endsWith(".lovable.app") ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

if (isPreviewOrDev && typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => {
      if (regs.length > 0) {
        Promise.all(regs.map((r) => r.unregister()))
          .then(() => {
            if (typeof caches !== "undefined") {
              caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
                .finally(() => window.location.reload());
            } else {
              window.location.reload();
            }
          });
      }
    })
    .catch(() => {});
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
