import { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface ConnectionErrorBoundaryProps {
  children: React.ReactNode;
}

const ConnectionErrorBoundary = ({ children }: ConnectionErrorBoundaryProps) => {
  const [isOffline, setIsOffline] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const checkConnection = async () => {
    setIsChecking(true);
    try {
      // Simple health check - try to fetch from Supabase
      const { error } = await supabase.from('departments').select('id').limit(1);
      
      if (error && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
        setIsOffline(true);
      } else {
        setIsOffline(false);
      }
    } catch (err) {
      setIsOffline(true);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // Check connection on mount
    checkConnection();

    // Listen to online/offline events
    const handleOnline = () => {
      checkConnection();
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic check every 30 seconds
    const interval = setInterval(checkConnection, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  if (isOffline) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-destructive/10 flex items-center justify-center">
            <WifiOff className="w-12 h-12 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Servidor Local Offline
          </h1>
          <p className="text-muted-foreground mb-6">
            Não foi possível conectar ao servidor de banco de dados. 
            Verifique se o servidor PostgreSQL está em execução e acessível na rede.
          </p>
          <div className="space-y-3">
            <Button 
              onClick={checkConnection} 
              disabled={isChecking}
              className="w-full"
            >
              {isChecking ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Tentar Novamente
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              💡 Dica: Verifique a conexão de rede e se o serviço PostgreSQL está ativo.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ConnectionErrorBoundary;
