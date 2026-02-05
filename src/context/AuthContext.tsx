import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, AppRole } from '@/types/visitor';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasRole: (role: AppRole) => boolean;
  isAdminOrRh: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserProfile = async (authUser: SupabaseUser): Promise<User | null> => {
    try {
      // Buscar perfil
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();

      // Buscar roles
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authUser.id);

      const roles = (rolesData || []).map(r => r.role as AppRole);

      return {
        id: authUser.id,
        email: authUser.email || '',
        fullName: profile?.full_name || authUser.email || '',
        roles: roles.length > 0 ? roles : ['security'],
      };
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  };

  useEffect(() => {
    // Check current session
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setSupabaseUser(session.user);
        const userProfile = await fetchUserProfile(session.user);
        setUser(userProfile);
      }
      setIsLoading(false);
    };

    initAuth();

    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setSupabaseUser(session.user);
        const userProfile = await fetchUserProfile(session.user);
        setUser(userProfile);
      } else {
        setSupabaseUser(null);
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Erro ao fazer login' };
    }
  };

  const signup = async (email: string, password: string, fullName: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName }
        }
      });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Erro ao criar conta' };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSupabaseUser(null);
  };

  const hasRole = (role: AppRole): boolean => {
    return user?.roles.includes(role) || false;
  };

  const isAdminOrRh = user?.roles.some(r => r === 'admin' || r === 'rh') || false;

  return (
    <AuthContext.Provider value={{
      user,
      supabaseUser,
      login,
      signup,
      logout,
      isAuthenticated: !!user,
      isLoading,
      hasRole,
      isAdminOrRh,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
