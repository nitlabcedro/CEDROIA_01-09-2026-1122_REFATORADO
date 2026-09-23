import { supabase } from "@/servicos/supabase";

const MARGEM_EXPIRACAO_SEG = 60;
const BLOQUEIO_APOS_401_MS = 60_000;

let bloqueioWorkflowApiAte = 0;

interface SessaoAutenticacaoApi {
  access_token?: string | null;
  expires_at?: number | null;
}

interface ClienteAutenticacaoApi {
  getSession: () => Promise<{
    data: { session: SessaoAutenticacaoApi | null };
    error: unknown;
  }>;
  refreshSession: () => Promise<{
    data: { session: SessaoAutenticacaoApi | null };
    error: unknown;
  }>;
}

export function workflowApiBloqueadaPorAutenticacao(): boolean {
  return Date.now() < bloqueioWorkflowApiAte;
}

export function registrarFalhaAutenticacaoApi(): void {
  bloqueioWorkflowApiAte = Date.now() + BLOQUEIO_APOS_401_MS;
}

export function liberarBloqueioAutenticacaoApi(): void {
  bloqueioWorkflowApiAte = 0;
}

export function sessaoPrecisaRenovarToken(
  expiresAtSegundos: number | null | undefined,
  agoraSegundos = Math.floor(Date.now() / 1000),
): boolean {
  if (!expiresAtSegundos) return false;
  return expiresAtSegundos <= agoraSegundos + MARGEM_EXPIRACAO_SEG;
}

function tokenLocalAindaValido(
  sessao: SessaoAutenticacaoApi | null,
  agoraSegundos = Math.floor(Date.now() / 1000),
): string | null {
  if (!sessao?.access_token) return null;
  if (sessao.expires_at && sessao.expires_at <= agoraSegundos) return null;
  return sessao.access_token;
}

export function criarObterAccessTokenParaApi(auth: ClienteAutenticacaoApi) {
  let refreshEmAndamento: Promise<string | null> | null = null;

  const renovarTokenSingleFlight = (
    sessaoAnterior: SessaoAutenticacaoApi,
  ): Promise<string | null> => {
    if (refreshEmAndamento) return refreshEmAndamento;

    const refreshAtual = (async () => {
      try {
        const { data, error } = await auth.refreshSession();
        if (!error && data.session?.access_token) {
          liberarBloqueioAutenticacaoApi();
          return data.session.access_token;
        }

        // O autoRefreshToken do SDK pode ter concluído enquanto o refresh manual
        // falhava. Releia a sessão antes de considerar que não existe token útil.
        const { data: atual } = await auth.getSession();
        return tokenLocalAindaValido(atual.session)
          ?? tokenLocalAindaValido(sessaoAnterior);
      } catch {
        // Erros de rede não encerram uma sessão local que ainda é utilizável.
        return tokenLocalAindaValido(sessaoAnterior);
      }
    })();

    refreshEmAndamento = refreshAtual;
    return refreshAtual.finally(() => {
      if (refreshEmAndamento === refreshAtual) refreshEmAndamento = null;
    });
  };

  return async function obterToken(
    opcoes: { forcarRenovacao?: boolean } = {},
  ): Promise<string | null> {
    let resultadoSessao: Awaited<ReturnType<ClienteAutenticacaoApi["getSession"]>>;
    try {
      resultadoSessao = await auth.getSession();
    } catch {
      return null;
    }

    const session = resultadoSessao.data.session;
    if (!session?.access_token) return null;

    if (
      opcoes.forcarRenovacao
      || sessaoPrecisaRenovarToken(session.expires_at)
    ) {
      return renovarTokenSingleFlight(session);
    }

    liberarBloqueioAutenticacaoApi();
    return session.access_token;
  };
}

export const obterAccessTokenParaApi = criarObterAccessTokenParaApi(supabase.auth);
