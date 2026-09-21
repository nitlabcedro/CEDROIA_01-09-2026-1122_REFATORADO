import { supabase } from "@/servicos/supabase";

const MARGEM_EXPIRACAO_SEG = 60;
const BLOQUEIO_APOS_401_MS = 60_000;

let bloqueioWorkflowApiAte = 0;

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
  if (!expiresAtSegundos) return true;
  return expiresAtSegundos <= agoraSegundos + MARGEM_EXPIRACAO_SEG;
}

export async function obterAccessTokenParaApi(
  opcoes: { forcarRenovacao?: boolean } = {},
): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  const precisaRenovar = opcoes.forcarRenovacao
    || sessaoPrecisaRenovarToken(session.expires_at);

  if (precisaRenovar) {
    const { data: renovado, error } = await supabase.auth.refreshSession();
    if (!error && renovado.session?.access_token) {
      liberarBloqueioAutenticacaoApi();
      return renovado.session.access_token;
    }
  }

  const { data: validacao, error: erroValidacao } = await supabase.auth.getUser();
  if (erroValidacao || !validacao.user) {
    const { data: renovado, error } = await supabase.auth.refreshSession();
    if (!error && renovado.session?.access_token) {
      liberarBloqueioAutenticacaoApi();
      return renovado.session.access_token;
    }
    return null;
  }

  liberarBloqueioAutenticacaoApi();
  return session.access_token;
}
