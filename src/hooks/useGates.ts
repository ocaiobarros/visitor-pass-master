import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logAuditAction } from '@/hooks/useAuditLogs';

export interface Gate {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
}

const mapGate = (row: any): Gate => ({
  id: row.id,
  code: row.code,
  name: row.name,
  description: row.description,
  isActive: row.is_active,
  createdAt: new Date(row.created_at),
});

export const useGates = () => {
  return useQuery({
    queryKey: ['gates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gates')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data || []).map(mapGate);
    },
  });
};

export const useActiveGates = () => {
  return useQuery({
    queryKey: ['gates', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gates')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data || []).map(mapGate);
    },
  });
};

export const useCreateGate = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (gate: { code: string; name: string; description?: string }) => {
      const { error } = await supabase.from('gates').insert(gate);
      if (error) throw error;
      await logAuditAction('CONFIG_UPDATE', { action: 'gate_create', gate_name: gate.name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gates'] });
      toast({ title: 'Guarita criada!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });
};

export const useUpdateGate = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; code?: string; name?: string; description?: string; is_active?: boolean }) => {
      const { error } = await supabase.from('gates').update(updates).eq('id', id);
      if (error) throw error;
      await logAuditAction('CONFIG_UPDATE', { action: 'gate_update', gate_id: id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gates'] });
      toast({ title: 'Guarita atualizada!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });
};

export const useDeleteGate = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('gates').delete().eq('id', id);
      if (error) throw error;
      await logAuditAction('CONFIG_UPDATE', { action: 'gate_delete', gate_name: name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gates'] });
      toast({ title: 'Guarita removida!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });
};
