import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Lock, AlertTriangle } from 'lucide-react';

interface ChangePasswordModalProps {
  open: boolean;
  onPasswordChanged: () => void;
  isRequired?: boolean;
}

const ChangePasswordModal = ({ open, onPasswordChanged, isRequired = false }: ChangePasswordModalProps) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Senhas não conferem',
        description: 'A nova senha e a confirmação devem ser iguais.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        throw error;
      }

      // Update profile to mark password as changed - CRITICAL: must succeed
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Retry logic for robustness
        let retryCount = 0;
        let profileError = null;
        let updateSuccess = false;
        
        while (retryCount < 5) {
          const { error, data } = await supabase
            .from('profiles')
            .update({ 
              must_change_password: false,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', user.id)
            .select()
            .maybeSingle();
          
          if (!error && data) {
            profileError = null;
            updateSuccess = true;
            console.log('[ChangePassword] Profile updated successfully, must_change_password=false');
            break;
          }
          
          profileError = error;
          retryCount++;
          console.warn(`[ChangePassword] Retry ${retryCount}/5 - Error:`, error?.message);
          await new Promise(r => setTimeout(r, 500 * retryCount)); // Exponential backoff
        }
        
        if (!updateSuccess) {
          console.error('[ChangePassword] Failed to update profile after all retries:', profileError);
          // Show warning but still proceed - password was changed
          toast({
            title: 'Aviso',
            description: 'Senha alterada, mas houve um problema. Se o modal reaparecer, contate o administrador.',
            variant: 'destructive',
          });
        }
      }

      toast({
        title: 'Senha alterada!',
        description: 'Sua nova senha foi salva com sucesso.',
      });

      // Reset form
      setNewPassword('');
      setConfirmPassword('');
      
      onPasswordChanged();
    } catch (error: any) {
      console.error('Password change error:', error);
      toast({
        title: 'Erro ao alterar senha',
        description: error.message || 'Ocorreu um erro inesperado.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => !isRequired && onPasswordChanged()}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={isRequired ? (e) => e.preventDefault() : undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isRequired && <AlertTriangle className="w-5 h-5 text-warning" />}
            Alterar Senha
          </DialogTitle>
          <DialogDescription>
            {isRequired
              ? 'Por segurança, você precisa alterar a senha padrão antes de continuar.'
              : 'Digite sua nova senha abaixo.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nova Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="new-password"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pl-10"
                required
                minLength={6}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10"
                required
                minLength={6}
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Salvando...' : 'Salvar Nova Senha'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ChangePasswordModal;
