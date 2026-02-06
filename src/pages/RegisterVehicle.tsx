import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useCreateCredential } from '@/hooks/useEmployeeCredentials';
import { usePersonByDocument } from '@/hooks/usePersonByDocument';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Car, User, IdCard, Palette, CheckCircle, Loader2 } from 'lucide-react';
import { MaskedInput, isValidCPF } from '@/components/ui/masked-input';
import { useToast } from '@/hooks/use-toast';
import { logAuditAction } from '@/hooks/useAuditLogs';

const RegisterVehicle = () => {
  const navigate = useNavigate();
  const createCredential = useCreateCredential();
  const { isAdminOrRh } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    fullName: '',
    document: '',
    vehicleMakeModel: '',
    vehiclePlate: '',
  });

  // Buscar dados do proprietário pelo CPF
  const { data: personData, isLoading: isSearching } = usePersonByDocument(formData.document);

  // Auto-preencher nome e mostrar foto quando encontrar pessoa
  useEffect(() => {
    if (personData && !formData.fullName) {
      setFormData(prev => ({ ...prev, fullName: personData.fullName }));
    }
  }, [personData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate CPF
    if (!isValidCPF(formData.document)) {
      toast({
        title: 'CPF inválido',
        description: 'Por favor, informe um CPF válido.',
        variant: 'destructive',
      });
      return;
    }

    // Validate plate
    if (!formData.vehiclePlate || formData.vehiclePlate.length < 7) {
      toast({
        title: 'Placa inválida',
        description: 'Por favor, informe a placa do veículo.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await createCredential.mutateAsync({
        type: 'vehicle',
        fullName: formData.fullName,
        document: formData.document,
        vehicleMakeModel: formData.vehicleMakeModel || undefined,
        vehiclePlate: formData.vehiclePlate.toUpperCase(),
        // Associar foto do funcionário/visitante ao veículo
        photoUrl: personData?.photoUrl || undefined,
      });

      await logAuditAction('EMPLOYEE_CREATE', {
        employee_name: formData.fullName,
        vehicle_plate: formData.vehiclePlate.toUpperCase(),
        credential_id: result.credentialId,
        type: 'vehicle',
      });

      navigate(`/credential/${result.id}`);
    } catch (error: any) {
      toast({
        title: 'Erro ao cadastrar',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  if (!isAdminOrRh) {
    return (
      <DashboardLayout pageTitle="Cadastrar Veículo">
        <div className="flex flex-col items-center justify-center py-20">
          <h2 className="text-2xl font-bold text-foreground">Acesso Restrito</h2>
          <p className="text-muted-foreground mt-2">Apenas RH e Administradores podem cadastrar veículos.</p>
          <Button onClick={() => navigate('/dashboard')} className="mt-6">
            Voltar ao Dashboard
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout pageTitle="Cadastrar Veículo">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Car className="w-8 h-8 text-primary" />
            Cadastrar Veículo
          </h1>
          <p className="text-muted-foreground mt-1">Cadastre um veículo autorizado a acessar as instalações</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dados do Veículo</CardTitle>
            <CardDescription>Informações do proprietário e do veículo</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Photo Preview - mostra quando encontrar pessoa */}
              {personData?.photoUrl && (
                <div className="flex flex-col items-center gap-3 p-4 rounded-lg bg-success/10 border border-success/30">
                  <div className="w-24 h-24 rounded-xl overflow-hidden border-2 border-success/50">
                    <img 
                      src={personData.photoUrl} 
                      alt={personData.fullName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-success">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {personData.source === 'employee' ? 'Funcionário encontrado' : 'Visitante encontrado'}
                    </span>
                  </div>
                </div>
              )}

              {/* Owner Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="document">CPF do Proprietário *</Label>
                  <div className="relative">
                    <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                    <MaskedInput
                      id="document"
                      mask="cpf"
                      placeholder="000.000.000-00"
                      value={formData.document}
                      onChange={(value) => setFormData({ ...formData, document: value, fullName: '' })}
                      className="pl-10"
                      required
                    />
                    {isSearching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {personData && (
                    <p className="text-xs text-success">
                      ✓ Cadastro encontrado: {personData.fullName}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome do Proprietário *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      placeholder="Nome completo"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Vehicle Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vehicleMakeModel">Marca / Modelo *</Label>
                  <div className="relative">
                    <Palette className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="vehicleMakeModel"
                      placeholder="Ex: Honda Civic Preto"
                      value={formData.vehicleMakeModel}
                      onChange={(e) => setFormData({ ...formData, vehicleMakeModel: e.target.value })}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehiclePlate">Placa *</Label>
                  <div className="relative">
                    <Car className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="vehiclePlate"
                      placeholder="ABC1D23 ou ABC-1234"
                      value={formData.vehiclePlate}
                      onChange={(e) => setFormData({ ...formData, vehiclePlate: e.target.value.toUpperCase() })}
                      className="pl-10 uppercase"
                      maxLength={8}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="flex gap-4 pt-4">
                <Button type="button" variant="outline" onClick={() => navigate('/vehicles')} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={createCredential.isPending}>
                  {createCredential.isPending ? 'Cadastrando...' : 'Cadastrar Veículo'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default RegisterVehicle;
