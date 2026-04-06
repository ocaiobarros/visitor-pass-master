import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MaskedInput } from '@/components/ui/masked-input';
import { useCreateAssociate, type RelationshipType, type ValidityType } from '@/hooks/useAssociates';
import { useEmployeeCredentials } from '@/hooks/useEmployeeCredentials';
import { useAuth } from '@/context/AuthContext';
import { Users, ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const RegisterAssociate = () => {
  const navigate = useNavigate();
  const { isAdminOrRh } = useAuth();
  const { toast } = useToast();
  const createAssociate = useCreateAssociate();
  const { data: credentials = [] } = useEmployeeCredentials();

  // Only personal credentials can be responsible
  const personalCredentials = credentials.filter(c => c.type === 'personal' && c.status === 'allowed');

  const [form, setForm] = useState({
    employeeCredentialId: '',
    fullName: '',
    document: '',
    phone: '',
    relationshipType: '' as RelationshipType | '',
    validityType: 'permanent' as ValidityType,
    validFrom: '',
    validUntil: '',
  });

  if (!isAdminOrRh) {
    return (
      <DashboardLayout pageTitle="Cadastrar Agregado">
        <div className="text-center py-20 text-muted-foreground">Acesso restrito a Admin/Operador de Acesso.</div>
      </DashboardLayout>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.employeeCredentialId || !form.fullName || !form.document || !form.relationshipType) {
      toast({ title: 'Campos obrigatórios', description: 'Preencha todos os campos obrigatórios.', variant: 'destructive' });
      return;
    }

    const cleanDoc = form.document.replace(/\D/g, '');
    if (cleanDoc.length !== 11) {
      toast({ title: 'CPF inválido', description: 'O CPF deve ter 11 dígitos.', variant: 'destructive' });
      return;
    }

    if (form.validityType === 'temporary' && (!form.validFrom || !form.validUntil)) {
      toast({ title: 'Validade obrigatória', description: 'Informe as datas de início e fim.', variant: 'destructive' });
      return;
    }

    createAssociate.mutate({
      employeeCredentialId: form.employeeCredentialId,
      fullName: form.fullName,
      document: cleanDoc,
      phone: form.phone ? form.phone.replace(/\D/g, '') : undefined,
      relationshipType: form.relationshipType as RelationshipType,
      validityType: form.validityType,
      validFrom: form.validityType === 'temporary' ? new Date(form.validFrom).toISOString() : undefined,
      validUntil: form.validityType === 'temporary' ? new Date(form.validUntil).toISOString() : undefined,
    }, {
      onSuccess: () => navigate('/associates'),
    });
  };

  return (
    <DashboardLayout pageTitle="Cadastrar Agregado">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/associates')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Cadastrar Agregado</h1>
            <p className="text-muted-foreground">Vincular pessoa a um colaborador responsável</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Colaborador responsável */}
              <div className="space-y-2">
                <Label>Colaborador Responsável *</Label>
                <Select value={form.employeeCredentialId} onValueChange={(v) => setForm(f => ({ ...f, employeeCredentialId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o colaborador..." />
                  </SelectTrigger>
                  <SelectContent>
                    {personalCredentials.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.fullName} — {c.document}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Nome e CPF */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome Completo *</Label>
                  <Input value={form.fullName} onChange={(e) => setForm(f => ({ ...f, fullName: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>CPF *</Label>
                  <MaskedInput mask="cpf" value={form.document} onChange={(v) => setForm(f => ({ ...f, document: v }))} />
                </div>
              </div>

              {/* Telefone e Vínculo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <MaskedInput mask="phone" value={form.phone} onChange={(v) => setForm(f => ({ ...f, phone: v }))} />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Vínculo *</Label>
                  <Select value={form.relationshipType} onValueChange={(v) => setForm(f => ({ ...f, relationshipType: v as RelationshipType }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conjuge">Cônjuge</SelectItem>
                      <SelectItem value="pai">Pai</SelectItem>
                      <SelectItem value="mae">Mãe</SelectItem>
                      <SelectItem value="filho">Filho</SelectItem>
                      <SelectItem value="filha">Filha</SelectItem>
                      <SelectItem value="irmao">Irmão</SelectItem>
                      <SelectItem value="irma">Irmã</SelectItem>
                      <SelectItem value="namorado">Namorado</SelectItem>
                      <SelectItem value="namorada">Namorada</SelectItem>
                      <SelectItem value="motorista_particular">Motorista Particular</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Validade */}
              <div className="space-y-2">
                <Label>Tipo de Validade</Label>
                <Select value={form.validityType} onValueChange={(v) => setForm(f => ({ ...f, validityType: v as ValidityType }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="permanent">Permanente</SelectItem>
                    <SelectItem value="temporary">Temporária</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.validityType === 'temporary' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Início *</Label>
                    <Input type="datetime-local" value={form.validFrom} onChange={(e) => setForm(f => ({ ...f, validFrom: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Fim *</Label>
                    <Input type="datetime-local" value={form.validUntil} onChange={(e) => setForm(f => ({ ...f, validUntil: e.target.value }))} />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => navigate('/associates')} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" disabled={createAssociate.isPending} className="flex-1 gap-2">
                  {createAssociate.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  <Users className="w-4 h-4" />
                  Cadastrar Agregado
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default RegisterAssociate;
