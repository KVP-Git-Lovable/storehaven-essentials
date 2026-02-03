import { useEffect } from "react";
import { toast } from "sonner";

export function useServiceWorker() {
  useEffect(() => {
    // Register service worker updates
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                // New content is available
                toast.info("New version available!", {
                  description: "Click to refresh and get the latest updates.",
                  action: {
                    label: "Refresh",
                    onClick: () => window.location.reload(),
                  },
                  duration: 10000,
                });
              }
            });
          }
        });
      });
    }

    // Handle online/offline events
    const handleOnline = () => {
      toast.success("You're back online!", {
        description: "Your changes will be synced automatically.",
      });
    };

    const handleOffline = () => {
      toast.warning("You're offline", {
        description: "Some features may be limited. Data will sync when you're back online.",
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
}
