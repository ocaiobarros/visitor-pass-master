import { useParams, Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Printer, Users, IdCard } from 'lucide-react';
import { branding } from '@/config/branding';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const relationshipLabels: Record<string, string> = {
  conjuge: 'Cônjuge',
  pai: 'Pai',
  mae: 'Mãe',
  filho: 'Filho',
  filha: 'Filha',
  irmao: 'Irmão',
  irma: 'Irmã',
  namorado: 'Namorado',
  namorada: 'Namorada',
  motorista_particular: 'Motorista Particular',
  outro: 'Outro',
};

const statusLabels: Record<string, string> = {
  active: 'ATIVO',
  suspended: 'SUSPENSO',
  expired: 'EXPIRADO',
};

const useAssociateById = (id: string) => {
  return useQuery({
    queryKey: ['associate', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('associates')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      // Fetch employee info
      const { data: emp } = await supabase
        .from('employee_credentials')
        .select('full_name, document, job_title, department_id, departments(name)')
        .eq('id', data.employee_credential_id)
        .maybeSingle();

      return {
        ...data,
        employeeName: emp?.full_name || '',
        employeeDepartment: (emp as any)?.departments?.name || '',
      };
    },
    enabled: !!id,
  });
};

const AssociatePass = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: associate, isLoading, error } = useAssociateById(id || '');

  const handlePrint = () => window.print();
  const handleBack = () => navigate(-1);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Carregando passe...</p>
        </div>
      </div>
    );
  }

  if (error || !associate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <IdCard className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Passe não encontrado</h2>
            <p className="text-muted-foreground mb-6">
              O passe de agregado solicitado não existe ou foi removido.
            </p>
            <Button asChild>
              <Link to="/associates">Voltar aos Agregados</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isActive = associate.status === 'active';

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-background p-4 credential-pass-page">
      {/* Print-hidden header */}
      <div className="max-w-2xl mx-auto mb-6 flex justify-between items-center print:hidden">
        <Button variant="ghost" onClick={handleBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <div className="text-center">
          <h1 className="text-xl font-bold">Passe de Agregado</h1>
          <Badge variant={isActive ? 'default' : 'destructive'}>
            {statusLabels[associate.status] || associate.status.toUpperCase()}
          </Badge>
        </div>
        <Button onClick={handlePrint}>
          <Printer className="w-4 h-4 mr-2" />
          Imprimir
        </Button>
      </div>

      {/* Preview Card */}
      <Card className="max-w-md mx-auto shadow-xl credential-card employee-badge">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            {/* Photo/Icon */}
            <div className="w-32 h-40 rounded-xl overflow-hidden border-2 border-border bg-muted flex items-center justify-center">
              {associate.photo_url ? (
                <img
                  src={associate.photo_url}
                  alt={associate.full_name}
                  className="w-full h-full object-cover"
                  style={{ aspectRatio: '4/5' }}
                />
              ) : (
                <Users className="w-16 h-16 text-muted-foreground" />
              )}
            </div>

            {/* Info */}
            <div>
              <p className="text-xl font-bold">{associate.full_name}</p>
              <p className="text-muted-foreground">
                {relationshipLabels[associate.relationship_type] || associate.relationship_type}
              </p>
              <p className="text-sm text-muted-foreground">
                Responsável: {associate.employeeName}
              </p>
              {associate.employeeDepartment && (
                <p className="text-xs text-muted-foreground">{associate.employeeDepartment}</p>
              )}
            </div>

            {/* Status */}
            <Badge variant={isActive ? 'default' : 'destructive'} className="text-sm">
              {statusLabels[associate.status] || associate.status.toUpperCase()}
            </Badge>

            {/* QR Code */}
            <div className="bg-white p-4 rounded-xl border credential-qr">
              <QRCodeSVG value={associate.pass_id} size={120} level="H" />
              <p className="text-xs font-mono text-muted-foreground mt-2">{associate.pass_id}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PRINT-ONLY: Badge Layout */}
      <div className="hidden print:block print-badge-card print-employee-badge" id="print-area">
        <div className="badge-header">{branding.name}</div>

        {associate.photo_url ? (
          <img src={associate.photo_url} alt={associate.full_name} className="badge-photo" />
        ) : (
          <div className="badge-photo-placeholder">
            {associate.full_name.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="badge-info">
          <div className="badge-name">{associate.full_name}</div>
          <div className="badge-dept">{relationshipLabels[associate.relationship_type] || associate.relationship_type}</div>
          <div className="badge-job">Resp: {associate.employeeName}</div>
        </div>

        <div className="badge-qr">
          <QRCodeSVG value={associate.pass_id} size={70} level="H" />
          <div className="badge-id">{associate.pass_id}</div>
        </div>
      </div>
    </div>
  );
};

export default AssociatePass;
