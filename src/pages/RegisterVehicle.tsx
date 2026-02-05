import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useCreateCredential } from '@/hooks/useEmployeeCredentials';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Car, User, IdCard, Palette } from 'lucide-react';
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
              {/* Owner Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <div className="space-y-2">
                  <Label htmlFor="document">CPF do Proprietário *</Label>
                  <div className="relative">
                    <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                    <MaskedInput
                      id="document"
                      mask="cpf"
                      placeholder="000.000.000-00"
                      value={formData.document}
                      onChange={(value) => setFormData({ ...formData, document: value })}
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
