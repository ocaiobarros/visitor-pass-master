import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Profile {
  id: string;
  userId: string;
  fullName: string;
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const useProfile = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        userId: data.user_id,
        fullName: data.full_name,
        mustChangePassword: data.must_change_password,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      } as Profile;
    },
    enabled: !!userId,
  });
};
