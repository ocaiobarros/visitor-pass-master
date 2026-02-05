import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { EmployeeCredential, CredentialType, CredentialStatus } from '@/types/visitor';
import { useToast } from '@/hooks/use-toast';

interface CreateCredentialData {
  type: CredentialType;
  fullName: string;
  document: string;
  departmentId?: string;
  jobTitle?: string;
  photoUrl?: string;
  vehicleMakeModel?: string;
  vehiclePlate?: string;
}

const mapDbToCredential = (row: any): EmployeeCredential => ({
  id: row.id,
  credentialId: row.credential_id,
  type: row.type,
  fullName: row.full_name,
  document: row.document,
  departmentId: row.department_id,
  department: row.departments ? { id: row.departments.id, name: row.departments.name } : undefined,
  jobTitle: row.job_title,
  photoUrl: row.photo_url,
  vehicleMakeModel: row.vehicle_make_model,
  vehiclePlate: row.vehicle_plate,
  status: row.status,
  createdBy: row.created_by,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
});

export const useEmployeeCredentials = () => {
  return useQuery({
    queryKey: ['employee_credentials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_credentials')
        .select('*, departments(id, name)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(mapDbToCredential);
    },
  });
};

export const useEmployeeCredential = (id: string) => {
  return useQuery({
    queryKey: ['employee_credential', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_credentials')
        .select('*, departments(id, name)')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) return null;
      return mapDbToCredential(data);
    },
    enabled: !!id,
  });
};

export const useCredentialByQrId = (credentialId: string) => {
  return useQuery({
    queryKey: ['employee_credential', 'qr', credentialId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_credentials')
        .select('*, departments(id, name)')
        .eq('credential_id', credentialId)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) return null;
      return mapDbToCredential(data);
    },
    enabled: !!credentialId && credentialId.startsWith('EC-'),
  });
};

export const useCreateCredential = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateCredentialData) => {
      const { data: user } = await supabase.auth.getUser();
      
      // Generate a temporary credential_id - the trigger will replace it
      const tempCredentialId = 'EC-' + Math.random().toString(36).substring(2, 10).toUpperCase();
      
      const { data: credential, error } = await supabase
        .from('employee_credentials')
        .insert({
          credential_id: tempCredentialId,
          type: data.type,
          full_name: data.fullName,
          document: data.document,
          department_id: data.departmentId || null,
          job_title: data.jobTitle || null,
          photo_url: data.photoUrl || null,
          vehicle_make_model: data.vehicleMakeModel || null,
          vehicle_plate: data.vehiclePlate || null,
          created_by: user.user?.id || null,
        })
        .select('*, departments(id, name)')
        .single();
      
      if (error) throw error;
      return mapDbToCredential(credential);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee_credentials'] });
      toast({
        title: 'Credencial criada!',
        description: 'A credencial do colaborador foi registrada.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao criar credencial',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateCredentialStatus = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CredentialStatus }) => {
      const { data, error } = await supabase
        .from('employee_credentials')
        .update({ status })
        .eq('id', id)
        .select('*, departments(id, name)')
        .single();
      
      if (error) throw error;
      return mapDbToCredential(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee_credentials'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao atualizar status',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};
