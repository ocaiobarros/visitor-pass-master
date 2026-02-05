import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Department } from '@/types/visitor';

export const useDepartments = () => {
  return useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return (data || []).map((row): Department => ({
        id: row.id,
        name: row.name,
      }));
    },
  });
};
