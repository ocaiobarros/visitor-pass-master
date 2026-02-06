import { useState, useRef, useEffect, useCallback } from 'react';
import { useVisitorByPassId, useUpdateVisitorStatus } from '@/hooks/useVisitors';
import { useCredentialByQrId } from '@/hooks/useEmployeeCredentials';
import { useCreateAccessLog } from '@/hooks/useAccessLogs';
import { useScanFeedback } from '@/hooks/useScanFeedback';
import { Camera, User, Car, CheckCircle, XCircle, AlertTriangle, ArrowLeft, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Visitor, EmployeeCredential } from '@/types/visitor';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '@/components/BrandLogo';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type ScanResult = {
  type: 'visitor';
  data: Visitor;
  status: 'allowed' | 'blocked' | 'expired';
} | {
  type: 'employee';
  data: EmployeeCredential;
  status: 'allowed' | 'blocked';
} | {
  type: 'error';
  code: string;
} | null;

const ScanKiosk = () => {
  const [qrCode, setQrCode] = useState('');
  const [searchCode, setSearchCode] = useState('');
  const [scanResult, setScanResult] = useState<ScanResult>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsClicks, setSettingsClicks] = useState(0);
  const [currentTime, setCurrentTime] = useState(format(new Date(), 'HH:mm:ss'));
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const focusIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const printRef = useRef<HTMLDivElement>(null);
  
  const navigate = useNavigate();
  const { playSuccess, playError, playBlocked } = useScanFeedback();
  const updateVisitorStatus = useUpdateVisitorStatus();
  const createAccessLog = useCreateAccessLog();

  // Queries
  const { data: visitor, isLoading: isLoadingVisitor } = useVisitorByPassId(
    searchCode.startsWith('VP-') ? searchCode : ''
  );
  const { data: credential, isLoading: isLoadingCredential } = useCredentialByQrId(
    searchCode.startsWith('EC-') ? searchCode : ''
  );

  // Update clock
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(format(new Date(), 'HH:mm:ss'));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Force focus on input (kiosk mode - eternal focus)
  const forceFocus = useCallback(() => {
    if (!scanResult && inputRef.current) {
      inputRef.current.focus();
    }
  }, [scanResult]);

  // Auto fullscreen on mount
  useEffect(() => {
    const enterFullscreen = async () => {
      try {
        if (containerRef.current && !document.fullscreenElement) {
          await containerRef.current.requestFullscreen();
          setIsFullscreen(true);
        }
      } catch (e) {
        // Fullscreen might not be available
      }
    };
    enterFullscreen();
    
    // Track fullscreen changes
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    // Eternal focus guard
    focusIntervalRef.current = setInterval(forceFocus, 1000);
    
    return () => {
      if (focusIntervalRef.current) clearInterval(focusIntervalRef.current);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [forceFocus]);

  // Focus after result clears
  useEffect(() => {
    if (!scanResult) {
      setTimeout(forceFocus, 100);
    }
  }, [scanResult, forceFocus]);

  // Auto-reset after showing result
  const scheduleReset = useCallback((delay: number = 3000) => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      setScanResult(null);
      setSearchCode('');
      setQrCode('');
    }, delay);
  }, []);

  // Process scan result
  useEffect(() => {
    if (!searchCode) return;

    const timer = setTimeout(async () => {
      if (searchCode.startsWith('VP-')) {
        if (visitor) {
          let status: 'allowed' | 'blocked' | 'expired' = 'allowed';
          
          if (visitor.status === 'closed') {
            status = 'blocked';
            playBlocked();
          } else if (new Date() > new Date(visitor.validUntil)) {
            status = 'expired';
            playBlocked();
          } else {
            status = 'allowed';
            playSuccess();
            
            // Auto register entry if allowed
            if (visitor.status !== 'inside') {
              await updateVisitorStatus.mutateAsync({ id: visitor.id, status: 'inside' });
              await createAccessLog.mutateAsync({
                subjectType: 'visitor',
                subjectId: visitor.id,
                direction: 'in',
              });
            }
          }
          
          setScanResult({ type: 'visitor', data: visitor, status });
          scheduleReset(status === 'allowed' ? 3000 : 4000);
        } else if (!isLoadingVisitor) {
          playError();
          setScanResult({ type: 'error', code: searchCode });
          scheduleReset(3000);
        }
      } else if (searchCode.startsWith('EC-')) {
        if (credential) {
          if (credential.status === 'blocked') {
            playBlocked();
            setScanResult({ type: 'employee', data: credential, status: 'blocked' });
          } else {
            playSuccess();
            // Auto register entry
            await createAccessLog.mutateAsync({
              subjectType: 'employee',
              subjectId: credential.id,
              direction: 'in',
            });
            setScanResult({ type: 'employee', data: credential, status: 'allowed' });
          }
          scheduleReset(3000);
        } else if (!isLoadingCredential) {
          playError();
          setScanResult({ type: 'error', code: searchCode });
          scheduleReset(3000);
        }
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchCode, visitor, credential, isLoadingVisitor, isLoadingCredential, playSuccess, playError, playBlocked, scheduleReset, updateVisitorStatus, createAccessLog]);

  // Handle scan input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && qrCode.trim()) {
      e.preventDefault();
      const code = qrCode.toUpperCase().trim();
      
      if (code.startsWith('VP-') || code.startsWith('EC-')) {
        setSearchCode(code);
      } else {
        playError();
        setScanResult({ type: 'error', code });
        scheduleReset(3000);
      }
      setQrCode('');
    }
  };

  // Secret settings access (triple click on logo)
  const handleLogoClick = () => {
    setSettingsClicks(prev => prev + 1);
    setTimeout(() => setSettingsClicks(0), 2000);
    
    if (settingsClicks >= 2) {
      setShowSettings(true);
      setSettingsClicks(0);
    }
  };

  const handleExit = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
    navigate('/dashboard');
  };

  // Print badge
  const handlePrint = () => {
    if (!scanResult || scanResult.type === 'error') return;
    window.print();
  };

  const isLoading = isLoadingVisitor || isLoadingCredential;

  // ==================== RESULT SCREENS ====================
  
  // ALLOWED - Green fullscreen
  if (scanResult && ((scanResult.type === 'visitor' && scanResult.status === 'allowed') || 
      (scanResult.type === 'employee' && scanResult.status === 'allowed'))) {
    const isVehicle = scanResult.type === 'employee' && scanResult.data.type === 'vehicle';
    const isVisitor = scanResult.type === 'visitor';
    
    return (
      <div 
        ref={containerRef}
        className="min-h-screen flex flex-col items-center justify-center p-8 bg-kiosk-allowed print:bg-white"
      >
        {/* Header bar - hidden on print */}
        <div className="absolute top-0 left-0 right-0 py-4 px-8 text-center bg-black/20 print:hidden">
          <h1 className="text-4xl md:text-5xl font-black tracking-wider text-white">
            ✓ ACESSO LIBERADO
          </h1>
        </div>

        {/* Botão Voltar - SEMPRE visível */}
        <div
          className="fixed z-50 print:hidden"
          style={{
            top: 'calc(1rem + env(safe-area-inset-top))',
            left: 'calc(1rem + env(safe-area-inset-left))',
          }}
        >
          <Button
            variant="outline"
            onClick={handleExit}
            className="gap-2 bg-background/90 shadow-lg border border-border"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
        </div>

        {/* Botão Imprimir */}
        <div className="absolute top-4 right-4 z-20 print:hidden">
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            Imprimir
          </Button>
        </div>

        {/* Main content */}
        <div ref={printRef} className="flex flex-col md:flex-row items-center gap-8 md:gap-12 mt-16 print:mt-0 print:flex-col print:text-black">
          {/* Photo */}
          <div className="w-40 h-40 md:w-56 md:h-56 rounded-2xl flex items-center justify-center overflow-hidden border-4 bg-white/90 border-white/50 print:w-32 print:h-32 print:border-gray-300">
            {scanResult.data.photoUrl ? (
              <img src={scanResult.data.photoUrl} alt="" className="w-full h-full object-cover" />
            ) : isVehicle ? (
              <Car className="w-24 h-24 text-foreground print:text-gray-700" />
            ) : (
              <User className="w-24 h-24 text-foreground print:text-gray-700" />
            )}
          </div>

          {/* Info */}
          <div className="text-center md:text-left text-white print:text-black">
            {isVehicle && scanResult.type === 'employee' && (
              <>
                <p className="text-2xl mb-2 flex items-center justify-center md:justify-start gap-2 print:text-lg print:text-gray-600">
                  <Car className="w-8 h-8 print:w-5 print:h-5" /> VEÍCULO AUTORIZADO
                </p>
                <h2 className="text-5xl md:text-6xl font-black mb-4 print:text-3xl">{scanResult.data.vehiclePlate}</h2>
                {scanResult.data.vehicleMakeModel && (
                  <p className="text-2xl opacity-90 print:text-lg">{scanResult.data.vehicleMakeModel}</p>
                )}
                <p className="text-3xl mt-4 print:text-xl">Motorista: <strong>{scanResult.data.fullName}</strong></p>
              </>
            )}
            
            {!isVehicle && scanResult.type === 'employee' && (
              <>
                <h2 className="text-5xl md:text-6xl font-black mb-4 print:text-3xl">{scanResult.data.fullName}</h2>
                {scanResult.data.jobTitle && (
                  <p className="text-3xl opacity-90 print:text-xl">{scanResult.data.jobTitle}</p>
                )}
              </>
            )}
            
            {isVisitor && scanResult.type === 'visitor' && (
              <>
                <p className="text-2xl mb-2 print:text-lg print:text-gray-600">✓ VISITANTE OK</p>
                <h2 className="text-5xl md:text-6xl font-black mb-2 print:text-3xl">{scanResult.data.fullName}</h2>
                {scanResult.data.company && (
                  <p className="text-2xl opacity-90 mb-4 print:text-lg">{scanResult.data.company}</p>
                )}
                <div className="mt-6 p-4 rounded-xl bg-black/20 print:bg-gray-100 print:border print:border-gray-300">
                  <p className="text-2xl print:text-lg">
                    VEIO PARA: <strong className="text-3xl print:text-xl">{scanResult.data.visitToName}</strong>
                  </p>
                  {scanResult.data.gateObs && (
                    <p className="text-2xl mt-2 text-warning print:text-orange-600">
                      OBS: <strong>{scanResult.data.gateObs}</strong>
                    </p>
                  )}
                </div>
                <p className="text-xl mt-4 opacity-80 print:text-sm print:text-gray-500">
                  Validade: até {format(new Date(scanResult.data.validUntil), 'HH:mm', { locale: ptBR })}
                </p>
              </>
            )}

            <div className="mt-8 flex items-center justify-center md:justify-start gap-3 print:hidden">
              <CheckCircle className="w-8 h-8" />
              <span className="text-2xl">STATUS: LIBERADO</span>
            </div>
            
            <p className="text-xl mt-4 opacity-80 print:text-sm print:text-gray-500">
              ⏰ Entrada registrada às {currentTime}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // BLOCKED/EXPIRED - Red fullscreen
  if (scanResult && ((scanResult.type === 'visitor' && (scanResult.status === 'blocked' || scanResult.status === 'expired')) ||
      (scanResult.type === 'employee' && scanResult.status === 'blocked') ||
      scanResult.type === 'error')) {
    
    let reason = 'QR NÃO AUTORIZADO';
    let subReason = 'PROCURE O RESPONSÁVEL';
    
    if (scanResult.type === 'visitor') {
      if (scanResult.status === 'blocked') {
        reason = 'PASSE JÁ UTILIZADO';
        subReason = 'CADASTRO ENCERRADO';
      } else if (scanResult.status === 'expired') {
        reason = 'VISITA EXPIRADA';
        subReason = 'VALIDADE ULTRAPASSADA';
      }
    } else if (scanResult.type === 'employee') {
      reason = 'CADASTRO BLOQUEADO';
      subReason = scanResult.data.fullName;
    } else if (scanResult.type === 'error') {
      reason = 'QR NÃO CADASTRADO';
      subReason = scanResult.code;
    }

    return (
      <div 
        ref={containerRef}
        className="min-h-screen flex flex-col items-center justify-center p-8 bg-kiosk-blocked"
      >
        {/* Header bar */}
        <div className="absolute top-0 left-0 right-0 py-4 px-8 text-center bg-black/30">
          <h1 className="text-4xl md:text-5xl font-black tracking-wider text-white">
            ✕ ACESSO NEGADO
          </h1>
        </div>

        {/* Botão Voltar - SEMPRE visível */}
        <div
          className="fixed z-50"
          style={{
            top: 'calc(1rem + env(safe-area-inset-top))',
            left: 'calc(1rem + env(safe-area-inset-left))',
          }}
        >
          <Button
            variant="outline"
            onClick={handleExit}
            className="gap-2 bg-background/90 shadow-lg border border-border"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
        </div>

        {/* Main content */}
        <div className="text-center text-white">
          <XCircle className="w-32 h-32 md:w-48 md:h-48 mx-auto mb-8 opacity-90" />
          
          <h2 className="text-4xl md:text-5xl font-black mb-4">{reason}</h2>
          <p className="text-2xl md:text-3xl opacity-80 mb-8">{subReason}</p>
          
          <div className="mt-12 p-6 rounded-xl bg-black/30">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
            <p className="text-2xl font-bold">PROCURE O RESPONSÁVEL</p>
          </div>
        </div>
      </div>
    );
  }

  // ==================== IDLE SCREEN ====================
  return (
    <div 
      ref={containerRef}
      className="min-h-screen flex flex-col select-none bg-kiosk-idle"
    >
      {/* Hidden input for USB scanner */}
      <input
        ref={inputRef}
        type="text"
        value={qrCode}
        onChange={(e) => setQrCode(e.target.value.toUpperCase())}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(forceFocus, 50)}
        className="absolute opacity-0 w-0 h-0"
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
      />

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
          <div className="bg-card rounded-2xl p-8 max-w-sm w-full mx-4">
            <h3 className="text-xl font-bold mb-4 text-foreground">Configurações</h3>
            <button
              onClick={handleExit}
              className="w-full py-4 bg-destructive text-destructive-foreground rounded-lg font-bold text-lg mb-3"
            >
              Sair do Kiosk
            </button>
            <button
              onClick={() => setShowSettings(false)}
              className="w-full py-3 border-2 border-border rounded-lg font-medium text-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Header com botão voltar - SEMPRE VISÍVEL */}
      <header
        className="fixed left-4 right-4 z-50 flex justify-between items-center print:hidden"
        style={{ top: 'calc(1rem + env(safe-area-inset-top))' }}
      >
        <div onClick={handleLogoClick} className="cursor-pointer opacity-50 hover:opacity-100 transition-opacity">
          <BrandLogo size="sm" />
        </div>

        {/* Botão Voltar - SEMPRE visível */}
        <Button variant="outline" onClick={handleExit} className="gap-2 bg-background/90 shadow-lg border border-border">
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Sistema
        </Button>
      </header>

      {/* Main content - centered */}
      <main className="flex-1 flex flex-col items-center justify-center p-8">
        {/* Camera icon placeholder */}
        <div className="w-64 h-64 md:w-80 md:h-80 rounded-3xl border-4 border-dashed flex items-center justify-center mb-8 border-muted-foreground/30 bg-black/5">
          <Camera className="w-24 h-24 md:w-32 md:h-32 text-muted-foreground" />
        </div>

        {/* Instructions */}
        <h1 className="text-4xl md:text-5xl font-black tracking-wide mb-4 text-foreground">
          📷 APONTE O QR
        </h1>
        
        <p className={cn(
          "text-xl md:text-2xl text-muted-foreground",
          isLoading && "animate-pulse"
        )}>
          {isLoading ? '⏳ Processando...' : '⏳ Aguardando leitura...'}
        </p>

        {/* Dica para sair */}
        {isFullscreen && (
          <p className="text-sm text-muted-foreground mt-8 opacity-50">
            💡 Clique 3x no logo para sair do modo kiosk
          </p>
        )}

        {/* Clock */}
        <div className="absolute bottom-8 right-8 opacity-50">
          <p className="text-2xl font-mono text-foreground">
            {format(new Date(), 'HH:mm')}
          </p>
        </div>
      </main>

      {/* Print styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:bg-white,
          .print\\:bg-white * {
            visibility: visible;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ScanKiosk;
