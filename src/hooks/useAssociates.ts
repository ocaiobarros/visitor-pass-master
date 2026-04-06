import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type AssociateStatus = 'active' | 'suspended' | 'expired';
export type RelationshipType = 'conjuge' | 'pai' | 'mae' | 'motorista_particular' | 'outro';
export type ValidityType = 'permanent' | 'temporary';

export interface Associate {
  id: string;
  employeeCredentialId: string;
  fullName: string;
  document: string;
  phone?: string;
  photoUrl?: string;
  relationshipType: RelationshipType;
  validityType: ValidityType;
  validFrom?: string;
  validUntil?: string;
  status: AssociateStatus;
  passId: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  // joined
  employeeName?: string;
  employeeDocument?: string;
}

interface CreateAssociateData {
  employeeCredentialId: string;
  fullName: string;
  document: string;
  phone?: string;
  photoUrl?: string;
  relationshipType: RelationshipType;
  validityType: ValidityType;
  validFrom?: string;
  validUntil?: string;
}

const mapRow = (row: any): Associate => ({
  id: row.id,
  employeeCredentialId: row.employee_credential_id,
  fullName: row.full_name,
  document: row.document,
  phone: row.phone,
  photoUrl: row.photo_url,
  relationshipType: row.relationship_type,
  validityType: row.validity_type,
  validFrom: row.valid_from,
  validUntil: row.valid_until,
  status: row.status,
  passId: row.pass_id,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  employeeName: row.employee_credentials?.full_name,
  employeeDocument: row.employee_credentials?.document,
});

export const useAssociates = () => {
  return useQuery({
    queryKey: ['associates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('associates')
        .select('*, employee_credentials(full_name, document)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapRow);
    },
  });
};

export const useAssociatesByEmployee = (employeeCredentialId: string) => {
  return useQuery({
    queryKey: ['associates', 'employee', employeeCredentialId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('associates')
        .select('*, employee_credentials(full_name, document)')
        .eq('employee_credential_id', employeeCredentialId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapRow);
    },
    enabled: !!employeeCredentialId,
  });
};

export const useCreateAssociate = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateAssociateData) => {
      const { data: user } = await supabase.auth.getUser();
      const { data: result, error } = await supabase
        .from('associates')
        .insert({
          employee_credential_id: data.employeeCredentialId,
          full_name: data.fullName,
          document: data.document,
          phone: data.phone || null,
          photo_url: data.photoUrl || null,
          relationship_type: data.relationshipType,
          validity_type: data.validityType,
          valid_from: data.validFrom || null,
          valid_until: data.validUntil || null,
          pass_id: '', // trigger generates it
          created_by: user.user?.id || null,
        })
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['associates'] });
      toast({ title: 'Agregado cadastrado!', description: 'O agregado foi vinculado ao colaborador.' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao cadastrar agregado', description: error.message, variant: 'destructive' });
    },
  });
};

export const useUpdateAssociateStatus = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AssociateStatus }) => {
      const { error } = await supabase
        .from('associates')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['associates'] });
      toast({ title: 'Status atualizado' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao atualizar status', description: error.message, variant: 'destructive' });
    },
  });
};
