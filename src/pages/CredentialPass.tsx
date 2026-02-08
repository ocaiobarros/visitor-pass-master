import { useParams, Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useEmployeeCredential } from '@/hooks/useEmployeeCredentials';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Printer, User, Car, IdCard } from 'lucide-react';
import { branding } from '@/config/branding';

const CredentialPass = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: credential, isLoading, error } = useEmployeeCredential(id || '');

  const handlePrint = () => {
    window.print();
  };

  const handleBack = () => {
    navigate(-1);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Carregando credencial...</p>
        </div>
      </div>
    );
  }

  if (error || !credential) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <IdCard className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Credencial não encontrada</h2>
            <p className="text-muted-foreground mb-6">
              A credencial solicitada não existe ou foi removida.
            </p>
            <Button asChild>
              <Link to="/dashboard">Voltar ao Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isVehicle = credential.type === 'vehicle';
  const badgeVariantClass = isVehicle ? 'vehicle-badge' : 'employee-badge';

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-background p-4 credential-pass-page">
      {/* Print-hidden header */}
      <div className="max-w-2xl mx-auto mb-6 flex justify-between items-center print:hidden">
        <Button variant="ghost" onClick={handleBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <div className="text-center">
          <h1 className="text-xl font-bold">{isVehicle ? 'Credencial de Veículo' : 'Crachá de Identificação'}</h1>
          <Badge variant={credential.status === 'allowed' ? 'default' : 'destructive'}>
            {credential.status === 'allowed' ? 'LIBERADO' : 'BLOQUEADO'}
          </Badge>
        </div>
        <Button onClick={handlePrint}>
          <Printer className="w-4 h-4 mr-2" />
          Imprimir
        </Button>
      </div>

      {/* Preview Card (tela e impressão) */}
      <Card className={`max-w-md mx-auto shadow-xl credential-card ${badgeVariantClass}`}>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            {/* Photo/Icon - fixed dimensions with aspect-ratio for sharpness */}
            <div className="w-32 h-40 rounded-xl overflow-hidden border-2 border-border bg-muted flex items-center justify-center">
              {credential.photoUrl ? (
                <img 
                  src={credential.photoUrl} 
                  alt={credential.fullName} 
                  className="w-full h-full object-cover"
                  style={{ aspectRatio: '4/5' }}
                />
              ) : isVehicle ? (
                <Car className="w-16 h-16 text-muted-foreground" />
              ) : (
                <User className="w-16 h-16 text-muted-foreground" />
              )}
            </div>

            {/* Info */}
            <div>
              <p className="text-xl font-bold">{credential.fullName}</p>
              {credential.department && <p className="text-muted-foreground">{credential.department.name}</p>}
              {credential.jobTitle && <p className="text-sm text-muted-foreground">{credential.jobTitle}</p>}
            </div>

            {/* Vehicle Data */}
            {isVehicle && (
              <div className="w-full p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">{credential.vehicleMakeModel}</p>
                <p className="text-3xl font-black font-mono tracking-wider">{credential.vehiclePlate}</p>
              </div>
            )}

            {/* QR Code */}
            <div className="bg-white p-4 rounded-xl border credential-qr">
              <QRCodeSVG value={credential.credentialId} size={120} level="H" />
              <p className="text-xs font-mono text-muted-foreground mt-2">{credential.credentialId}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ========================================= */}
      {/* PRINT-ONLY: Professional Badge Layout   */}
      {/* ========================================= */}
      
      {/* EMPLOYEE BADGE - Vertical Corporate */}
      {!isVehicle && (
        <div className="hidden print:block print-badge-card print-employee-badge" id="print-area">
          {/* Header */}
          <div className="badge-header">{branding.name}</div>
          
          {/* Photo */}
          {credential.photoUrl ? (
            <img src={credential.photoUrl} alt={credential.fullName} className="badge-photo" />
          ) : (
            <div className="badge-photo-placeholder">
              {credential.fullName.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Info */}
          <div className="badge-info">
            <div className="badge-name">{credential.fullName}</div>
            <div className="badge-dept">{credential.department?.name || ''}</div>
            <div className="badge-job">{credential.jobTitle || ''}</div>
          </div>

          {/* QR Code */}
          <div className="badge-qr">
            <QRCodeSVG value={credential.credentialId} size={70} level="H" />
            <div className="badge-id">{credential.credentialId}</div>
          </div>
        </div>
      )}

      {/* VEHICLE BADGE - Horizontal Plate Focus */}
      {isVehicle && (
        <div className="hidden print:block print-badge-card print-vehicle-badge" id="print-area">
          {/* QR Section */}
          <div className="vehicle-qr-section">
            <div className="vehicle-qr">
              <QRCodeSVG value={credential.credentialId} size={85} level="H" />
            </div>
            <div className="vehicle-qr-label">{credential.credentialId}</div>
          </div>

          {/* Info Section */}
          <div className="vehicle-info-section">
            <div className="vehicle-owner">{credential.fullName}</div>
            <div className="vehicle-dept">{credential.department?.name || ''}</div>
            <div className="vehicle-job">{credential.jobTitle || ''}</div>
            <div className="vehicle-divider"></div>
            <div className="vehicle-model">{credential.vehicleMakeModel}</div>
            <div className="vehicle-plate">{credential.vehiclePlate}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CredentialPass;
