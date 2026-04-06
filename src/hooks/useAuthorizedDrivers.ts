import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type DriverType = 'employee' | 'associate';
export type AuthorizationType = 'owner' | 'delegated' | 'corporate_pool';

export interface AuthorizedDriver {
  id: string;
  vehicleCredentialId: string;
  driverType: DriverType;
  employeeCredentialId?: string;
  associateId?: string;
  authorizationType: AuthorizationType;
  isActive: boolean;
  validFrom?: string;
  validUntil?: string;
  createdAt: string;
  // joined
  driverName?: string;
  driverDocument?: string;
  vehiclePlate?: string;
}

interface CreateDriverData {
  vehicleCredentialId: string;
  driverType: DriverType;
  employeeCredentialId?: string;
  associateId?: string;
  authorizationType: AuthorizationType;
  validFrom?: string;
  validUntil?: string;
}

const mapRow = (row: any): AuthorizedDriver => ({
  id: row.id,
  vehicleCredentialId: row.vehicle_credential_id,
  driverType: row.driver_type,
  employeeCredentialId: row.employee_credential_id,
  associateId: row.associate_id,
  authorizationType: row.authorization_type,
  isActive: row.is_active,
  validFrom: row.valid_from,
  validUntil: row.valid_until,
  createdAt: row.created_at,
  driverName: row.employee_credentials?.full_name || row.associates?.full_name,
  driverDocument: row.employee_credentials?.document || row.associates?.document,
});

export const useAuthorizedDrivers = (vehicleCredentialId: string) => {
  return useQuery({
    queryKey: ['authorized_drivers', vehicleCredentialId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicle_authorized_drivers')
        .select('*, employee_credentials(full_name, document), associates(full_name, document)')
        .eq('vehicle_credential_id', vehicleCredentialId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapRow);
    },
    enabled: !!vehicleCredentialId,
  });
};

export const useCreateAuthorizedDriver = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateDriverData) => {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('vehicle_authorized_drivers')
        .insert({
          vehicle_credential_id: data.vehicleCredentialId,
          driver_type: data.driverType,
          employee_credential_id: data.employeeCredentialId || null,
          associate_id: data.associateId || null,
          authorization_type: data.authorizationType,
          valid_from: data.validFrom || null,
          valid_until: data.validUntil || null,
          created_by: user.user?.id || null,
        });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['authorized_drivers', variables.vehicleCredentialId] });
      toast({ title: 'Condutor autorizado!', description: 'O condutor foi vinculado ao veículo.' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao autorizar condutor', description: error.message, variant: 'destructive' });
    },
  });
};

export const useToggleDriverStatus = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, isActive, vehicleCredentialId }: { id: string; isActive: boolean; vehicleCredentialId: string }) => {
      const { error } = await supabase
        .from('vehicle_authorized_drivers')
        .update({ is_active: isActive })
        .eq('id', id);
      if (error) throw error;
      return vehicleCredentialId;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['authorized_drivers', variables.vehicleCredentialId] });
      toast({ title: variables.isActive ? 'Condutor reativado' : 'Condutor desativado' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });
};
