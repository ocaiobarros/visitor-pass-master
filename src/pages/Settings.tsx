import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Settings as SettingsIcon, Users, Activity, Shield, Plus, Trash2, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AppRole } from '@/types/visitor';
import { Navigate } from 'react-router-dom';
import { useDepartments } from '@/hooks/useDepartments';

const Settings = () => {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newDepartment, setNewDepartment] = useState('');

  // Only admin can access
  if (!hasRole('admin')) {
    return <Navigate to="/dashboard" replace />;
  }

  // Fetch all users with their profiles and roles
  const { data: usersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Combine profiles with roles
      return (profiles || []).map(profile => ({
        ...profile,
        roles: (roles || [])
          .filter(r => r.user_id === profile.user_id)
          .map(r => r.role as AppRole),
      }));
    },
  });

  // Fetch recent access logs
  const { data: accessLogs, isLoading: isLoadingLogs } = useQuery({
    queryKey: ['admin-access-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('access_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
  });

  // Departments
  const { data: departments } = useDepartments();

  // Update user role
  const updateRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      // First delete existing role
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      // Then insert new role
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Role atualizada!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  // Add department
  const addDepartment = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from('departments')
        .insert({ name });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setNewDepartment('');
      toast({ title: 'Setor adicionado!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  // Delete department
  const deleteDepartment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast({ title: 'Setor removido!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const roleColors: Record<AppRole, string> = {
    admin: 'bg-destructive text-destructive-foreground',
    rh: 'bg-primary text-primary-foreground',
    security: 'bg-muted text-muted-foreground',
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-primary" />
            Configurações do Sistema
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie usuários, setores e visualize logs de atividades
          </p>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="departments" className="gap-2">
              <Building2 className="w-4 h-4" />
              Setores
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <Activity className="w-4 h-4" />
              Logs de Acesso
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Gerenciar Usuários
                </CardTitle>
                <CardDescription>
                  Atribua roles e gerencie permissões dos usuários do sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingUsers ? (
                  <p className="text-muted-foreground">Carregando...</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Role Atual</TableHead>
                        <TableHead>Alterar Role</TableHead>
                        <TableHead>Cadastro</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usersData?.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.full_name}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {u.roles.map((role: AppRole) => (
                                <Badge key={role} className={roleColors[role]}>
                                  {role.toUpperCase()}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={u.roles[0] || 'security'}
                              onValueChange={(value) =>
                                updateRole.mutate({ userId: u.user_id, role: value as AppRole })
                              }
                              disabled={u.user_id === user?.id}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="rh">RH</SelectItem>
                                <SelectItem value="security">Segurança</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {format(new Date(u.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Departments Tab */}
          <TabsContent value="departments">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Gerenciar Setores
                </CardTitle>
                <CardDescription>
                  Adicione ou remova setores/departamentos da empresa
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome do novo setor..."
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && newDepartment && addDepartment.mutate(newDepartment)}
                  />
                  <Button
                    onClick={() => newDepartment && addDepartment.mutate(newDepartment)}
                    disabled={!newDepartment || addDepartment.isPending}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {departments?.map((dept) => (
                    <div
                      key={dept.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <span className="font-medium">{dept.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteDepartment.mutate(dept.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Logs de Acesso
                </CardTitle>
                <CardDescription>
                  Últimas 50 movimentações de entrada/saída registradas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingLogs ? (
                  <p className="text-muted-foreground">Carregando...</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Direção</TableHead>
                        <TableHead>Portão</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accessLogs?.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm">
                            {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <Badge variant={log.subject_type === 'visitor' ? 'secondary' : 'outline'}>
                              {log.subject_type === 'visitor' ? 'Visitante' : 'Colaborador'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={log.direction === 'in' ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'}>
                              {log.direction === 'in' ? '↓ ENTRADA' : '↑ SAÍDA'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{log.gate_id}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
