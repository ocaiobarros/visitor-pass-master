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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { logAuditAction } from '@/hooks/useAuditLogs';
import { apiConfig } from '@/config/branding';
import { 
  Shield, 
  UserPlus, 
  Mail, 
  Lock, 
  Search, 
  RotateCcw, 
  UserX, 
  UserCheck,
  Filter,
  Pencil,
  Check,
  X
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
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

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

      // Check if admin-api is available (self-hosted)
      const adminApiUrl = apiConfig.adminApiUrl;
      
      let result;
      
      if (adminApiUrl) {
        // Use local admin-api (self-hosted Docker)
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

        result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Erro ao criar usuário');
        }
      } else {
        // Use Supabase edge function (Cloud)
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

        result = response.data;
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

  // Update user role
  const updateRole = useMutation({
    mutationFn: async ({ userId, role, userEmail }: { userId: string; role: AppRole; userEmail: string }) => {
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });

      if (error) throw error;

      await logAuditAction('ROLE_UPDATE', { 
        target_user: userEmail, 
        new_role: role 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Permissão atualizada!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  // Toggle user active status
  const toggleUserStatus = useMutation({
    mutationFn: async ({ userId, isActive, userEmail }: { userId: string; isActive: boolean; userEmail: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: isActive })
        .eq('user_id', userId);

      if (error) throw error;

      await logAuditAction(isActive ? 'USER_ACTIVATE' : 'USER_DEACTIVATE', { 
        target_user: userEmail 
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ 
        title: variables.isActive ? 'Usuário ativado!' : 'Usuário desativado!' 
      });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  // Assign gate to user
  const assignGate = useMutation({
    mutationFn: async ({ profileId, gateId, userName }: { profileId: string; gateId: string | null; userName: string }) => {
      const gateName = gateId ? activeGates?.find((gate) => gate.id === gateId)?.name || null : null;

      if (apiConfig.adminApiUrl) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        if (!token) {
          throw new Error('Sessão expirada. Faça login novamente.');
        }

        const response = await fetch(`${apiConfig.adminApiUrl}/admin/assign-gate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            profile_id: profileId,
            gate_id: gateId,
          }),
        });

        const result = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(result?.error || 'Não foi possível salvar a guarita para este usuário.');
        }

        return {
          profileId: result.profile.id,
          userId: result.profile.user_id,
          gateId: result.profile.gate_id,
          gateName: result.profile.gate_name ?? gateName,
        };
      }

      const { error } = await supabase
        .from('profiles')
        .update({ gate_id: gateId })
        .eq('id', profileId);

      if (error) throw error;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, gate_id')
        .eq('id', profileId)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) throw new Error('Não foi possível salvar a guarita para este usuário.');

      await logAuditAction('CONFIG_UPDATE', { action: 'gate_assign', target_user: userName, gate_id: gateId });

      return {
        profileId,
        userId: profile.user_id,
        gateId: profile.gate_id,
        gateName,
      };
    },
    onSuccess: (result) => {
      queryClient.setQueryData(['admin-users'], (current: UserProfile[] | undefined) =>
        current?.map((profile) =>
          profile.id === result.profileId
            ? {
                ...profile,
                user_id: result.userId,
                gate_id: result.gateId,
                gate_name: result.gateName,
              }
            : profile,
        ),
      );

      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Guarita vinculada!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  // Update user full name
  const updateName = useMutation({
    mutationFn: async ({ userId, fullName, userEmail }: { userId: string; fullName: string; userEmail: string }) => {
      if (apiConfig.adminApiUrl) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) throw new Error('Sessão expirada.');

        const response = await fetch(`${apiConfig.adminApiUrl}/admin/update-profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ user_id: userId, full_name: fullName }),
        });
        
        // Fallback to direct update if admin-api doesn't support this endpoint
        if (response.status === 404) {
          const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('user_id', userId);
          if (error) throw error;
        } else if (!response.ok) {
          const result = await response.json().catch(() => null);
          throw new Error(result?.error || 'Erro ao atualizar nome');
        }
      } else {
        const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('user_id', userId);
        if (error) throw error;
      }

      await logAuditAction('USER_UPDATE', { target_user: userEmail, new_name: fullName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setEditingUserId(null);
      toast({ title: 'Nome atualizado!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  // Request password reset
  const handlePasswordReset = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });

      if (error) throw error;

      await logAuditAction('PASSWORD_RESET', { target_user: email });

      toast({
        title: 'Email enviado!',
        description: `Link de reset de senha enviado para ${email}.`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar email',
        description: error.message,
        variant: 'destructive',
      });
    }
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

        {/* Results count */}
        <div className="text-sm text-muted-foreground">
          {filteredUsers.length} usuário(s) encontrado(s)
        </div>

        {/* Table */}
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
                  <TableHead>Alterar</TableHead>
                  <TableHead>Guarita</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((u) => (
                  <TableRow key={u.id} className={u.is_active === false ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">
                      {editingUserId === u.user_id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="h-8 w-40"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && editingName.trim()) {
                                updateName.mutate({ userId: u.user_id, fullName: editingName.trim(), userEmail: u.email || u.full_name });
                              }
                              if (e.key === 'Escape') setEditingUserId(null);
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              if (editingName.trim()) {
                                updateName.mutate({ userId: u.user_id, fullName: editingName.trim(), userEmail: u.email || u.full_name });
                              }
                            }}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingUserId(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 group">
                          <span>{u.full_name}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => { setEditingUserId(u.user_id); setEditingName(u.full_name); }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {u.email || '—'}
                    </TableCell>
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
                    <TableCell>
                      <Select
                        value={u.roles[0] || 'security'}
                        onValueChange={(value) =>
                          updateRole.mutate({ userId: u.user_id, role: value as AppRole, userEmail: u.full_name })
                        }
                        disabled={u.user_id === user?.id}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="operador_acesso">Operador de Acesso</SelectItem>
                          <SelectItem value="security">Segurança</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={u.gate_id || 'none'}
                        onValueChange={(v) => assignGate.mutate({
                          profileId: u.id,
                          gateId: v === 'none' ? null : v,
                          userName: u.full_name,
                        })}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue placeholder="Sem guarita" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem guarita</SelectItem>
                          {activeGates?.map(g => (
                            <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(u.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => handlePasswordReset(u.full_name)}
                          disabled={u.user_id === user?.id}
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reset
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant={u.is_active !== false ? 'destructive' : 'default'}
                              size="sm"
                              className="gap-1"
                              disabled={u.user_id === user?.id}
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
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {u.is_active !== false ? 'Desativar usuário?' : 'Ativar usuário?'}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {u.is_active !== false 
                                  ? `O usuário "${u.full_name}" não poderá mais fazer login no sistema.`
                                  : `O usuário "${u.full_name}" poderá fazer login novamente.`
                                }
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => toggleUserStatus.mutate({ 
                                  userId: u.user_id, 
                                  isActive: u.is_active === false,
                                  userEmail: u.full_name 
                                })}
                              >
                                Confirmar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
  );
};

export default UsersManagementTab;
