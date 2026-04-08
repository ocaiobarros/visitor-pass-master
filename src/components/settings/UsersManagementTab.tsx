import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActiveGates } from '@/hooks/useGates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { logAuditAction } from '@/hooks/useAuditLogs';
import { apiConfig } from '@/config/branding';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Shield, 
  UserPlus, 
  Mail, 
  Lock, 
  Search, 
  UserX, 
  UserCheck,
  Filter,
  Pencil,
  KeyRound,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AppRole } from '@/types/visitor';

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  created_at: string;
  is_active: boolean;
  roles: AppRole[];
  gate_id: string | null;
  gate_name: string | null;
}

const UsersManagementTab = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: activeGates } = useActiveGates();
  
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<AppRole>('security');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Edit modal state
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<AppRole>('security');
  const [editGateId, setEditGateId] = useState<string | null>(null);
  const [editPassword, setEditPassword] = useState('');
  const [editMustChangePassword, setEditMustChangePassword] = useState(true);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Deactivate confirmation
  const [confirmUser, setConfirmUser] = useState<UserProfile | null>(null);

  // Fetch all users with their profiles and roles
  const { data: usersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, email, created_at, is_active, gate_id, gate:gates!profiles_gate_id_fkey(id, name)')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      return (profiles || []).map(profile => {
        const gate = (profile as any).gate;
        return {
          ...profile,
          email: (profile as any).email || null,
          gate_id: profile.gate_id ?? gate?.id ?? null,
          gate_name: gate?.name || null,
          roles: (roles || [])
            .filter(r => r.user_id === profile.user_id)
            .map(r => r.role as AppRole),
        };
      }) as UserProfile[];
    },
  });

  // Filter users
  const filteredUsers = usersData?.filter(u => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = u.full_name.toLowerCase().includes(term) || (u.email || '').toLowerCase().includes(term);
    const matchesStatus = statusFilter === 'all' 
      || (statusFilter === 'active' && u.is_active !== false)
      || (statusFilter === 'inactive' && u.is_active === false);
    return matchesSearch && matchesStatus;
  }) || [];

  // Create new user via admin-api (local) or edge function (cloud)
  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPassword || newUserPassword.length < 6) {
      toast({
        title: 'Campos inválidos',
        description: 'Preencha email e senha (mínimo 6 caracteres).',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingUser(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const adminApiUrl = apiConfig.adminApiUrl;
      
      if (adminApiUrl) {
        const response = await fetch(`${adminApiUrl}/admin/create-user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: newUserEmail,
            password: newUserPassword,
            full_name: newUserName || newUserEmail,
            role: newUserRole,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Erro ao criar usuário');
        }
      } else {
        const response = await supabase.functions.invoke('admin-create-user', {
          body: {
            email: newUserEmail,
            password: newUserPassword,
            full_name: newUserName || newUserEmail,
            role: newUserRole,
          },
        });

        if (response.error) {
          throw new Error(response.error.message || 'Erro ao criar usuário');
        }

        if (response.data?.error) {
          throw new Error(response.data.error);
        }
      }

      toast({
        title: 'Usuário criado!',
        description: `${newUserEmail} foi adicionado ao sistema.`,
      });

      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
      setNewUserRole('security');
      setIsCreateUserOpen(false);
      
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: 'Erro ao criar usuário',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Open edit modal
  const openEditModal = (u: UserProfile) => {
    setEditingUser(u);
    setEditName(u.full_name);
    setEditRole(u.roles[0] || 'security');
    setEditGateId(u.gate_id);
    setEditPassword('');
    setEditMustChangePassword(true);
  };

  // Save all edits
  const handleSaveEdit = async () => {
    if (!editingUser || !editName.trim()) return;
    setIsSavingEdit(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Sessão expirada.');

      const changes: string[] = [];

      // Update name if changed
      if (editName.trim() !== editingUser.full_name) {
        if (apiConfig.adminApiUrl) {
          const response = await fetch(`${apiConfig.adminApiUrl}/admin/update-profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ user_id: editingUser.user_id, full_name: editName.trim() }),
          });
          if (response.status === 404) {
            const { error } = await supabase.from('profiles').update({ full_name: editName.trim() }).eq('user_id', editingUser.user_id);
            if (error) throw error;
          } else if (!response.ok) {
            const result = await response.json().catch(() => null);
            throw new Error(result?.error || 'Erro ao atualizar nome');
          }
        } else {
          const { error } = await supabase.from('profiles').update({ full_name: editName.trim() }).eq('user_id', editingUser.user_id);
          if (error) throw error;
        }
        await logAuditAction('USER_UPDATE', { target_user: editingUser.email || editingUser.full_name, new_name: editName.trim() });
        changes.push('nome');
      }

      // Update role if changed
      if (editRole !== (editingUser.roles[0] || 'security')) {
        await supabase.from('user_roles').delete().eq('user_id', editingUser.user_id);
        const { error } = await supabase.from('user_roles').insert({ user_id: editingUser.user_id, role: editRole });
        if (error) throw error;
        await logAuditAction('ROLE_UPDATE', { target_user: editingUser.email || editingUser.full_name, new_role: editRole });
        changes.push('permissão');
      }

      // Update gate if changed
      if (editGateId !== editingUser.gate_id) {
        const gateName = editGateId ? activeGates?.find(g => g.id === editGateId)?.name || null : null;

        if (apiConfig.adminApiUrl) {
          const response = await fetch(`${apiConfig.adminApiUrl}/admin/assign-gate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ profile_id: editingUser.id, gate_id: editGateId }),
          });
          if (!response.ok) {
            const result = await response.json().catch(() => null);
            throw new Error(result?.error || 'Erro ao vincular guarita');
          }
        } else {
          const { error } = await supabase.from('profiles').update({ gate_id: editGateId }).eq('id', editingUser.id);
          if (error) throw error;
        }
        await logAuditAction('CONFIG_UPDATE', { action: 'gate_assign', target_user: editingUser.full_name, gate_name: gateName });
        changes.push('guarita');
      }

      // Reset password if provided
      if (editPassword.trim().length > 0) {
        if (editPassword.trim().length < 6) {
          toast({ title: 'Senha muito curta', description: 'Mínimo 6 caracteres.', variant: 'destructive' });
          setIsSavingEdit(false);
          return;
        }

        if (apiConfig.adminApiUrl) {
          const response = await fetch(`${apiConfig.adminApiUrl}/admin/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ user_id: editingUser.user_id, new_password: editPassword.trim(), must_change_password: editMustChangePassword }),
          });
          if (!response.ok) {
            const result = await response.json().catch(() => null);
            throw new Error(result?.error || 'Erro ao alterar senha');
          }
        } else {
          const response = await supabase.functions.invoke('admin-reset-password', {
            body: { user_id: editingUser.user_id, new_password: editPassword.trim(), must_change_password: editMustChangePassword },
          });
          if (response.error) throw new Error(response.error.message || 'Erro ao alterar senha');
          if (response.data?.error) throw new Error(response.data.error);
        }
        changes.push('senha');
      }

      if (changes.length > 0) {
        toast({ title: 'Usuário atualizado!', description: `Alterações: ${changes.join(', ')}.` });
      } else {
        toast({ title: 'Nenhuma alteração realizada.' });
      }

      setEditingUser(null);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Toggle user active status
  const handleToggleStatus = async (u: UserProfile) => {
    const isActive = u.is_active === false;
    try {
      const { error } = await supabase.from('profiles').update({ is_active: isActive }).eq('user_id', u.user_id);
      if (error) throw error;
      await logAuditAction(isActive ? 'USER_ACTIVATE' : 'USER_DEACTIVATE', { target_user: u.email || u.full_name });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: isActive ? 'Usuário ativado!' : 'Usuário desativado!' });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
    setConfirmUser(null);
  };

  const roleColors: Record<AppRole, string> = {
    admin: 'bg-destructive text-destructive-foreground',
    operador_acesso: 'bg-primary text-primary-foreground',
    security: 'bg-muted text-muted-foreground',
  };

  const roleLabels: Record<AppRole, string> = {
    admin: 'Admin',
    operador_acesso: 'Operador de Acesso',
    security: 'Segurança',
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Gerenciar Usuários
              </CardTitle>
              <CardDescription>
                Crie novos usuários e gerencie permissões
              </CardDescription>
            </div>
            <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <UserPlus className="w-4 h-4" />
                  Novo Usuário
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Novo Usuário</DialogTitle>
                  <DialogDescription>
                    Adicione um novo usuário ao sistema GUARDA OPERACIONAL
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-user-name">Nome Completo</Label>
                    <Input
                      id="new-user-name"
                      placeholder="Nome do usuário"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-user-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="new-user-email"
                        type="email"
                        placeholder="usuario@empresa.com"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-user-password">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="new-user-password"
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Permissão</Label>
                    <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as AppRole)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin (acesso total)</SelectItem>
                        <SelectItem value="operador_acesso">Operador de Acesso (cadastros)</SelectItem>
                        <SelectItem value="security">Segurança (scanner)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleCreateUser} className="w-full" disabled={isCreatingUser}>
                    {isCreatingUser ? 'Criando...' : 'Criar Usuário'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-lg bg-muted/50">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | 'active' | 'inactive')}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            {filteredUsers.length} usuário(s) encontrado(s)
          </div>

          {isLoadingUsers ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Login (Email)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Permissão</TableHead>
                    <TableHead>Guarita</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <TableRow key={u.id} className={u.is_active === false ? 'opacity-50' : ''}>
                      <TableCell className="font-medium">{u.full_name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{u.email || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={u.is_active !== false ? 'default' : 'secondary'}>
                          {u.is_active !== false ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {u.roles.map((role: AppRole) => (
                            <Badge key={role} className={roleColors[role]}>
                              {roleLabels[role] || role.toUpperCase()}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{u.gate_name || '—'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(u.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => openEditModal(u)}
                            disabled={u.user_id === user?.id}
                          >
                            <Pencil className="w-3 h-3" />
                            Editar
                          </Button>
                          <Button
                            variant={u.is_active !== false ? 'destructive' : 'default'}
                            size="sm"
                            className="gap-1"
                            disabled={u.user_id === user?.id}
                            onClick={() => setConfirmUser(u)}
                          >
                            {u.is_active !== false ? (
                              <>
                                <UserX className="w-3 h-3" />
                                Desativar
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-3 h-3" />
                                Ativar
                              </>
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit User Modal */}
      <Dialog open={!!editingUser} onOpenChange={(open) => { if (!open) setEditingUser(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              {editingUser?.email || editingUser?.full_name}
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Nome Completo</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nome do usuário"
                />
              </div>
              <div className="space-y-2">
                <Label>Permissão</Label>
                <Select value={editRole} onValueChange={(v) => setEditRole(v as AppRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin (acesso total)</SelectItem>
                    <SelectItem value="operador_acesso">Operador de Acesso (cadastros)</SelectItem>
                    <SelectItem value="security">Segurança (scanner)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Guarita</Label>
                <Select value={editGateId || 'none'} onValueChange={(v) => setEditGateId(v === 'none' ? null : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sem guarita" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem guarita</SelectItem>
                    {activeGates?.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={isSavingEdit}>
              {isSavingEdit ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Activate/Deactivate */}
      <AlertDialog open={!!confirmUser} onOpenChange={(open) => { if (!open) setConfirmUser(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmUser?.is_active !== false ? 'Desativar usuário?' : 'Ativar usuário?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmUser?.is_active !== false 
                ? `O usuário "${confirmUser?.full_name}" não poderá mais fazer login no sistema.`
                : `O usuário "${confirmUser?.full_name}" poderá fazer login novamente.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmUser && handleToggleStatus(confirmUser)}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default UsersManagementTab;
