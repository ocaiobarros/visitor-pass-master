import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, CameraOff, X, RefreshCw } from 'lucide-react';

interface CameraScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

const CameraScannerModal = ({ open, onClose, onScan }: CameraScannerModalProps) => {
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const startScanner = async () => {
    if (!containerRef.current) return;

    setIsStarting(true);
    setError(null);

    try {
      // Clean up existing scanner
      if (scannerRef.current) {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      }

      const scanner = new Html5Qrcode('camera-scanner-container');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' }, // Use back camera
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (decodedText) => {
          // Success callback
          handleSuccessfulScan(decodedText);
        },
        () => {
          // Error callback (ignore continuous scan errors)
        }
      );
    } catch (err: any) {
      console.error('Camera scanner error:', err);
      
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission')) {
        setError('Acesso à câmera negado. Por favor, permita o acesso à câmera nas configurações do navegador.');
      } else if (err.name === 'NotFoundError') {
        setError('Nenhuma câmera encontrada no dispositivo.');
      } else if (err.name === 'NotReadableError') {
        setError('A câmera está sendo usada por outro aplicativo.');
      } else {
        setError('Não foi possível iniciar a câmera. Verifique as permissões.');
      }
    } finally {
      setIsStarting(false);
    }
  };

  const handleSuccessfulScan = async (code: string) => {
    // Stop scanner first
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop();
        }
      } catch (e) {
        console.error('Error stopping scanner:', e);
      }
    }

    // Trigger callback
    onScan(code);
    onClose();
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        console.error('Error stopping scanner:', e);
      }
      scannerRef.current = null;
    }
  };

  useEffect(() => {
    if (open) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        startScanner();
      }, 300);
      return () => clearTimeout(timer);
    } else {
      stopScanner();
    }
  }, [open]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const handleClose = () => {
    stopScanner();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            Escanear com Câmera
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          {/* Scanner Container */}
          <div
            id="camera-scanner-container"
            ref={containerRef}
            className="w-full aspect-square bg-black"
          />

          {/* Overlay with targeting reticle */}
          {!error && !isStarting && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-64 border-2 border-primary rounded-lg relative">
                  {/* Corner markers */}
                  <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                  <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                  <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                  <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg" />
                </div>
              </div>
              <div className="absolute bottom-4 left-0 right-0 text-center">
                <p className="text-white text-sm bg-black/50 inline-block px-3 py-1 rounded-full">
                  Posicione o QR Code na mira
                </p>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isStarting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
              <RefreshCw className="w-10 h-10 text-white animate-spin mb-3" />
              <p className="text-white text-sm">Iniciando câmera...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-6">
              <CameraOff className="w-16 h-16 text-destructive mb-4" />
              <p className="text-white text-center text-sm mb-4">{error}</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={startScanner}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Tentar Novamente
                </Button>
                <Button variant="ghost" onClick={handleClose} className="text-white">
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 pt-0">
          <Button variant="outline" onClick={handleClose} className="w-full">
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CameraScannerModal;
