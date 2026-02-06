import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PersonData {
  fullName: string;
  photoUrl: string | null;
  source: 'employee' | 'visitor';
}

/**
 * Hook para buscar dados de pessoa (funcionário ou visitante) pelo CPF.
 * Prioriza funcionário sobre visitante.
 */
export const usePersonByDocument = (document: string) => {
  // Normaliza o CPF removendo pontos e traços
  const normalizedDoc = document.replace(/\D/g, '');
  const isValidLength = normalizedDoc.length === 11;

  return useQuery({
    queryKey: ['person-by-document', normalizedDoc],
    queryFn: async (): Promise<PersonData | null> => {
      // Primeiro busca em employee_credentials (prioridade)
      const { data: employee, error: empError } = await supabase
        .from('employee_credentials')
        .select('full_name, photo_url')
        .eq('document', document)
        .eq('type', 'personal')
        .maybeSingle();

      if (!empError && employee) {
        return {
          fullName: employee.full_name,
          photoUrl: employee.photo_url,
          source: 'employee',
        };
      }

      // Se não encontrou, busca em visitors
      const { data: visitor, error: visError } = await supabase
        .from('visitors')
        .select('full_name, photo_url')
        .eq('document', document)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!visError && visitor) {
        return {
          fullName: visitor.full_name,
          photoUrl: visitor.photo_url,
          source: 'visitor',
        };
      }

      return null;
    },
    enabled: isValidLength,
    staleTime: 30000, // Cache por 30 segundos
  });
};
