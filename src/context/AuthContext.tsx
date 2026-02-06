import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, AppRole } from '@/types/visitor';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  session: Session | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasRole: (role: AppRole) => boolean;
  isAdminOrRh: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const prevUserIdRef = useRef<string | null>(null);
  
  // Get query client for cache invalidation
  let queryClient: ReturnType<typeof useQueryClient> | null = null;
  try {
    queryClient = useQueryClient();
  } catch {
    // QueryClient not available yet
  }

  const fetchUserProfile = useCallback(async (authUser: SupabaseUser): Promise<User | null> => {
    try {
      // Fetch profile and roles in parallel
      const [profileResult, rolesResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('user_id', authUser.id)
          .maybeSingle(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', authUser.id)
      ]);

      if (profileResult.error) {
        console.error('Error fetching profile:', profileResult.error);
      }

      if (rolesResult.error) {
        console.error('Error fetching roles:', rolesResult.error);
      }

      const profile = profileResult.data;
      const roles = (rolesResult.data || []).map(r => r.role as AppRole);

      return {
        id: authUser.id,
        email: authUser.email || '',
        fullName: profile?.full_name || authUser.user_metadata?.full_name || authUser.email || '',
        roles: roles.length > 0 ? roles : ['security'],
      };
    } catch (error) {
      console.error('Error fetching user profile:', error);
      // Fallback: não bloquear login por falha de profile/roles
      return {
        id: authUser.id,
        email: authUser.email || '',
        fullName: authUser.user_metadata?.full_name || authUser.email || '',
        roles: ['security'],
      };
    }
  }, []);

  const clearUserData = useCallback(() => {
    // Clear user-specific localStorage items
    const keysToRemove = [
      'guarda_last_scan',
      'guarda_preferences',
      // Add other user-specific keys here
    ];
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch {
        // Ignore localStorage errors
      }
    });

    // Clear React Query cache when user changes
    if (queryClient) {
      queryClient.clear();
    }
  }, [queryClient]);

  const refreshUser = useCallback(async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (currentSession?.user) {
      const userProfile = await fetchUserProfile(currentSession.user);
      setUser(userProfile);
    }
  }, [fetchUserProfile]);

  useEffect(() => {
    let isMounted = true;

    // INITIAL load - controls isLoading
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (!isMounted) return;

        if (initialSession?.user) {
          setSession(initialSession);
          setSupabaseUser(initialSession.user);
          prevUserIdRef.current = initialSession.user.id;
          
          // Fetch profile BEFORE setting loading to false
          const userProfile = await fetchUserProfile(initialSession.user);
          if (isMounted) {
            setUser(userProfile);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Set up auth state listener for ONGOING changes (does NOT control isLoading)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!isMounted) return;

        console.log('Auth state change:', event);

        // Handle session changes synchronously first
        setSession(newSession);
        setSupabaseUser(newSession?.user ?? null);

        // If user changed, clear cache and fetch new profile
        const newUserId = newSession?.user?.id ?? null;
        if (newUserId !== prevUserIdRef.current) {
          if (prevUserIdRef.current !== null) {
            // User actually changed (not just initial load)
            clearUserData();
          }
          prevUserIdRef.current = newUserId;
        }

        // Defer profile fetching to avoid deadlocks
        if (newSession?.user) {
          // Use setTimeout(0) to avoid blocking the auth state callback
          setTimeout(async () => {
            if (!isMounted) return;
            const userProfile = await fetchUserProfile(newSession.user);
            if (isMounted) {
              setUser(userProfile);
            }
          }, 0);
        } else {
          setUser(null);
        }
      }
    );

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserProfile, clearUserData]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Erro ao fazer login' };
    }
  };

  const signup = async (email: string, password: string, fullName: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { full_name: fullName }
        }
      });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (error) {
      console.error('Signup error:', error);
      return { success: false, error: 'Erro ao criar conta' };
    }
  };

  const logout = async () => {
    try {
      clearUserData();
      await supabase.auth.signOut();
      setUser(null);
      setSupabaseUser(null);
      setSession(null);
    } catch (error) {
      console.error('Logout error:', error);
      // Force clear state even if signOut fails
      setUser(null);
      setSupabaseUser(null);
      setSession(null);
    }
  };

  const hasRole = useCallback((role: AppRole): boolean => {
    return user?.roles.includes(role) || false;
  }, [user?.roles]);

  // Compute isAdminOrRh based on current user state
  const isAdminOrRh = user?.roles?.some(r => r === 'admin' || r === 'rh') || false;

  return (
    <AuthContext.Provider value={{
      user,
      supabaseUser,
      session,
      login,
      signup,
      logout,
      // Sessão é a fonte de verdade de autenticação (evita ficar preso no /login enquanto o profile carrega)
      isAuthenticated: !!session?.user,
      isLoading,
      hasRole,
      isAdminOrRh,
      refreshUser,
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
