import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AccessLog, SubjectType, AccessDirection } from '@/types/visitor';
import { useToast } from '@/hooks/use-toast';

interface CreateAccessLogData {
  subjectType: SubjectType;
  subjectId: string;
  direction: AccessDirection;
  gateId?: string;
}

const mapDbToLog = (row: any): AccessLog => ({
  id: row.id,
  subjectType: row.subject_type,
  subjectId: row.subject_id,
  direction: row.direction,
  gateId: row.gate_id,
  operatorId: row.operator_id,
  createdAt: new Date(row.created_at),
});

export const useAccessLogs = (limit = 50) => {
  return useQuery({
    queryKey: ['access_logs', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('access_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return (data || []).map(mapDbToLog);
    },
  });
};

export const useSubjectAccessLogs = (subjectType: SubjectType, subjectId: string) => {
  return useQuery({
    queryKey: ['access_logs', subjectType, subjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('access_logs')
        .select('*')
        .eq('subject_type', subjectType)
        .eq('subject_id', subjectId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(mapDbToLog);
    },
    enabled: !!subjectId,
  });
};

export const useCreateAccessLog = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateAccessLogData) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data: log, error } = await supabase
        .from('access_logs')
        .insert({
          subject_type: data.subjectType,
          subject_id: data.subjectId,
          direction: data.direction,
          gate_id: data.gateId || 'GUARITA_01',
          operator_id: user.user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return mapDbToLog(log);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['access_logs'] });
      toast({
        title: variables.direction === 'in' ? 'Entrada registrada' : 'Saída registrada',
        description: 'Log de acesso salvo com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao registrar acesso',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};
