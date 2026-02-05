import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { 
  Shield, 
  Database, 
  UserPlus, 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Lock,
  Mail
} from 'lucide-react';
import { cn } from '@/lib/utils';

type WizardStep = 1 | 2 | 3;

interface SetupConfig {
  supabaseUrl: string;
  supabaseKey: string;
  adminEmail: string;
  adminPassword: string;
}

// Check if system is already configured
export const isSystemConfigured = (): boolean => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const setupComplete = localStorage.getItem('guarda_setup_complete');
  
  // If env vars are set and setup is marked complete, system is configured
  return !!(url && key && setupComplete === 'true');
};

// Check if env vars exist (for redirection logic)
export const hasEnvVars = (): boolean => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return !!(url && key);
};

const InstallWizard = () => {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionTested, setConnectionTested] = useState(false);
  const [adminCreated, setAdminCreated] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const [config, setConfig] = useState<SetupConfig>({
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
    supabaseKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
    adminEmail: 'admin@sistema.local',
    adminPassword: '',
  });

  // If already configured, redirect to login
  useEffect(() => {
    if (isSystemConfigured()) {
      navigate('/login');
    }
  }, [navigate]);

  const steps = [
    { number: 1, title: 'Conexão', icon: Database },
    { number: 2, title: 'Super Admin', icon: UserPlus },
    { number: 3, title: 'Finalização', icon: CheckCircle },
  ];

  const testConnection = async () => {
    if (!config.supabaseUrl || !config.supabaseKey) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha a URL e a Chave Anon.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const testClient = createClient(config.supabaseUrl, config.supabaseKey);
      
      // Try a simple query to test connection
      const { error } = await testClient.from('departments').select('id').limit(1);
      
      if (error && !error.message.includes('does not exist')) {
        throw error;
      }
      
      setConnectionTested(true);
      toast({
        title: 'Conexão bem-sucedida!',
        description: 'O servidor está acessível e respondendo.',
      });
    } catch (error: any) {
      toast({
        title: 'Falha na conexão',
        description: error.message || 'Verifique a URL e a chave.',
        variant: 'destructive',
      });
      setConnectionTested(false);
    } finally {
      setIsLoading(false);
    }
  };

  const createAdmin = async () => {
    if (!config.adminPassword || config.adminPassword.length < 6) {
      toast({
        title: 'Senha inválida',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient(config.supabaseUrl, config.supabaseKey);
      
      const { error } = await supabase.auth.signUp({
        email: config.adminEmail,
        password: config.adminPassword,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: 'Administrador' }
        }
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast({
            title: 'Admin já existe',
            description: 'O usuário admin@sistema.local já foi criado anteriormente.',
          });
          setAdminCreated(true);
        } else {
          throw error;
        }
      } else {
        setAdminCreated(true);
        toast({
          title: 'Super Admin criado!',
          description: 'A conta de administrador foi configurada com sucesso.',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao criar admin',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const finishSetup = () => {
    // Mark setup as complete
    localStorage.setItem('guarda_setup_complete', 'true');
    localStorage.setItem('guarda_supabase_url', config.supabaseUrl);
    localStorage.setItem('guarda_supabase_key', config.supabaseKey);
    
    toast({
      title: 'Configuração concluída!',
      description: 'O sistema está pronto para uso.',
    });
    
    navigate('/login');
  };

  const canProceed = (step: WizardStep): boolean => {
    switch (step) {
      case 1:
        return connectionTested;
      case 2:
        return adminCreated;
      case 3:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-background p-4">
      <div className="w-full max-w-xl space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
            <Shield className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">GUARDA OPERACIONAL</h1>
          <p className="text-muted-foreground mt-1">Assistente de Configuração Inicial</p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-center">
          <div className="flex items-center gap-2">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.number;
              const isComplete = currentStep > step.number;
              
              return (
                <div key={step.number} className="flex items-center">
                  <div
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
                      isActive && 'bg-primary text-primary-foreground',
                      isComplete && 'bg-success/20 text-success',
                      !isActive && !isComplete && 'bg-muted text-muted-foreground'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium hidden sm:inline">{step.title}</span>
                  </div>
                  {index < steps.length - 1 && (
                    <ArrowRight className="w-4 h-4 mx-2 text-muted-foreground" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <Card className="shadow-lg border-border/50">
          {/* Step 1: Database Connection */}
          {currentStep === 1 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-primary" />
                  Conexão com o Banco de Dados
                </CardTitle>
                <CardDescription>
                  Configure a conexão com seu servidor Supabase/PostgreSQL local
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="supabase-url">URL do Servidor Supabase</Label>
                  <Input
                    id="supabase-url"
                    placeholder="http://192.168.1.100:8000"
                    value={config.supabaseUrl}
                    onChange={(e) => {
                      setConfig({ ...config, supabaseUrl: e.target.value });
                      setConnectionTested(false);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ex: http://192.168.1.100:8000 ou https://seu-servidor.local
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supabase-key">Chave Anon Pública</Label>
                  <Input
                    id="supabase-key"
                    placeholder="eyJhbGciOiJIUzI1NiIs..."
                    value={config.supabaseKey}
                    onChange={(e) => {
                      setConfig({ ...config, supabaseKey: e.target.value });
                      setConnectionTested(false);
                    }}
                  />
                </div>

                <Button 
                  onClick={testConnection} 
                  disabled={isLoading}
                  variant={connectionTested ? 'outline' : 'default'}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Testando...
                    </>
                  ) : connectionTested ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2 text-success" />
                      Conexão Verificada
                    </>
                  ) : (
                    'Testar Conexão'
                  )}
                </Button>

                {!connectionTested && config.supabaseUrl && (
                  <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                    <p className="text-sm text-warning flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Teste a conexão antes de prosseguir
                    </p>
                  </div>
                )}
              </CardContent>
            </>
          )}

          {/* Step 2: Create Super Admin */}
          {currentStep === 2 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-primary" />
                  Criar Conta Super Admin
                </CardTitle>
                <CardDescription>
                  Configure a senha do administrador principal do sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-email">Email do Administrador</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="admin-email"
                      value={config.adminEmail}
                      disabled
                      className="pl-10 bg-muted"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Email fixo para o administrador principal
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin-password">Senha do Administrador</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="admin-password"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={config.adminPassword}
                      onChange={(e) => setConfig({ ...config, adminPassword: e.target.value })}
                      className="pl-10"
                      disabled={adminCreated}
                    />
                  </div>
                </div>

                <Button 
                  onClick={createAdmin} 
                  disabled={isLoading || adminCreated}
                  variant={adminCreated ? 'outline' : 'default'}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : adminCreated ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2 text-success" />
                      Admin Criado
                    </>
                  ) : (
                    'Criar Conta Admin'
                  )}
                </Button>

                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-xs text-muted-foreground">
                    ⚠️ Guarde esta senha! Você precisará dela para o primeiro acesso ao sistema.
                  </p>
                </div>
              </CardContent>
            </>
          )}

          {/* Step 3: Finalization */}
          {currentStep === 3 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-success" />
                  Configuração Concluída!
                </CardTitle>
                <CardDescription>
                  O sistema GUARDA OPERACIONAL está pronto para uso
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-6 rounded-lg bg-success/10 border border-success/20 text-center">
                  <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-foreground mb-2">
                    Tudo pronto!
                  </h3>
                  <p className="text-muted-foreground">
                    A instalação foi concluída com sucesso. Você será redirecionado para a tela de login.
                  </p>
                </div>

                <div className="space-y-2 text-sm">
                  <p className="font-medium">Resumo da configuração:</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>✓ Conexão com o banco de dados configurada</li>
                    <li>✓ Conta Super Admin criada ({config.adminEmail})</li>
                    <li>✓ Sistema pronto para uso</li>
                  </ul>
                </div>

                <Button onClick={finishSetup} className="w-full" size="lg">
                  Ir para o Login
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </>
          )}

          {/* Footer Navigation */}
          <CardFooter className="flex justify-between">
            <Button
              variant="ghost"
              onClick={() => setCurrentStep((prev) => (prev - 1) as WizardStep)}
              disabled={currentStep === 1}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>

            {currentStep < 3 && (
              <Button
                onClick={() => setCurrentStep((prev) => (prev + 1) as WizardStep)}
                disabled={!canProceed(currentStep)}
              >
                Próximo
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </CardFooter>
        </Card>

        <p className="text-xs text-center text-muted-foreground">
          GUARDA OPERACIONAL v1.0 - Self-Hosted Edition
        </p>
      </div>
    </div>
  );
};

export default InstallWizard;
