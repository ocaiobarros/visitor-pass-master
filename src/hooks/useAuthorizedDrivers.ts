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
  driverStatus?: string;
  responsibleEmployeeName?: string;
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

export const useAuthorizedDrivers = (vehicleCredentialId: string) => {
  return useQuery({
    queryKey: ['authorized_drivers', vehicleCredentialId],
    queryFn: async () => {
      // 1. Fetch base rows (no joins — avoids PGRST201 ambiguity)
      const { data: rows, error } = await supabase
        .from('vehicle_authorized_drivers')
        .select('*')
        .eq('vehicle_credential_id', vehicleCredentialId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!rows || rows.length === 0) return [];

      // 2. Collect IDs for batch lookups
      const empIds = [...new Set(rows.filter(r => r.employee_credential_id).map(r => r.employee_credential_id!))];
      const assocIds = [...new Set(rows.filter(r => r.associate_id).map(r => r.associate_id!))];

      // 3. Batch fetch employees and associates in parallel
      const [empResult, assocResult] = await Promise.all([
        empIds.length > 0
          ? supabase.from('employee_credentials').select('id, full_name, document, status').in('id', empIds)
          : Promise.resolve({ data: [], error: null }),
        assocIds.length > 0
          ? supabase.from('associates').select('id, full_name, document, status, employee_credential_id').in('id', assocIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const empMap = new Map((empResult.data || []).map(e => [e.id, e]));
      const assocMap = new Map((assocResult.data || []).map(a => [a.id, a]));

      // 4. For associates, fetch responsible employee names
      const responsibleEmpIds = [...new Set(
        (assocResult.data || []).filter(a => a.employee_credential_id).map(a => a.employee_credential_id!)
      )].filter(id => !empMap.has(id)); // only fetch if not already loaded

      if (responsibleEmpIds.length > 0) {
        const { data: respEmps } = await supabase
          .from('employee_credentials')
          .select('id, full_name')
          .in('id', responsibleEmpIds);
        (respEmps || []).forEach(e => empMap.set(e.id, e));
      }

      // 5. Map to domain model
      return rows.map((row): AuthorizedDriver => {
        const emp = row.employee_credential_id ? empMap.get(row.employee_credential_id) : null;
        const assoc = row.associate_id ? assocMap.get(row.associate_id) : null;
        const responsibleEmp = assoc?.employee_credential_id ? empMap.get(assoc.employee_credential_id) : null;

        return {
          id: row.id,
          vehicleCredentialId: row.vehicle_credential_id,
          driverType: row.driver_type as DriverType,
          employeeCredentialId: row.employee_credential_id || undefined,
          associateId: row.associate_id || undefined,
          authorizationType: row.authorization_type as AuthorizationType,
          isActive: row.is_active,
          validFrom: row.valid_from || undefined,
          validUntil: row.valid_until || undefined,
          createdAt: row.created_at,
          driverName: emp?.full_name || assoc?.full_name,
          driverDocument: emp?.document || assoc?.document,
          driverStatus: emp?.status || assoc?.status,
          responsibleEmployeeName: responsibleEmp?.full_name,
        };
      });
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
