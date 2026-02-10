import { useState, useEffect, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { ScanLine, X, Camera, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  trigger?: React.ReactNode;
}

export function BarcodeScanner({ onScan, trigger }: BarcodeScannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerDivRef = useRef<HTMLDivElement | null>(null);
  const containerId = useRef(`scanner-${Date.now()}`);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      try {
        if (scanner.getState() === 2) {
          await scanner.stop();
        }
      } catch {}
    }
    // Imperatively clear the scanner div's children to prevent React conflicts
    if (scannerDivRef.current) {
      try {
        while (scannerDivRef.current.firstChild) {
          scannerDivRef.current.removeChild(scannerDivRef.current.firstChild);
        }
      } catch {}
    }
    setIsScanning(false);
  }, []);

  const startScanner = useCallback(async () => {
    if (scannerRef.current || !scannerDivRef.current) return;
    setError(null);

    const id = containerId.current;
    // Ensure the scanner target div exists
    let targetDiv = document.getElementById(id);
    if (!targetDiv && scannerDivRef.current) {
      // Clear and recreate
      while (scannerDivRef.current.firstChild) {
        scannerDivRef.current.removeChild(scannerDivRef.current.firstChild);
      }
      targetDiv = document.createElement("div");
      targetDiv.id = id;
      targetDiv.style.width = "100%";
      targetDiv.style.height = "100%";
      scannerDivRef.current.appendChild(targetDiv);
    }
    if (!targetDiv) return;

    try {
      const html5QrCode = new Html5Qrcode(id);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 280, height: 150 }, aspectRatio: 1.777 },
        (decodedText) => {
          toast.success(`Scanned: ${decodedText}`);
          onScan(decodedText);
          handleClose();
        },
        () => {}
      );
      setIsScanning(true);
    } catch (err: any) {
      console.error("Scanner error:", err);
      if (err.name === "NotAllowedError") {
        setError("Camera access denied. Please allow camera permission.");
      } else if (err.name === "NotFoundError") {
        setError("No camera found on this device.");
      } else {
        setError("Failed to start camera. Please try again.");
      }
    }
  }, [onScan]);

  const handleOpen = useCallback(() => {
    containerId.current = `scanner-${Date.now()}`;
    setError(null);
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(async () => {
    await stopScanner();
    setIsOpen(false);
    setError(null);
  }, [stopScanner]);

  // Setup scanner div imperatively when overlay opens
  useEffect(() => {
    if (isOpen && scannerDivRef.current) {
      // Clear any old content
      while (scannerDivRef.current.firstChild) {
        scannerDivRef.current.removeChild(scannerDivRef.current.firstChild);
      }
      const targetDiv = document.createElement("div");
      targetDiv.id = containerId.current;
      targetDiv.style.width = "100%";
      targetDiv.style.height = "100%";
      scannerDivRef.current.appendChild(targetDiv);

      const timer = setTimeout(() => startScanner(), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, startScanner]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopScanner(); };
  }, [stopScanner]);

  return (
    <>
      {trigger ? (
        <div onClick={handleOpen}>{trigger}</div>
      ) : (
        <Button type="button" variant="outline" size="icon" onClick={handleOpen}>
          <ScanLine className="h-4 w-4" />
        </Button>
      )}

      {/* Custom overlay instead of Dialog to avoid React reconciliation issues */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/80" onClick={handleClose} />
          
          {/* Content */}
          <div className="relative z-10 w-full max-w-md mx-4 bg-background rounded-lg shadow-lg border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Scan Barcode
              </h2>
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {error ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <span className="text-sm">{error}</span>
                </div>
                <Button onClick={startScanner} variant="outline">
                  Try Again
                </Button>
              </div>
            ) : (
              <>
                <div className="relative w-full aspect-video bg-muted rounded-lg overflow-hidden">
                  {/* This div is never managed by React's children — only imperatively */}
                  <div ref={scannerDivRef} className="w-full h-full" />
                  {!isScanning && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="animate-pulse text-muted-foreground">
                        Starting camera...
                      </div>
                    </div>
                  )}
                </div>
                <div className="text-center text-sm text-muted-foreground">
                  <p>Position the barcode within the frame</p>
                  <p className="text-xs mt-1">Supports EAN, UPC, Code 128, QR codes, and more</p>
                </div>
              </>
            )}

            <div className="flex justify-end">
              <Button variant="outline" onClick={handleClose}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default BarcodeScanner;
