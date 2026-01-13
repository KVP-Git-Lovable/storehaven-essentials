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
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) { // Html5QrcodeScannerState.SCANNING
          await scannerRef.current.stop();
        }
      } catch (err) {
        // Ignore stop errors
      }
      
      try {
        await scannerRef.current.clear();
      } catch (err) {
        // Manually clear the container if clear fails
        const container = document.getElementById(scannerContainerId.current);
        if (container) {
          container.innerHTML = '';
        }
      }
      
      scannerRef.current = null;
    }
    if (isMountedRef.current) {
      setIsScanning(false);
    }
  }, []);

  const startScanner = useCallback(async () => {
    const containerId = scannerContainerId.current;
    const container = document.getElementById(containerId);
    if (!container) return;
    
    setError(null);
    
    // Ensure any previous instance is cleaned up
    await stopScanner();
    
    // Clear the container before starting
    container.innerHTML = '';
    
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
        () => {
          // Ignore errors during scanning (no QR code in frame)
        }
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
    handleClose();
  }, [onScan]);

  const handleOpen = useCallback(() => {
    scannerContainerId.current = `barcode-scanner-${Date.now()}`;
    setIsOpen(true);
    setError(null);
  }, []);

  const handleClose = useCallback(async () => {
    await stopScanner();
    setIsOpen(false);
    setError(null);
  }, [stopScanner]);

  // Start scanner when dialog opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure the container is mounted
      const timer = setTimeout(() => {
        startScanner();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen, startScanner]);

  // Cleanup on unmount
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
            handleClose();
          }
        }}
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
                <div 
                  id={scannerContainerId.current}
                  className="relative w-full aspect-video bg-muted rounded-lg overflow-hidden"
                >
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
        </DialogContent>
      </Dialog>
    </>
  );
}

export default BarcodeScanner;
