import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Mail, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import { useProfile } from '@/hooks/useProfile';
import BrandLogo from '@/components/BrandLogo';
import { branding, getPageTitle } from '@/config/branding';
import { logAuditAction } from '@/hooks/useAuditLogs';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const { login, isAuthenticated, supabaseUser, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check if user needs to change password
  const { data: profile, isLoading: profileLoading } = useProfile(supabaseUser?.id);

  // Set page title
  useEffect(() => {
    document.title = getPageTitle('Login');
  }, []);

  useEffect(() => {
    // Only process redirect after auth and profile are both loaded
    if (authLoading || profileLoading) return;
    
    if (isAuthenticated && profile) {
      if (profile.mustChangePassword) {
        setShowPasswordModal(true);
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, profile, navigate, authLoading, profileLoading]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha email e senha.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(email, password);
      
      if (result.success) {
        // Log successful login
        await logAuditAction('LOGIN', { email });
        
        toast({
          title: 'Login realizado com sucesso!',
          description: `Bem-vindo ao ${branding.name}.`,
        });
        // Navigation will be handled by useEffect after profile loads
      } else {
        // Log failed login attempt
        await logAuditAction('LOGIN_FAILED', { email, reason: result.error });
        
        toast({
          title: 'Erro no login',
          description: result.error || 'Verifique suas credenciais.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: 'Erro no login',
        description: 'Ocorreu um erro inesperado. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChanged = async () => {
    await logAuditAction('PASSWORD_CHANGE', { first_login: true });
    setShowPasswordModal(false);
    
    // Force full page reload to clear all React Query cache and re-fetch profile
    // This ensures must_change_password = false is picked up from DB
    // Using window.location.href forces a complete state reset
    setTimeout(() => {
      window.location.href = '/dashboard';
    }, 500); // Small delay to ensure DB update propagated
  };

  // Show loading while auth is initializing
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="mt-2 text-muted-foreground">Verificando sessão...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-background p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo & Header */}
        <div className="text-center flex flex-col items-center">
          <BrandLogo 
            size="lg" 
            showName={false}
            iconClassName="rounded-2xl mb-6"
          />
          <h1 className="text-3xl font-bold text-foreground">{branding.name}</h1>
          <p className="text-muted-foreground mt-2">{branding.tagline}</p>
        </div>

        {/* Login Card */}
        <Card className="shadow-lg border-border/50">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Entrar</CardTitle>
            <CardDescription className="text-center">
              Use suas credenciais para acessar o sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>

            <p className="text-xs text-center text-muted-foreground mt-6">
              Usuários são gerenciados pelo administrador do sistema.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Password Change Modal */}
      <ChangePasswordModal
        open={showPasswordModal}
        onPasswordChanged={handlePasswordChanged}
        isRequired={true}
      />
    </div>
  );
};

export default Login;
