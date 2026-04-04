import { useState, useRef, useEffect, useCallback } from 'react';
import { useUpdateVisitorStatus } from '@/hooks/useVisitors';
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
import { supabase } from '@/integrations/supabase/client';

type ScanResult = {
  type: 'visitor';
  data: Visitor;
  status: 'allowed' | 'blocked' | 'expired';
  direction: 'in' | 'out';
} | {
  type: 'employee';
  data: EmployeeCredential;
  status: 'allowed' | 'blocked';
  direction: 'in' | 'out';
} | {
  type: 'error';
  code: string;
} | null;

// Anti-duplicate: 10s window
const ANTI_DUP_WINDOW_MS = 10_000;
const scanTimestamps = new Map<string, number>();

const mapDbToVisitor = (row: any): Visitor => ({
  id: row.id,
  passId: row.pass_id,
  fullName: row.full_name,
  document: row.document,
  companyId: row.company_id,
  companyName: row.company_name,
  phone: row.phone,
  photoUrl: row.photo_url,
  visitToType: row.visit_to_type,
  visitToName: row.visit_to_name,
  gateObs: row.gate_obs,
  companyReason: row.company_reason,
  accessType: row.access_type,
  vehiclePassId: row.vehicle_pass_id,
  vehiclePlate: row.vehicle_plate,
  vehicleBrand: row.vehicle_brand,
  vehicleModel: row.vehicle_model,
  vehicleColor: row.vehicle_color,
  validFrom: new Date(row.valid_from),
  validUntil: new Date(row.valid_until),
  status: row.status,
  createdBy: row.created_by,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
});

const mapDbToCredential = (row: any): EmployeeCredential => ({
  id: row.id,
  credentialId: row.credential_id,
  type: row.type,
  fullName: row.full_name,
  document: row.document,
  departmentId: row.department_id,
  jobTitle: row.job_title,
  photoUrl: row.photo_url,
  vehicleMakeModel: row.vehicle_make_model,
  vehiclePlate: row.vehicle_plate,
  status: row.status,
  createdBy: row.created_by,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
});

