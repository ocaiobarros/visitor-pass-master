import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';
import { AppRole } from '@/types/visitor';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: AppRole[];
  redirectTo?: string;
}

/**
 * ProtectedRoute - Verifica autenticação REAL via useAuth
 * 
 * - Se está carregando: mostra spinner
 * - Se não autenticado: redireciona para /login
 * - Se autenticado mas sem role necessária: redireciona para dashboard
 * - Se autenticado e com role: renderiza children
 */
const ProtectedRoute = ({ 
  children, 
  requiredRoles,
  redirectTo = '/login' 
}: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, user, hasRole } = useAuth();
  const location = useLocation();

  // Estado de loading - mostra spinner centralizado
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  // Não autenticado - redireciona para login preservando a rota original
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Se há roles requeridas, verifica se o usuário tem alguma delas
  if (requiredRoles && requiredRoles.length > 0) {
    const hasRequiredRole = requiredRoles.some(role => hasRole(role));
    
    if (!hasRequiredRole) {
      // Usuário autenticado mas sem permissão - volta pro dashboard
      return <Navigate to="/dashboard" replace />;
    }
  }

  // Tudo OK - renderiza o conteúdo
  return <>{children}</>;
};

export default ProtectedRoute;
