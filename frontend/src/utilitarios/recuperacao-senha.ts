import type { AuthChangeEvent } from "@supabase/supabase-js";

import { interpretarUrlNavegacao } from "./navegacao";

export const CHAVE_RECUPERACAO_SENHA = "cedro_password_recovery";
export const DURACAO_PADRAO_RECUPERACAO_MS = 60 * 60 * 1000;

type ArmazenamentoRecuperacao = Pick<Storage, "getItem" | "setItem" | "removeItem">;

interface MarcadorRecuperacaoSenha {
  v: 1;
  expiraEm: number;
}

export type EstadoMarcadorRecuperacao = "ativa" | "ausente" | "obsoleta";

export type TelaAplicacao =
  | "carregando"
  | "login"
  | "redefinir-senha"
  | "redefinir-senha-invalida"
  | "privada";

export type EventoMensagemTransitoriaLogin =
  | { tipo: "redefinicao-concluida"; mensagem: string }
  | { tipo: "login-normal-concluido" }
  | { tipo: "logout" };

function interpretarMarcador(
  valor: string | null,
  agora: number,
): EstadoMarcadorRecuperacao {
  if (!valor) return "ausente";

  try {
    const marcador = JSON.parse(valor) as Partial<MarcadorRecuperacaoSenha>;
    if (
      marcador.v !== 1
      || typeof marcador.expiraEm !== "number"
      || !Number.isFinite(marcador.expiraEm)
    ) {
      return "obsoleta";
    }
    return marcador.expiraEm > agora ? "ativa" : "obsoleta";
  } catch {
    return "obsoleta";
  }
}

export function ativarRecuperacaoSenha(
  armazenamento: ArmazenamentoRecuperacao = window.localStorage,
  duracaoMs = DURACAO_PADRAO_RECUPERACAO_MS,
  agora = Date.now(),
): void {
  const duracaoSegura = Math.max(1_000, Math.min(duracaoMs, 24 * 60 * 60 * 1000));
  const marcador: MarcadorRecuperacaoSenha = {
    v: 1,
    expiraEm: agora + duracaoSegura,
  };
  armazenamento.setItem(CHAVE_RECUPERACAO_SENHA, JSON.stringify(marcador));
}

export function urlIndicaRecuperacaoSenha(href: string): boolean {
  return /(?:[?#&])type=recovery(?:&|$)/i.test(href);
}

export function inicializarRecuperacaoSenhaDaUrl(
  href: string,
  armazenamento: ArmazenamentoRecuperacao = window.localStorage,
  agora = Date.now(),
): boolean {
  if (!urlIndicaRecuperacaoSenha(href)) return false;
  if (lerRecuperacaoSenha(armazenamento, agora) !== "ativa") {
    ativarRecuperacaoSenha(
      armazenamento,
      DURACAO_PADRAO_RECUPERACAO_MS,
      agora,
    );
  }
  return true;
}

export function limparRecuperacaoSenha(
  armazenamento: ArmazenamentoRecuperacao = window.localStorage,
): void {
  armazenamento.removeItem(CHAVE_RECUPERACAO_SENHA);
}

export function lerRecuperacaoSenha(
  armazenamento: ArmazenamentoRecuperacao = window.localStorage,
  agora = Date.now(),
): EstadoMarcadorRecuperacao {
  return interpretarMarcador(
    armazenamento.getItem(CHAVE_RECUPERACAO_SENHA),
    agora,
  );
}

export function obterRecuperacaoDoEventoStorage(
  evento: Pick<StorageEvent, "key" | "newValue">,
  agora = Date.now(),
): boolean | null {
  if (evento.key !== CHAVE_RECUPERACAO_SENHA) return null;
  return interpretarMarcador(evento.newValue, agora) === "ativa";
}

export function aplicarEventoAutenticacao(
  evento: AuthChangeEvent,
  recuperacaoAtual: boolean,
): boolean {
  if (evento === "PASSWORD_RECOVERY") return true;
  if (evento === "SIGNED_OUT") return false;
  return recuperacaoAtual;
}

export function decidirTelaAplicacao(opcoes: {
  carregando: boolean;
  temUsuario: boolean;
  recuperacaoAtiva: boolean;
  pathname: string;
}): TelaAplicacao {
  if (opcoes.carregando) return "carregando";

  const rotaReset = interpretarUrlNavegacao(opcoes.pathname).tipo === "reset-password";
  if (opcoes.recuperacaoAtiva) return "redefinir-senha";
  if (rotaReset) {
    return opcoes.temUsuario ? "redefinir-senha-invalida" : "redefinir-senha-invalida";
  }
  return opcoes.temUsuario ? "privada" : "login";
}

export function atualizarMensagemTransitoriaLogin(
  mensagemAtual: string | null,
  evento: EventoMensagemTransitoriaLogin,
): string | null {
  if (evento.tipo === "redefinicao-concluida") return evento.mensagem;
  if (evento.tipo === "login-normal-concluido") return null;
  return mensagemAtual;
}

export async function concluirRedefinicaoSenha(opcoes: {
  novaSenha: string;
  updateUser: (
    atributos: { password: string },
  ) => Promise<{ error: unknown | null }>;
  signOut: (
    opcoes: { scope: "local" },
  ) => Promise<{ error: unknown | null }>;
  limparEstadoLocal: () => void;
  armazenamento?: ArmazenamentoRecuperacao;
}): Promise<void> {
  const resultadoAtualizacao = await opcoes.updateUser({
    password: opcoes.novaSenha,
  });
  if (resultadoAtualizacao.error) throw resultadoAtualizacao.error;

  const resultadoSaida = await opcoes.signOut({ scope: "local" });
  if (resultadoSaida.error) {
    console.error("Erro ao encerrar sessão temporária de recuperação:", resultadoSaida.error);
  }

  opcoes.limparEstadoLocal();
  limparRecuperacaoSenha(opcoes.armazenamento);
}
