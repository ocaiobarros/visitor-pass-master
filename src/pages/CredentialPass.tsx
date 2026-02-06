import { useParams, Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useEmployeeCredential } from '@/hooks/useEmployeeCredentials';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Printer, User, Car, Building2, Briefcase, IdCard } from 'lucide-react';
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-background p-4">
      {/* Print-hidden header */}
      <div className="max-w-2xl mx-auto mb-6 flex justify-between items-center print:hidden">
        <Button variant="ghost" onClick={handleBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <Button onClick={handlePrint}>
          <Printer className="w-4 h-4 mr-2" />
          Imprimir
        </Button>
      </div>

      {/* Credential Card - Area de impressão */}
      <Card className="max-w-2xl mx-auto shadow-xl print:shadow-none print:border-2 print:border-gray-300" id="print-area">
        <CardHeader className="text-center border-b border-border pb-4 print:border-gray-300">
          <div className="flex items-center justify-center gap-2 mb-2">
            {isVehicle ? (
              <Car className="w-6 h-6 text-primary print:text-gray-700" />
            ) : (
              <User className="w-6 h-6 text-primary print:text-gray-700" />
            )}
            <CardTitle className="text-xl font-bold">
              {isVehicle ? 'Credencial de Veículo' : 'Crachá de Identificação'}
            </CardTitle>
          </div>
          <p className="text-sm text-muted-foreground print:text-gray-600">{branding.name}</p>
          <Badge 
            variant={credential.status === 'allowed' ? 'default' : 'destructive'} 
            className="mt-2 print:bg-green-600 print:text-white"
          >
            {credential.status === 'allowed' ? 'LIBERADO' : 'BLOQUEADO'}
          </Badge>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6 items-center print:flex-row">
            {/* Photo or Vehicle Icon */}
            <div className="flex-shrink-0">
              {credential.photoUrl ? (
                <div className="w-32 h-32 rounded-xl overflow-hidden border-2 border-border print:border-gray-300">
                  <img
                    src={credential.photoUrl}
                    alt={credential.fullName}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-32 h-32 rounded-xl bg-muted flex items-center justify-center border-2 border-border print:bg-gray-100 print:border-gray-300">
                  {isVehicle ? (
                    <Car className="w-16 h-16 text-muted-foreground print:text-gray-500" />
                  ) : (
                    <User className="w-16 h-16 text-muted-foreground print:text-gray-500" />
                  )}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 space-y-3 text-center md:text-left print:text-left">
              <div>
                <p className="text-sm text-muted-foreground print:text-gray-600">
                  {isVehicle ? 'Proprietário' : 'Nome'}
                </p>
                <p className="text-xl font-bold text-foreground print:text-black">{credential.fullName}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 justify-center md:justify-start print:text-gray-600 print:justify-start">
                    <IdCard className="w-3 h-3" />
                    CPF
                  </p>
                  <p className="font-mono font-medium print:text-black">{credential.document}</p>
                </div>

                {isVehicle ? (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground print:text-gray-600">Placa</p>
                      <p className="font-mono font-bold text-2xl text-primary print:text-black">{credential.vehiclePlate}</p>
                    </div>
                    {credential.vehicleMakeModel && (
                      <div className="col-span-2">
                        <p className="text-sm text-muted-foreground print:text-gray-600">Veículo</p>
                        <p className="font-medium print:text-black">{credential.vehicleMakeModel}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {credential.department && (
                      <div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 justify-center md:justify-start print:text-gray-600 print:justify-start">
                          <Building2 className="w-3 h-3" />
                          Departamento
                        </p>
                        <p className="font-medium print:text-black">{credential.department.name}</p>
                      </div>
                    )}
                    {credential.jobTitle && (
                      <div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 justify-center md:justify-start print:text-gray-600 print:justify-start">
                          <Briefcase className="w-3 h-3" />
                          Cargo
                        </p>
                        <p className="font-medium print:text-black">{credential.jobTitle}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* QR Code */}
            <div className="flex-shrink-0">
              <div className="bg-white p-3 rounded-xl shadow-inner print:shadow-none print:border print:border-gray-300">
                <QRCodeSVG
                  value={credential.credentialId}
                  size={120}
                  level="H"
                  includeMargin={false}
                />
              </div>
              <p className="text-center text-xs font-mono text-muted-foreground mt-2 print:text-gray-600">
                {credential.credentialId}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Print styles */}
      <style>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          body * {
            visibility: hidden;
          }
          #print-area,
          #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 20px !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default CredentialPass;
