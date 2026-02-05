import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useDepartments } from '@/hooks/useDepartments';
import { useCreateCredential } from '@/hooks/useEmployeeCredentials';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Building2, User, Briefcase, Camera, IdCard } from 'lucide-react';
import { MaskedInput, isValidCPF } from '@/components/ui/masked-input';
import { useToast } from '@/hooks/use-toast';
import { logAuditAction } from '@/hooks/useAuditLogs';

const RegisterEmployee = () => {
  const navigate = useNavigate();
  const { data: departments = [] } = useDepartments();
  const createCredential = useCreateCredential();
  const { isAdminOrRh } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    fullName: '',
    document: '',
    departmentId: '',
    jobTitle: '',
  });
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

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

    try {
      const result = await createCredential.mutateAsync({
        type: 'personal',
        fullName: formData.fullName,
        document: formData.document,
        departmentId: formData.departmentId || undefined,
        jobTitle: formData.jobTitle || undefined,
        photoUrl,
      });

      await logAuditAction('EMPLOYEE_CREATE', {
        employee_name: formData.fullName,
        credential_id: result.credentialId,
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
      <DashboardLayout pageTitle="Cadastrar Funcionário">
        <div className="flex flex-col items-center justify-center py-20">
          <h2 className="text-2xl font-bold text-foreground">Acesso Restrito</h2>
          <p className="text-muted-foreground mt-2">Apenas RH e Administradores podem cadastrar funcionários.</p>
          <Button onClick={() => navigate('/dashboard')} className="mt-6">
            Voltar ao Dashboard
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout pageTitle="Cadastrar Funcionário">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <UserPlus className="w-8 h-8 text-primary" />
            Cadastrar Funcionário
          </h1>
          <p className="text-muted-foreground mt-1">Cadastre um novo colaborador interno da empresa</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dados do Funcionário</CardTitle>
            <CardDescription>Informações para o crachá de identificação</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Photo Upload */}
              <div className="flex justify-center">
                <div className="relative">
                  <div className="w-32 h-32 rounded-xl bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
                    {photoUrl ? (
                      <img src={photoUrl} alt="Foto do funcionário" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground text-center mt-2">Clique para adicionar foto</p>
                </div>
              </div>

              {/* Name & Document */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome Completo *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      placeholder="Nome do funcionário"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="document">CPF *</Label>
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

              {/* Department & Job Title */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="department">Departamento</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                    <Select
                      value={formData.departmentId}
                      onValueChange={(value) => setFormData({ ...formData, departmentId: value })}
                    >
                      <SelectTrigger className="pl-10">
                        <SelectValue placeholder="Selecione o departamento" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jobTitle">Cargo</Label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="jobTitle"
                      placeholder="Ex: Analista, Gerente..."
                      value={formData.jobTitle}
                      onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="flex gap-4 pt-4">
                <Button type="button" variant="outline" onClick={() => navigate('/employees')} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={createCredential.isPending}>
                  {createCredential.isPending ? 'Cadastrando...' : 'Cadastrar e Gerar Crachá'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default RegisterEmployee;
