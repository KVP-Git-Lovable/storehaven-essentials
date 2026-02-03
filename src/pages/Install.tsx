import { useNavigate } from "react-router-dom";
import { Download, Share, Plus, Smartphone, Monitor, Check, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePWAInstall } from "@/hooks/usePWAInstall";

export default function Install() {
  const navigate = useNavigate();
  const { isInstallable, isInstalled, isIOS, isStandalone, promptInstall } = usePWAInstall();

  const handleInstall = async () => {
    const success = await promptInstall();
    if (success) {
      navigate("/dashboard");
    }
  };

  if (isInstalled || isStandalone) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 mb-4">
              <Check className="h-8 w-8 text-success" />
            </div>
            <CardTitle>Already Installed!</CardTitle>
            <CardDescription>
              StoreOps is installed on your device. Enjoy the full app experience!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate("/dashboard")}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl mx-auto px-4 py-8">
        <Button variant="ghost" className="mb-6" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="text-center mb-8">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 mb-4">
            <img src="/pwa-icon.png" alt="StoreOps" className="h-14 w-14 rounded-xl" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Install StoreOps</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Install StoreOps on your device for offline access, faster loading, and a native app experience.
          </p>
        </div>

        {/* Features */}
        <div className="grid gap-4 mb-8">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Download className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">Works Offline</h3>
                <p className="text-sm text-muted-foreground">
                  Access core features even without internet connection
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">Native Experience</h3>
                <p className="text-sm text-muted-foreground">
                  Fullscreen mode, home screen icon, and push notifications
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Monitor className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">Cross-Platform</h3>
                <p className="text-sm text-muted-foreground">
                  Install on Android, iOS, Windows, Mac, and Linux
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Install Instructions */}
        {isIOS ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Install on iOS (Safari)
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
            </CardContent>
          </Card>
        ) : isInstallable ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Quick Install
              </CardTitle>
              <CardDescription>
                Click the button below to install StoreOps instantly
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" size="lg" onClick={handleInstall}>
                <Download className="h-5 w-5 mr-2" />
                Install StoreOps
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Browser Install</CardTitle>
              <CardDescription>
                Use your browser's install option to add StoreOps
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  1
                </div>
                <div>
                  <p className="font-medium">Look for install icon in address bar</p>
                  <p className="text-sm text-muted-foreground">
                    Chrome/Edge: Install icon appears on the right side of the address bar
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  2
                </div>
                <div>
                  <p className="font-medium">Or use browser menu</p>
                  <p className="text-sm text-muted-foreground">
                    Menu → "Install StoreOps" or "Add to Home Screen"
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
