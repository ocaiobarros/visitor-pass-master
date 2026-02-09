import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Visitor, VisitorStatus, VisitToType } from '@/types/visitor';
import { useToast } from '@/hooks/use-toast';

interface CreateVisitorData {
  fullName: string;
  document: string;
  company?: string;
  phone?: string;
  photoUrl?: string;
  visitToType: VisitToType;
  visitToName: string;
  gateObs?: string;
  companyReason: string;
  accessType: 'pedestrian' | 'driver';
  vehiclePlate?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  validFrom: Date;
  validUntil: Date;
}

const mapDbToVisitor = (row: any): Visitor => ({
  id: row.id,
  passId: row.pass_id,
  fullName: row.full_name,
  document: row.document,
  company: row.company,
  phone: row.phone,
  photoUrl: row.photo_url,
  visitToType: row.visit_to_type,
  visitToName: row.visit_to_name,
  gateObs: row.gate_obs,
  companyReason: row.company_reason || '',
  accessType: row.access_type || 'pedestrian',
  vehiclePassId: row.vehicle_pass_id,
  vehiclePlate: row.vehicle_plate,
  vehicleBrand: row.vehicle_brand,
  vehicleModel: row.vehicle_model,
  vehicleColor: row.vehicle_color,
  validFrom: new Date(row.valid_from),
  validUntil: new Date(row.valid_until),
  status: row.status,
  createdBy: row.created_by,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
});

export const useVisitors = () => {
  return useQuery({
    queryKey: ['visitors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visitors')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(mapDbToVisitor);
    },
  });
};

export const useVisitor = (id: string) => {
  return useQuery({
    queryKey: ['visitor', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visitors')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) return null;
      return mapDbToVisitor(data);
    },
    enabled: !!id,
  });
};

export const useVisitorByPassId = (passId: string) => {
  return useQuery({
    queryKey: ['visitor', 'passId', passId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visitors')
        .select('*')
        .eq('pass_id', passId)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) return null;
      return mapDbToVisitor(data);
    },
    enabled: !!passId && passId.startsWith('VP-'),
  });
};

export const useCreateVisitor = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateVisitorData) => {
      const { data: user } = await supabase.auth.getUser();
      
      // Generate a temporary pass_id - the trigger will replace it
      const tempPassId = 'VP-' + Math.random().toString(36).substring(2, 10).toUpperCase();
      
      const { data: visitor, error } = await supabase
        .from('visitors')
        .insert({
          pass_id: tempPassId,
          full_name: data.fullName,
          document: data.document,
          company: data.company || null,
          phone: data.phone || null,
          photo_url: data.photoUrl || null,
          visit_to_type: data.visitToType,
          visit_to_name: data.visitToName,
          gate_obs: data.gateObs || null,
          company_reason: data.companyReason,
          access_type: data.accessType,
          vehicle_plate: data.vehiclePlate || null,
          vehicle_brand: data.vehicleBrand || null,
          vehicle_model: data.vehicleModel || null,
          vehicle_color: data.vehicleColor || null,
          valid_from: data.validFrom.toISOString(),
          valid_until: data.validUntil.toISOString(),
          created_by: user.user?.id || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return mapDbToVisitor(visitor);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitors'] });
      toast({
        title: 'Visitante registrado!',
        description: 'O passe foi criado com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao registrar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateVisitorStatus = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: VisitorStatus }) => {
      const { data, error } = await supabase
        .from('visitors')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return mapDbToVisitor(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitors'] });
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
