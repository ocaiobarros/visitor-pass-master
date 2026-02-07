import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SubjectType, AccessDirection } from '@/types/visitor';

/**
 * Hook to get the last access direction for a subject.
 * Used for zero-click toggle: if last was 'in', next should be 'out' and vice versa.
 */
export const useLastAccessDirection = (subjectType: SubjectType, subjectId: string) => {
  return useQuery({
    queryKey: ['last_access_direction', subjectType, subjectId],
    queryFn: async (): Promise<AccessDirection | null> => {
      const { data, error } = await supabase
        .from('access_logs')
        .select('direction')
        .eq('subject_type', subjectType)
        .eq('subject_id', subjectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data?.direction || null;
    },
    enabled: !!subjectId,
    staleTime: 0, // Always refetch for real-time accuracy
  });
};
