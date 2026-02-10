import { useState, useEffect, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScanLine, X, Camera, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  trigger?: React.ReactNode;
}

/**
 * Wrapper component that creates a DOM node for html5-qrcode imperatively,
 * preventing React from trying to reconcile nodes that html5-qrcode manages.
 */
function ScannerContainer({ id, isScanning }: { id: string; isScanning: boolean }) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    // Create scanner div imperatively so React doesn't track its children
    const scannerDiv = document.createElement("div");
    scannerDiv.id = id;
    scannerDiv.style.width = "100%";
    scannerDiv.style.height = "100%";
    wrapper.appendChild(scannerDiv);

    return () => {
      // Clean up imperatively — safe from React reconciliation errors
      while (wrapper.firstChild) {
        wrapper.removeChild(wrapper.firstChild);
      }
    };
  }, [id]);

  return (
    <div className="relative w-full aspect-video bg-muted rounded-lg overflow-hidden">
      <div ref={wrapperRef} className="w-full h-full" />
      {!isScanning && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">
            Starting camera...
          </div>
        </div>
      )}
    </div>
  );
}

export function BarcodeScanner({ onScan, trigger }: BarcodeScannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isMountedRef = useRef(true);
  const scannerContainerId = useRef(`barcode-scanner-${Date.now()}`);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    
    if (scanner) {
      try {
        const state = scanner.getState();
        if (state === 2) {
          await scanner.stop();
        }
      } catch (err) {
        // Ignore stop errors
      }
    }
    
    if (isMountedRef.current) {
      setIsScanning(false);
    }
  }, []);

  const startScanner = useCallback(async () => {
    const containerId = scannerContainerId.current;
    const container = document.getElementById(containerId);
    if (!container || scannerRef.current) return;
    
    setError(null);
    
    try {
      const html5QrCode = new Html5Qrcode(containerId);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 280, height: 150 },
          aspectRatio: 1.777,
        },
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        () => {}
      );

      if (isMountedRef.current) {
        setIsScanning(true);
      }
    } catch (err: any) {
      console.error("Scanner error:", err);
      if (isMountedRef.current) {
        if (err.name === "NotAllowedError") {
          setError("Camera access denied. Please allow camera permission to scan barcodes.");
        } else if (err.name === "NotFoundError") {
          setError("No camera found on this device.");
        } else {
          setError("Failed to start camera. Please try again.");
        }
      }
    }
  }, [stopScanner]);

  const handleScanSuccess = useCallback((barcode: string) => {
    toast.success(`Scanned: ${barcode}`);
    onScan(barcode);
    stopScanner();
    setIsOpen(false);
    setError(null);
  }, [onScan, stopScanner]);

  const handleOpen = useCallback(() => {
    scannerContainerId.current = `barcode-scanner-${Date.now()}`;
    setIsOpen(true);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    stopScanner();
    setIsOpen(false);
    setError(null);
  }, [stopScanner]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        startScanner();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen, startScanner]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
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

      <Dialog 
        open={isOpen} 
        onOpenChange={(open) => {
          if (!open) {
            stopScanner();
            setIsOpen(false);
            setError(null);
          }
        }}
        modal={true}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Scan Barcode
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
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
                <ScannerContainer id={scannerContainerId.current} isScanning={isScanning} />

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
        </DialogContent>
      </Dialog>
    </>
  );
}

export default BarcodeScanner;
