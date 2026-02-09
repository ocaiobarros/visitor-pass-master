import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { useDepartments } from '@/hooks/useDepartments';
import { useCreateVisitor } from '@/hooks/useVisitors';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { UserPlus, Building2, User, Phone, Calendar, FileText, Camera, IdCard, Car } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { VisitToType, VisitorAccessType } from '@/types/visitor';
import { MaskedInput, isValidCPF, isValidPhone } from '@/components/ui/masked-input';
import { useToast } from '@/hooks/use-toast';

const RegisterVisitor = () => {
  const navigate = useNavigate();
  const { data: departments = [] } = useDepartments();
  const createVisitor = useCreateVisitor();
  const { isAdminOrRh } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    fullName: '',
    document: '',
    company: '',
    phone: '',
    companyReason: '',
    accessType: 'pedestrian' as VisitorAccessType,
    visitToType: 'setor' as VisitToType,
    visitToName: '',
    gateObs: '',
    vehiclePlate: '',
    vehicleBrand: '',
    vehicleModel: '',
    vehicleColor: '',
  });
  const [validFrom, setValidFrom] = useState<Date>(new Date());
  const [validUntil, setValidUntil] = useState<Date>(new Date(Date.now() + 4 * 60 * 60 * 1000));
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

  const isDriver = formData.accessType === 'driver';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidCPF(formData.document)) {
      toast({ title: 'CPF inválido', description: 'Por favor, informe um CPF válido.', variant: 'destructive' });
      return;
    }

    if (formData.phone && !isValidPhone(formData.phone)) {
      toast({ title: 'Telefone inválido', description: 'Por favor, informe um telefone válido com DDD.', variant: 'destructive' });
      return;
    }

    if (!formData.companyReason.trim()) {
      toast({ title: 'Campo obrigatório', description: 'Informe a Empresa/Motivo.', variant: 'destructive' });
      return;
    }

    if (isDriver && (!formData.vehiclePlate.trim() || !formData.vehicleBrand.trim() || !formData.vehicleModel.trim() || !formData.vehicleColor.trim())) {
      toast({ title: 'Dados do veículo obrigatórios', description: 'Preencha Placa, Marca, Modelo e Cor.', variant: 'destructive' });
      return;
    }

    createVisitor.mutate({
      fullName: formData.fullName,
      document: formData.document,
      company: formData.company || undefined,
      phone: formData.phone || undefined,
      photoUrl,
      visitToType: formData.visitToType,
      visitToName: formData.visitToName,
      gateObs: formData.gateObs || undefined,
      companyReason: formData.companyReason,
      accessType: formData.accessType,
      vehiclePlate: isDriver ? formData.vehiclePlate : undefined,
      vehicleBrand: isDriver ? formData.vehicleBrand : undefined,
      vehicleModel: isDriver ? formData.vehicleModel : undefined,
      vehicleColor: isDriver ? formData.vehicleColor : undefined,
      validFrom,
      validUntil,
    }, {
      onSuccess: (visitor) => {
        navigate(`/pass/${visitor.id}`);
      }
    });
  };

  if (!isAdminOrRh) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <h2 className="text-2xl font-bold text-foreground">Acesso Restrito</h2>
          <p className="text-muted-foreground mt-2">Apenas RH e Administradores podem registrar visitantes.</p>
          <Button onClick={() => navigate('/dashboard')} className="mt-6">Voltar ao Dashboard</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <UserPlus className="w-8 h-8 text-primary" />
            Registrar Visitante
          </h1>
          <p className="text-muted-foreground mt-1">Preencha os dados do visitante para gerar o passe</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dados do Visitante</CardTitle>
            <CardDescription>Todas as informações serão incluídas no passe</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Photo Upload */}
              <div className="flex justify-center">
                <div className="relative">
                  <div className="w-32 h-32 rounded-xl bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
                    {photoUrl ? (
                      <img src={photoUrl} alt="Foto do visitante" className="w-full h-full object-cover" style={{ aspectRatio: '1/1' }} />
                    ) : (
                      <Camera className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <input type="file" accept="image/*" onChange={handlePhotoChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <p className="text-xs text-muted-foreground text-center mt-2">Clique para adicionar foto</p>
                </div>
              </div>

              {/* Name & Document */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome Completo *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="fullName" placeholder="Nome do visitante" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} className="pl-10" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="document">CPF *</Label>
                  <div className="relative">
                    <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                    <MaskedInput id="document" mask="cpf" placeholder="000.000.000-00" value={formData.document} onChange={(value) => setFormData({ ...formData, document: value })} className="pl-10" required />
                  </div>
                </div>
              </div>

              {/* Company Reason (required) & Phone */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyReason">Empresa/Motivo *</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="companyReason" placeholder="Ex: Manutenção predial" value={formData.companyReason} onChange={(e) => setFormData({ ...formData, companyReason: e.target.value })} className="pl-10" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                    <MaskedInput id="phone" mask="phone" placeholder="(11) 99999-9999" value={formData.phone} onChange={(value) => setFormData({ ...formData, phone: value })} className="pl-10" />
                  </div>
                </div>
              </div>

              {/* Access Type */}
              <div className="space-y-3">
                <Label>Tipo de Acesso *</Label>
                <RadioGroup
                  value={formData.accessType}
                  onValueChange={(value) => setFormData({ ...formData, accessType: value as VisitorAccessType, vehiclePlate: '', vehicleBrand: '', vehicleModel: '', vehicleColor: '' })}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pedestrian" id="pedestrian" />
                    <Label htmlFor="pedestrian">A pé / Passageiro</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="driver" id="driver" />
                    <Label htmlFor="driver">Condutor de Veículo</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Vehicle Fields (conditional) */}
              {isDriver && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Car className="w-5 h-5 text-primary" />
                      <span className="font-semibold text-foreground">Dados do Veículo</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="vehiclePlate">Placa *</Label>
                        <Input id="vehiclePlate" placeholder="ABC-1D23" value={formData.vehiclePlate} onChange={(e) => setFormData({ ...formData, vehiclePlate: e.target.value.toUpperCase() })} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vehicleBrand">Marca *</Label>
                        <Input id="vehicleBrand" placeholder="Ex: Fiat" value={formData.vehicleBrand} onChange={(e) => setFormData({ ...formData, vehicleBrand: e.target.value })} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vehicleModel">Modelo *</Label>
                        <Input id="vehicleModel" placeholder="Ex: Uno" value={formData.vehicleModel} onChange={(e) => setFormData({ ...formData, vehicleModel: e.target.value })} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vehicleColor">Cor *</Label>
                        <Input id="vehicleColor" placeholder="Ex: Prata" value={formData.vehicleColor} onChange={(e) => setFormData({ ...formData, vehicleColor: e.target.value })} required />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Visit To Type */}
              <div className="space-y-3">
                <Label>Veio para *</Label>
                <RadioGroup
                  value={formData.visitToType}
                  onValueChange={(value) => setFormData({ ...formData, visitToType: value as VisitToType, visitToName: '' })}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="setor" id="setor" />
                    <Label htmlFor="setor">Setor/Departamento</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pessoa" id="pessoa" />
                    <Label htmlFor="pessoa">Pessoa específica</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Visit To Name */}
              <div className="space-y-2">
                <Label htmlFor="visitToName">
                  {formData.visitToType === 'setor' ? 'Departamento *' : 'Nome da pessoa *'}
                </Label>
                {formData.visitToType === 'setor' ? (
                  <Select value={formData.visitToName} onValueChange={(value) => setFormData({ ...formData, visitToName: value })} required>
                    <SelectTrigger><SelectValue placeholder="Selecione o departamento" /></SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input id="visitToName" placeholder="Nome do funcionário" value={formData.visitToName} onChange={(e) => setFormData({ ...formData, visitToName: e.target.value })} required />
                )}
              </div>

              {/* Gate Observation */}
              <div className="space-y-2">
                <Label htmlFor="gateObs">Observações para Guarita</Label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Textarea id="gateObs" placeholder="Observações que a guarita deve ver ao escanear..." value={formData.gateObs} onChange={(e) => setFormData({ ...formData, gateObs: e.target.value })} className="pl-10 min-h-[80px]" />
                </div>
              </div>

              {/* Validity Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Válido De *</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                    <DatePicker selected={validFrom} onChange={(date) => date && setValidFrom(date)} showTimeSelect timeFormat="HH:mm" timeIntervals={15} dateFormat="dd/MM/yyyy HH:mm" className="w-full pl-10 pr-4 py-2 border border-input rounded-md bg-background" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Válido Até *</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                    <DatePicker selected={validUntil} onChange={(date) => date && setValidUntil(date)} showTimeSelect timeFormat="HH:mm" timeIntervals={15} dateFormat="dd/MM/yyyy HH:mm" className="w-full pl-10 pr-4 py-2 border border-input rounded-md bg-background" minDate={validFrom} />
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="flex gap-4 pt-4">
                <Button type="button" variant="outline" onClick={() => navigate('/dashboard')} className="flex-1">Cancelar</Button>
                <Button type="submit" className="flex-1" disabled={createVisitor.isPending}>
                  {createVisitor.isPending ? 'Registrando...' : 'Registrar e Gerar Passe'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default RegisterVisitor;
