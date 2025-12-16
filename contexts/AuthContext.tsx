import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { User } from '@supabase/supabase-js';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children?: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('auth_id', userId)
        .single();

      if (data) {
        setProfile(data as UserProfile);
      } else if (error && error.code !== 'PGRST116') {
        console.warn("Erro ao buscar perfil:", error.message);
      }
    } catch (err) {
      console.error("Erro ao buscar perfil:", err);
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!isMounted) return;

        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        }
      } catch (error) {
        console.error("Erro ao iniciar sessão:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
          setInitialCheckDone(true);
        }
      }

    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth Event:", event);
      
      if (!isMounted || !initialCheckDone) return;
      
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        return;
      }
      
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      }
      
      if (event === 'TOKEN_REFRESHED' && session?.user) {
        setUser(session.user);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [initialCheckDone]); 

  const signOut = async () => {
    try {
      // Limpa os estados ANTES de chamar o signOut
      setUser(null);
      setProfile(null);
      setLoading(false);
      
      // Chama o signOut do Supabase
      await supabase.auth.signOut();
      
      // Limpa ESPECIFICAMENTE a chave do Supabase
      localStorage.removeItem('controversia-auth');
      localStorage.removeItem('supabase.auth.token');
      
      // Limpa qualquer outra coisa relacionada
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth')) {
          localStorage.removeItem(key);
        }
      });
      
      // Limpa sessionStorage também
      sessionStorage.clear();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      // Mesmo com erro, limpa os estados
      setUser(null);
      setProfile(null);
      setLoading(false);
      
      // Força limpeza do storage mesmo com erro
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        console.error('Erro ao limpar storage:', e);
      }
    }
  };

  const value = { user, profile, loading, signOut };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  return context;
};