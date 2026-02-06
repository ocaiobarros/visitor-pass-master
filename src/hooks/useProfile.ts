import { useQuery, useQueryClient } from '@tanstack/react-query';
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
    // Não usar cache agressivo para profile - importante para must_change_password
    staleTime: 0,
    gcTime: 0,
  });
};

// Hook para invalidar cache do perfil
export const useInvalidateProfile = () => {
  const queryClient = useQueryClient();
  
  return (userId: string) => {
    queryClient.invalidateQueries({ queryKey: ['profile', userId] });
  };
};