const ScanKiosk = () => {
  const [qrCode, setQrCode] = useState('');
  const [searchCode, setSearchCode] = useState('');
  const [scanResult, setScanResult] = useState<ScanResult>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsClicks, setSettingsClicks] = useState(0);
  const [currentTime, setCurrentTime] = useState(format(new Date(), 'HH:mm:ss'));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const focusIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const printRef = useRef<HTMLDivElement>(null);
  
  const navigate = useNavigate();
  const { playSuccess, playError, playBlocked } = useScanFeedback();
  const updateVisitorStatus = useUpdateVisitorStatus();
  const createAccessLog = useCreateAccessLog();

  // Update clock
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(format(new Date(), 'HH:mm:ss'));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Force focus on input (kiosk mode)
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
      } catch (e) {}
    };
    enterFullscreen();
    
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    focusIntervalRef.current = setInterval(forceFocus, 1000);
    
    return () => {
      if (focusIntervalRef.current) clearInterval(focusIntervalRef.current);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [forceFocus]);

  useEffect(() => {
    if (!scanResult) {
      setTimeout(forceFocus, 100);
    }
  }, [scanResult, forceFocus]);

  const scheduleReset = useCallback((delay: number = 3000) => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      setScanResult(null);
      setSearchCode('');
      setQrCode('');
    }, delay);
  }, []);

  /**
   * Deterministic direction toggle:
   * Queries get_last_access_direction RPC for the subject.
   * If last was 'in' → next is 'out'. If 'out' or null → next is 'in'.
   */
  const getNextDirection = async (subjectType: 'visitor' | 'employee', subjectId: string): Promise<'in' | 'out'> => {
    try {
      const { data, error } = await supabase.rpc('get_last_access_direction', {
        p_subject_type: subjectType,
        p_subject_id: subjectId,
      });
      if (error || !data) return 'in';
      return data === 'in' ? 'out' : 'in';
    } catch {
      return 'in';
    }
  };

  /**
   * Fetch fresh data directly from DB (bypass React Query cache)
   */
  const fetchFreshVisitor = async (field: string, value: string): Promise<Visitor | null> => {
    // Use raw query to avoid deep type instantiation
    const query = supabase.from('visitors').select('*, companies(name)');
    const { data, error } = await (query as any).eq(field, value).maybeSingle();
    if (error || !data) return null;
    return mapDbToVisitor({ ...data, company_name: data.companies?.name });
  };
  };

  const fetchFreshCredential = async (credentialId: string): Promise<EmployeeCredential | null> => {
    const { data, error } = await supabase
      .from('employee_credentials')
      .select('*')
      .eq('credential_id', credentialId)
      .maybeSingle();
    if (error || !data) return null;
    return mapDbToCredential(data);
  };

  // Process scan
  useEffect(() => {
    if (!searchCode || isProcessing) return;

    const processScan = async () => {
      setIsProcessing(true);

      // Anti-duplicate check
      const now = Date.now();
      const lastScan = scanTimestamps.get(searchCode);
      if (lastScan && now - lastScan < ANTI_DUP_WINDOW_MS) {
        setIsProcessing(false);
        return;
      }
      scanTimestamps.set(searchCode, now);

      try {
        if (searchCode.startsWith('VP-') || searchCode.startsWith('VV-')) {
          const field = searchCode.startsWith('VP-') ? 'pass_id' : 'vehicle_pass_id';
          const visitor = await fetchFreshVisitor(field, searchCode);

          if (!visitor) {
            playError();
            setScanResult({ type: 'error', code: searchCode });
            scheduleReset(3000);
            return;
          }

          if (visitor.status === 'closed') {
            playBlocked();
            setScanResult({ type: 'visitor', data: visitor, status: 'blocked', direction: 'in' });
            scheduleReset(4000);
            return;
          }
          if (new Date() < visitor.validFrom) {
            playBlocked();
            setScanResult({ type: 'visitor', data: visitor, status: 'blocked', direction: 'in' });
            scheduleReset(4000);
            return;
          }
          if (new Date() > visitor.validUntil) {
            playBlocked();
            setScanResult({ type: 'visitor', data: visitor, status: 'expired', direction: 'in' });
            scheduleReset(4000);
            return;
          }

          // Deterministic toggle
          const direction = await getNextDirection('visitor', visitor.id);
          
          playSuccess();
          
          // Update visitor status based on direction
          const newVisitorStatus = direction === 'in' ? 'inside' as const : 'outside' as const;
          await updateVisitorStatus.mutateAsync({ id: visitor.id, status: newVisitorStatus });
          await createAccessLog.mutateAsync({
            subjectType: 'visitor',
            subjectId: visitor.id,
            direction,
          });

          setScanResult({ type: 'visitor', data: { ...visitor, status: newVisitorStatus }, status: 'allowed', direction });
          scheduleReset(3000);

        } else if (searchCode.startsWith('EC-')) {
          const credential = await fetchFreshCredential(searchCode);

          if (!credential) {
            playError();
            setScanResult({ type: 'error', code: searchCode });
            scheduleReset(3000);
            return;
          }

          if (credential.status === 'blocked') {
            playBlocked();
            setScanResult({ type: 'employee', data: credential, status: 'blocked', direction: 'in' });
            scheduleReset(3000);
            return;
          }

          // Deterministic toggle
          const direction = await getNextDirection('employee', credential.id);
          
          playSuccess();
          await createAccessLog.mutateAsync({
            subjectType: 'employee',
            subjectId: credential.id,
            direction,
          });

          setScanResult({ type: 'employee', data: credential, status: 'allowed', direction });
          scheduleReset(3000);
        } else {
          playError();
          setScanResult({ type: 'error', code: searchCode });
          scheduleReset(3000);
        }
      } catch (err) {
        console.error('[ScanKiosk] Error processing scan:', err);
        playError();
        setScanResult({ type: 'error', code: searchCode });
        scheduleReset(3000);
      } finally {
        setIsProcessing(false);
      }
    };

    processScan();
  }, [searchCode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && qrCode.trim()) {
      e.preventDefault();
      const code = qrCode.toUpperCase().trim();
      
      if (code.startsWith('VP-') || code.startsWith('VV-') || code.startsWith('EC-')) {
        setSearchCode(code);
      } else {
        playError();
        setScanResult({ type: 'error', code });
        scheduleReset(3000);
      }
      setQrCode('');
    }
  };

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

  const handlePrint = () => {
    if (!scanResult || scanResult.type === 'error') return;
    window.print();
  };

  // ==================== RESULT SCREENS ====================
  
  // ALLOWED - Green fullscreen
  if (scanResult && scanResult.type !== 'error' && scanResult.status === 'allowed') {
    const isVehicle = scanResult.type === 'employee' && scanResult.data.type === 'vehicle';
    const isVisitor = scanResult.type === 'visitor';
    const directionLabel = scanResult.direction === 'in' ? 'ENTRADA' : 'SAÍDA';
    const directionIcon = scanResult.direction === 'in' ? '↓' : '↑';
    
    return (
      <div 
        ref={containerRef}
        className="min-h-screen flex flex-col items-center justify-center p-8 bg-kiosk-allowed print:bg-white"
      >
        <div className="absolute top-0 left-0 right-0 py-4 px-8 text-center bg-black/20 print:hidden">
          <h1 className="text-4xl md:text-5xl font-black tracking-wider text-white">
            ✓ ACESSO LIBERADO — {directionIcon} {directionLabel}
          </h1>
        </div>

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

        <div className="absolute top-4 right-4 z-20 print:hidden">
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            Imprimir
          </Button>
        </div>

        <div ref={printRef} className="flex flex-col md:flex-row items-center gap-8 md:gap-12 mt-16 print:mt-0 print:flex-col print:text-black">
          <div 
            className="w-40 h-40 md:w-56 md:h-56 rounded-2xl flex items-center justify-center overflow-hidden border-4 bg-white/90 border-white/50 print:w-32 print:h-32 print:border-gray-300"
            style={{ aspectRatio: '1/1' }}
          >
            {scanResult.data.photoUrl ? (
              <img 
                src={scanResult.data.photoUrl} 
                alt={scanResult.data.fullName} 
                className="w-full h-full"
                style={{ objectFit: 'cover', aspectRatio: '1/1' }}
              />
            ) : isVehicle ? (
              <Car className="w-24 h-24 text-foreground print:text-gray-700" />
            ) : (
              <User className="w-24 h-24 text-foreground print:text-gray-700" />
            )}
          </div>

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
                {scanResult.data.companyName && (
                  <p className="text-2xl opacity-90 mb-4 print:text-lg">{scanResult.data.companyName}</p>
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
              <span className="text-2xl">{directionIcon} {directionLabel} REGISTRADA</span>
            </div>
            
            <p className="text-xl mt-4 opacity-80 print:text-sm print:text-gray-500">
              ⏰ {directionLabel} registrada às {currentTime}
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
        <div className="absolute top-0 left-0 right-0 py-4 px-8 text-center bg-black/30">
          <h1 className="text-4xl md:text-5xl font-black tracking-wider text-white">
            ✕ ACESSO NEGADO
          </h1>
        </div>

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

      {/* Header */}
      <header
        className="fixed left-4 right-4 z-50 flex justify-between items-center print:hidden"
        style={{ top: 'calc(1rem + env(safe-area-inset-top))' }}
      >
        <div onClick={handleLogoClick} className="cursor-pointer opacity-50 hover:opacity-100 transition-opacity">
          <BrandLogo size="sm" />
        </div>

        <Button 
          variant="default" 
          onClick={handleExit} 
          className="gap-2 shadow-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Sistema
        </Button>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-64 h-64 md:w-80 md:h-80 rounded-3xl border-4 border-dashed flex items-center justify-center mb-8 border-muted-foreground/30 bg-black/5">
          <Camera className="w-24 h-24 md:w-32 md:h-32 text-muted-foreground" />
        </div>

        <h1 className="text-4xl md:text-5xl font-black tracking-wide mb-4 text-foreground">
          📷 APONTE O QR
        </h1>
        
        <p className={cn(
          "text-xl md:text-2xl text-muted-foreground",
          isProcessing && "animate-pulse"
        )}>
          {isProcessing ? '⏳ Processando...' : '⏳ Aguardando leitura...'}
        </p>

        {isFullscreen && (
          <p className="text-sm text-muted-foreground mt-8 opacity-50">
            💡 Clique 3x no logo para sair do modo kiosk
          </p>
        )}

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
