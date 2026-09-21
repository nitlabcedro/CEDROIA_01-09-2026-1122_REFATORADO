import { TABELAS_SUPABASE } from "@/constantes/supabase";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { liberarBloqueioAutenticacaoApi } from "@/servicos/autenticacao-api";
import { supabase } from "@/servicos/supabase";
import { UserProfile } from "@/tipos";
import { invalidarSessaoNavegacao } from "@/utilitarios/historico-navegacao";
import {
  DURACAO_PADRAO_RECUPERACAO_MS,
  aplicarEventoAutenticacao,
  ativarRecuperacaoSenha,
  concluirRedefinicaoSenha,
  lerRecuperacaoSenha,
  limparRecuperacaoSenha,
  obterRecuperacaoDoEventoStorage,
} from "@/utilitarios/recuperacao-senha";

interface OpcoesSignOut {
  somenteLocal?: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  recuperacaoSenhaEmAndamento: boolean;
  signOut: (opcoes?: OpcoesSignOut) => Promise<void>;
  finalizarRecuperacaoSenha: (novaSenha: string) => Promise<void>;
  refreshProfile: (updatedFields?: Partial<UserProfile>, skipFetch?: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{children: React.ReactNode;}> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [recuperacaoSenhaEmAndamento, setRecuperacaoSenhaEmAndamento] = useState(
    () => lerRecuperacaoSenha() === "ativa",
  );
  const recuperacaoSenhaRef = useRef(recuperacaoSenhaEmAndamento);
  const profileRequestRef = useRef<{ userId: string; promise: Promise<void> } | null>(null);
  const lastProfileFetchRef = useRef<{ userId: string; at: number } | null>(null);

  const atualizarRecuperacaoSenha = (ativa: boolean) => {
    recuperacaoSenhaRef.current = ativa;
    setRecuperacaoSenhaEmAndamento(ativa);
    if (ativa) setProfile(null);
  };

  const limparTokensSupabaseLocais = () => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("sb-") || key.includes("supabase.auth") || key.includes("-auth-token"))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => {
        try {
          localStorage.removeItem(key);
        } catch {
          // A limpeza dos demais estados ainda deve continuar.
        }
      });
    } catch (error) {
      console.error("Erro ao limpar armazenamento local da sessão:", error);
    }
  };

  const limparEstadoAutenticacao = () => {
    invalidarSessaoNavegacao();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

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

        if (data && !recuperacaoSenhaRef.current) {
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
        } else if (!recuperacaoSenhaRef.current) {
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
          invalidarSessaoNavegacao();
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }
      }

      const session = data?.session ?? null;
      const estadoRecuperacao = lerRecuperacaoSenha();

      if (estadoRecuperacao === "obsoleta") {
        limparRecuperacaoSenha();
        atualizarRecuperacaoSenha(false);
        if (session) {
          supabase.auth.signOut({ scope: "local" }).catch((signOutError) => {
            console.error("Erro ao encerrar recuperação obsoleta:", signOutError);
          });
          limparTokensSupabaseLocais();
        }
        limparEstadoAutenticacao();
      } else if (estadoRecuperacao === "ativa" && session?.user) {
        const duracaoSessao = session.expires_at
          ? Math.max(1_000, session.expires_at * 1000 - Date.now())
          : DURACAO_PADRAO_RECUPERACAO_MS;
        ativarRecuperacaoSenha(localStorage, duracaoSessao);
        atualizarRecuperacaoSenha(true);
        setSession(session);
        setUser(session.user);
        setProfile(null);
      } else if (estadoRecuperacao === "ativa") {
        limparRecuperacaoSenha();
        // Mantém esta aba bloqueada no fluxo de recovery para que a tela
        // apresente o link inválido. O retorno explícito ao Login encerra o modo.
        atualizarRecuperacaoSenha(true);
        limparEstadoAutenticacao();
      } else {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          invalidarSessaoNavegacao();
        }
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
      invalidarSessaoNavegacao();
      setSession(null);
      setUser(null);
      setLoading(false);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        liberarBloqueioAutenticacaoApi();
      }
      const recuperacaoAtualizada = aplicarEventoAutenticacao(
        event,
        recuperacaoSenhaRef.current,
      );
      if (event === "PASSWORD_RECOVERY") {
        const duracaoSessao = session?.expires_at
          ? Math.max(1_000, session.expires_at * 1000 - Date.now())
          : DURACAO_PADRAO_RECUPERACAO_MS;
        ativarRecuperacaoSenha(localStorage, duracaoSessao);
      } else if (event === "SIGNED_OUT") {
        limparRecuperacaoSenha();
      }
      atualizarRecuperacaoSenha(recuperacaoAtualizada);
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user && !recuperacaoAtualizada) {
        if (event !== "TOKEN_REFRESHED") fetchProfile(session.user.id);
      } else {
        invalidarSessaoNavegacao();
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const sincronizarRecuperacao = (evento: StorageEvent) => {
      const recuperacaoRecebida = obterRecuperacaoDoEventoStorage(evento);
      if (recuperacaoRecebida === null) return;

      atualizarRecuperacaoSenha(recuperacaoRecebida);
      if (!recuperacaoRecebida) {
        limparEstadoAutenticacao();
      }
    };

    window.addEventListener("storage", sincronizarRecuperacao);
    return () => window.removeEventListener("storage", sincronizarRecuperacao);
  }, []);

  const signOut = async (opcoes: OpcoesSignOut = {}) => {
    // Invalida antes da chamada remota para que nenhum popstate concorrente
    // considere válidas as entradas privadas da sessão que está terminando.
    invalidarSessaoNavegacao();
    try {
      await supabase.auth.signOut({
        scope: opcoes.somenteLocal ? "local" : "global",
      });
    } catch (err) {
      console.error("Erro ao sair:", err);
    } finally {
      limparTokensSupabaseLocais();
      limparRecuperacaoSenha();
      atualizarRecuperacaoSenha(false);
      limparEstadoAutenticacao();
    }
  };

  const finalizarRecuperacaoSenha = async (novaSenha: string) => {
    await concluirRedefinicaoSenha({
      novaSenha,
      updateUser: (atributos) => supabase.auth.updateUser(atributos),
      signOut: (opcoes) => supabase.auth.signOut(opcoes),
      limparEstadoLocal: () => {
        limparTokensSupabaseLocais();
        atualizarRecuperacaoSenha(false);
        limparEstadoAutenticacao();
      },
    });
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
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      loading,
      recuperacaoSenhaEmAndamento,
      signOut,
      finalizarRecuperacaoSenha,
      refreshProfile,
    }}>
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
