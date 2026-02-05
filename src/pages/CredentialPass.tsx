import { useParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useEmployeeCredential } from '@/hooks/useEmployeeCredentials';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Printer, User, Car, Building2, Briefcase, IdCard } from 'lucide-react';
import { branding } from '@/config/branding';

const CredentialPass = () => {
  const { id } = useParams<{ id: string }>();
  const { data: credential, isLoading, error } = useEmployeeCredential(id || '');

  const handlePrint = () => {
    window.print();
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-background p-4">
      {/* Print-hidden header */}
      <div className="max-w-2xl mx-auto mb-6 flex justify-between items-center print:hidden">
        <Button variant="ghost" asChild>
          <Link to={isVehicle ? '/vehicles' : '/employees'}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Link>
        </Button>
        <Button onClick={handlePrint}>
          <Printer className="w-4 h-4 mr-2" />
          Imprimir
        </Button>
      </div>

      {/* Credential Card */}
      <Card className="max-w-2xl mx-auto shadow-xl print:shadow-none">
        <CardHeader className="text-center border-b border-border pb-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            {isVehicle ? (
              <Car className="w-6 h-6 text-primary" />
            ) : (
              <User className="w-6 h-6 text-primary" />
            )}
            <CardTitle className="text-xl font-bold">
              {isVehicle ? 'Credencial de Veículo' : 'Crachá de Identificação'}
            </CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">{branding.name}</p>
          <Badge variant={credential.status === 'allowed' ? 'default' : 'destructive'} className="mt-2">
            {credential.status === 'allowed' ? 'LIBERADO' : 'BLOQUEADO'}
          </Badge>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6 items-center">
            {/* Photo or Vehicle Icon */}
            <div className="flex-shrink-0">
              {credential.photoUrl ? (
                <div className="w-32 h-32 rounded-xl overflow-hidden border-2 border-border">
                  <img
                    src={credential.photoUrl}
                    alt={credential.fullName}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-32 h-32 rounded-xl bg-muted flex items-center justify-center border-2 border-border">
                  {isVehicle ? (
                    <Car className="w-16 h-16 text-muted-foreground" />
                  ) : (
                    <User className="w-16 h-16 text-muted-foreground" />
                  )}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 space-y-3 text-center md:text-left">
              <div>
                <p className="text-sm text-muted-foreground">
                  {isVehicle ? 'Proprietário' : 'Nome'}
                </p>
                <p className="text-xl font-bold text-foreground">{credential.fullName}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 justify-center md:justify-start">
                    <IdCard className="w-3 h-3" />
                    CPF
                  </p>
                  <p className="font-mono font-medium">{credential.document}</p>
                </div>

                {isVehicle ? (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">Placa</p>
                      <p className="font-mono font-bold text-2xl text-primary">{credential.vehiclePlate}</p>
                    </div>
                    {credential.vehicleMakeModel && (
                      <div className="col-span-2">
                        <p className="text-sm text-muted-foreground">Veículo</p>
                        <p className="font-medium">{credential.vehicleMakeModel}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {credential.department && (
                      <div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 justify-center md:justify-start">
                          <Building2 className="w-3 h-3" />
                          Departamento
                        </p>
                        <p className="font-medium">{credential.department.name}</p>
                      </div>
                    )}
                    {credential.jobTitle && (
                      <div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 justify-center md:justify-start">
                          <Briefcase className="w-3 h-3" />
                          Cargo
                        </p>
                        <p className="font-medium">{credential.jobTitle}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* QR Code */}
            <div className="flex-shrink-0">
              <div className="bg-white p-3 rounded-xl shadow-inner">
                <QRCodeSVG
                  value={credential.credentialId}
                  size={120}
                  level="H"
                  includeMargin={false}
                />
              </div>
              <p className="text-center text-xs font-mono text-muted-foreground mt-2">
                {credential.credentialId}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CredentialPass;
