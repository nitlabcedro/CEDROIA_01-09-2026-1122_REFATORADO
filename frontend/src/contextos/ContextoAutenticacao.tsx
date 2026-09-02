import { TABELAS_SUPABASE } from "@/constantes/supabase";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/servicos/supabase";
import { UserProfile } from "@/tipos";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: (updatedFields?: Partial<UserProfile>, skipFetch?: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{children: React.ReactNode;}> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const profileRequestRef = useRef<{ userId: string; promise: Promise<void> } | null>(null);
  const lastProfileFetchRef = useRef<{ userId: string; at: number } | null>(null);

  const fetchProfile = async (userId: string) => {
    if (profileRequestRef.current?.userId === userId) {
      return profileRequestRef.current.promise;
    }
    if (lastProfileFetchRef.current?.userId === userId && Date.now() - lastProfileFetchRef.current.at < 2000) {
      return;
    }

    const promise = (async () => {
      try {
        const { data, error } = await supabase.
        from(TABELAS_SUPABASE.PERFIS).
        select("*").
        eq("id", userId).
        single();

        if (error && error.code !== "PGRST116") {
          console.error("Erro ao buscar perfil:", error);
        }

        if (data) {
          setProfile((prev) => {
            if (!prev) return data;
            // Mantém o preview de blob local temporário se ele estiver ativo
            const keepBlob = prev.avatar_url?.startsWith("blob:") ? prev.avatar_url : null;
            return {
              ...prev,
              ...data,
              avatar_url: keepBlob || data.avatar_url
            };
          });
        } else {
          setProfile(null);
        }
        lastProfileFetchRef.current = { userId, at: Date.now() };
      } catch (err) {
        console.error("Erro inesperado ao buscar perfil:", err);
      } finally {
        if (profileRequestRef.current?.promise === promise) {
          profileRequestRef.current = null;
        }
      }
    })();

    profileRequestRef.current = { userId, promise };
    return promise;
  };

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Erro na sessão inicial:", error);
        // Se o erro for de token inválido/expirado, limpamos os tokens locais e forçamos logout
        const errMsg = String(error.message || "").toLowerCase();
        if (
        errMsg.includes("refresh token") ||
        errMsg.includes("not found") ||
        error.status === 400 ||
        error.status === 401)
        {
          try {
            // Limpa chaves do Supabase no localStorage para evitar loop infinito
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && (key.startsWith("sb-") || key.includes("supabase.auth") || key.includes("-auth-token"))) {
                keysToRemove.push(key);
              }
            }
            keysToRemove.forEach((k) => {
              try {
                localStorage.removeItem(k);
              } catch (e) {}
            });
          } catch (e) {
            console.error("Erro ao limpar localStorage:", e);
          }
          supabase.auth.signOut().catch(() => {});
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }
      }

      const session = data?.session ?? null;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    }).catch((err) => {
      console.error("Erro fatal ao carregar getSession:", err);
      // Fallback em caso de erro de Refresh Token ou similar na Promise rejeitada
      const errMsg = String(err?.message || err || "").toLowerCase();
      if (errMsg.includes("refresh token") || errMsg.includes("not found")) {
        try {
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith("sb-") || key.includes("supabase.auth") || key.includes("-auth-token"))) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach((k) => {
            try {
              localStorage.removeItem(k);
            } catch (e) {}
          });
        } catch (e) {}
      }
      setSession(null);
      setUser(null);
      setLoading(false);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        if (event !== "TOKEN_REFRESHED") fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Erro ao sair:", err);
    } finally {
      try {
        // Limpa todas as chaves do Supabase no localStorage para garantir logout completo
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith("sb-") || key.includes("supabase.auth") || key.includes("-auth-token"))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => {
          try {
            localStorage.removeItem(k);
          } catch (e) {}
        });
      } catch (e) {
        console.error("Erro ao limpar localStorage no signOut:", e);
      }
      setUser(null);
      setSession(null);
      setProfile(null);
    }
  };

  const refreshProfile = async (updatedFields?: Partial<UserProfile>, skipFetch?: boolean, explicitUserId?: string) => {
    if (updatedFields) {
      setProfile((prev) => {
        if (!prev) return updatedFields as UserProfile;
        return { ...prev, ...updatedFields };
      });
    }
    const targetUserId = explicitUserId || user?.id;
    if (targetUserId && !skipFetch) await fetchProfile(targetUserId);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>);

};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
};
