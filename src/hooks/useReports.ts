import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useReport = (rpcName: string, params: Record<string, any>, enabled = true) => {
  return useQuery({
    queryKey: ['report', rpcName, params],
    queryFn: async () => {
      const cleanParams: Record<string, any> = {};
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== '' && v !== 'all') {
          cleanParams[k] = v;
        }
      }
      const { data, error } = await supabase.rpc(rpcName as any, cleanParams);
      if (error) throw error;
      return data;
    },
    enabled,
  });
};
