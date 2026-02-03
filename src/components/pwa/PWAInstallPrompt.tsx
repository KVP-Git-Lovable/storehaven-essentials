import { useState, useEffect } from "react";
import { X, Download, Share, Plus, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePWAInstall } from "@/hooks/usePWAInstall";

export function PWAInstallPrompt() {
  const { isInstallable, isInstalled, isIOS, isStandalone, promptInstall } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Check if previously dismissed
    const wasDismissed = localStorage.getItem("pwa-install-dismissed");
    if (wasDismissed) {
      const dismissedTime = parseInt(wasDismissed);
      // Show again after 7 days
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        setDismissed(true);
      }
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
  };

  const handleInstall = async () => {
    const success = await promptInstall();
    if (success) {
      handleDismiss();
    }
  };

  // Don't show if installed, dismissed, or in standalone mode
  if (isInstalled || dismissed || isStandalone) {
    return null;
  }

  // Show iOS guide
  if (isIOS && showIOSGuide) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2"
              onClick={() => setShowIOSGuide(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Install StoreOps on iOS
            </CardTitle>
            <CardDescription>
              Follow these steps to add StoreOps to your home screen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                1
              </div>
              <div>
                <p className="font-medium">Tap the Share button</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  Look for <Share className="h-4 w-4" /> at the bottom of Safari
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                2
              </div>
              <div>
                <p className="font-medium">Scroll and tap "Add to Home Screen"</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  Look for <Plus className="h-4 w-4 border rounded" /> Add to Home Screen
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                3
              </div>
              <div>
                <p className="font-medium">Tap "Add" to confirm</p>
                <p className="text-sm text-muted-foreground">
                  StoreOps will appear on your home screen
                </p>
              </div>
            </div>
            <Button className="w-full mt-4" onClick={() => setShowIOSGuide(false)}>
              Got it!
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show install banner for iOS
  if (isIOS) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
        <Card className="shadow-lg border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <img src="/pwa-icon.png" alt="StoreOps" className="h-8 w-8 rounded-lg" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm">Install StoreOps</h4>
                <p className="text-xs text-muted-foreground">
                  Add to home screen for the best experience
                </p>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0" onClick={handleDismiss}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => setShowIOSGuide(true)}>
                <Share className="h-4 w-4 mr-1" />
                How to Install
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show install banner for Android/Desktop
  if (isInstallable) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
        <Card className="shadow-lg border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <img src="/pwa-icon.png" alt="StoreOps" className="h-8 w-8 rounded-lg" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm">Install StoreOps</h4>
                <p className="text-xs text-muted-foreground">
                  Install for offline access and a native app experience
                </p>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0" onClick={handleDismiss}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={handleDismiss}>
                Not now
              </Button>
              <Button size="sm" className="flex-1" onClick={handleInstall}>
                <Download className="h-4 w-4 mr-1" />
                Install
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
