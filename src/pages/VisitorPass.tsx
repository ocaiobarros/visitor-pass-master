import { useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useVisitor } from '@/hooks/useVisitors';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Printer, ArrowLeft, Shield, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

const VisitorPass = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);

  const { data: visitor, isLoading } = useVisitor(id || '');
  const shouldPrint = searchParams.get('print') === 'true';

  useEffect(() => {
    if (shouldPrint && visitor) {
      setTimeout(() => window.print(), 500);
    }
  }, [shouldPrint, visitor]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!visitor) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <AlertTriangle className="w-16 h-16 text-warning mb-4" />
          <h2 className="text-2xl font-bold text-foreground">Visitante não encontrado</h2>
          <p className="text-muted-foreground mt-2">O passe solicitado não existe ou foi removido.</p>
          <Button onClick={() => navigate('/visitors')} className="mt-6">
            Voltar para Lista
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <DashboardLayout>
      {/* Screen UI - Hidden on print */}
      <div className="space-y-6 print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/visitors')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Passe do Visitante</h1>
            <p className="text-muted-foreground">ID: {visitor.passId}</p>
          </div>
          <div className="ml-auto">
            <Button onClick={handlePrint} className="gap-2">
              <Printer className="w-4 h-4" />
              Imprimir Passe
            </Button>
          </div>
        </div>

        {/* Screen Preview - Full detailed pass */}
        <Card className="max-w-2xl mx-auto p-8 bg-card">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border pb-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-primary flex items-center justify-center">
                <Shield className="w-8 h-8 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">GUARDA OPERACIONAL</h1>
                <p className="text-muted-foreground">Sistema de Controle de Acesso</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Passe Nº</p>
              <p className="text-xl font-mono font-bold text-primary">{visitor.passId}</p>
            </div>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-3 gap-6">
            {/* Photo & QR */}
            <div className="space-y-4">
              <div className="w-full aspect-square rounded-xl bg-muted border border-border flex items-center justify-center overflow-hidden">
                {visitor.photoUrl ? (
                  <img 
                    src={visitor.photoUrl} 
                    alt={visitor.fullName} 
                    className="w-full h-full object-cover"
                    style={{ aspectRatio: '1/1' }}
                  />
                ) : (
                  <div className="text-6xl font-bold text-muted-foreground">{visitor.fullName.charAt(0)}</div>
                )}
              </div>
              <div className="bg-white p-4 rounded-xl border border-border flex items-center justify-center">
                <QRCodeSVG value={visitor.passId} size={120} level="H" />
              </div>
            </div>

            {/* Visitor Info */}
            <div className="col-span-2 space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Nome do Visitante</p>
                <p className="text-xl font-bold text-foreground">{visitor.fullName}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Documento</p>
                  <p className="font-medium text-foreground">{visitor.document}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Empresa</p>
                  <p className="font-medium text-foreground">{visitor.company || '-'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  <p className="font-medium text-foreground">{visitor.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Destino</p>
                  <p className="font-medium text-foreground">
                    {visitor.visitToType === 'setor' ? '📍 ' : '👤 '}{visitor.visitToName}
                  </p>
                </div>
              </div>
              {visitor.gateObs && (
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <p className="text-xs text-warning font-medium">OBSERVAÇÃO</p>
                  <p className="font-medium text-foreground">{visitor.gateObs}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                  <p className="text-xs text-success font-medium">ENTRADA PERMITIDA</p>
                  <p className="font-bold text-success">
                    {format(new Date(visitor.validFrom), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-xs text-destructive font-medium">SAÍDA ATÉ</p>
                  <p className="font-bold text-destructive">
                    {format(new Date(visitor.validUntil), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Safety Guidelines */}
          <div className="mt-8 p-4 rounded-xl bg-muted/50 border border-border">
            <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-success" />
              Instruções de Segurança
            </h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Este passe deve ser portado de forma visível durante toda a permanência</li>
              <li>• Acesso restrito às áreas autorizadas conforme destino indicado</li>
              <li>• Em caso de emergência, siga as instruções da equipe de segurança</li>
              <li>• Devolva este passe na saída</li>
            </ul>
          </div>

          {/* Signatures */}
          <div className="mt-8 grid grid-cols-2 gap-8">
            <div className="border-t-2 border-border pt-2">
              <p className="text-sm text-muted-foreground text-center">Assinatura do Visitante</p>
            </div>
            <div className="border-t-2 border-border pt-2">
              <p className="text-sm text-muted-foreground text-center">Assinatura do Responsável</p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-border text-center">
            <p className="text-xs text-muted-foreground">
              Documento gerado em {format(new Date(visitor.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
            <p className="text-xs text-muted-foreground">GUARDA OPERACIONAL - Sistema de Controle de Acesso</p>
          </div>
        </Card>
      </div>

      {/* ========================================= */}
      {/* PRINT-ONLY: Visitor Badge - Mirrors Screen Card */}
      {/* Uses same Card component to ensure WYSIWYG      */}
      {/* ========================================= */}
      <div className="hidden print:flex print:justify-center print:items-start print:pt-12" id="print-area" ref={printRef}>
        <Card className="w-[85mm] max-w-none p-6 bg-white border border-border shadow-none">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-base font-bold text-foreground">GUARDA OPERACIONAL</h1>
                <p className="text-xs text-muted-foreground">Controle de Acesso</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Passe Nº</p>
              <p className="text-sm font-mono font-bold text-primary">{visitor.passId}</p>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex gap-4 mb-4">
            {/* Photo & QR */}
            <div className="space-y-3 flex-shrink-0">
              <div className="w-20 h-20 rounded-lg bg-muted border border-border flex items-center justify-center overflow-hidden">
                {visitor.photoUrl ? (
                  <img src={visitor.photoUrl} alt={visitor.fullName} className="w-full h-full object-cover" style={{ aspectRatio: '1/1' }} />
                ) : (
                  <div className="text-3xl font-bold text-muted-foreground">{visitor.fullName.charAt(0)}</div>
                )}
              </div>
              <div className="bg-white p-2 rounded-lg border border-border flex items-center justify-center">
                <QRCodeSVG value={visitor.passId} size={64} level="H" />
              </div>
            </div>

            {/* Visitor Info */}
            <div className="flex-1 space-y-2">
              <div>
                <p className="text-[10px] text-muted-foreground">Nome do Visitante</p>
                <p className="text-sm font-bold text-foreground">{visitor.fullName}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-muted-foreground">Documento</p>
                  <p className="text-xs font-medium text-foreground">{visitor.document}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Empresa</p>
                  <p className="text-xs font-medium text-foreground">{visitor.company || '-'}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Destino</p>
                <p className="text-xs font-medium text-foreground">
                  {visitor.visitToType === 'setor' ? '📍 ' : '👤 '}{visitor.visitToName}
                </p>
              </div>
              {visitor.gateObs && (
                <div className="p-2 rounded bg-warning/10 border border-warning/20">
                  <p className="text-[8px] text-warning font-medium">OBSERVAÇÃO</p>
                  <p className="text-[10px] font-medium text-foreground">{visitor.gateObs}</p>
                </div>
              )}
            </div>
          </div>

          {/* Validity Footer */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border">
            <div className="p-2 rounded bg-success/10 border border-success/20 text-center">
              <p className="text-[8px] text-success font-medium">ENTRADA</p>
              <p className="text-[10px] font-bold text-success">
                {format(new Date(visitor.validFrom), "dd/MM HH:mm", { locale: ptBR })}
              </p>
            </div>
            <div className="p-2 rounded bg-destructive/10 border border-destructive/20 text-center">
              <p className="text-[8px] text-destructive font-medium">SAÍDA ATÉ</p>
              <p className="text-[10px] font-bold text-destructive">
                {format(new Date(visitor.validUntil), "dd/MM HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default VisitorPass;
