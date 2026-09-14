import type { AbaAplicacao } from "@/constantes/navegacao";

const CHAVE_SESSAO_NAVEGACAO = "cedro_ia_session_navigation_id";

export const LIMITE_SALTOS_HISTORICO = 32;

export interface EstadoHistoricoCedroIA {
  cedroIA: true;
  protected: boolean;
  sessionNavigationId?: string;
  navigationIndex: number;
  aba?: AbaAplicacao;
  registroId?: string;
}

type ArmazenamentoSessao = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function gerarIdSessaoNavegacao(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function obterOuCriarIdSessaoNavegacao(
  armazenamento: ArmazenamentoSessao = window.sessionStorage,
): string {
  const existente = armazenamento.getItem(CHAVE_SESSAO_NAVEGACAO)?.trim();
  if (existente) return existente;

  const novoId = gerarIdSessaoNavegacao();
  armazenamento.setItem(CHAVE_SESSAO_NAVEGACAO, novoId);
  return novoId;
}

export function obterIdSessaoNavegacao(
  armazenamento: ArmazenamentoSessao = window.sessionStorage,
): string | null {
  return armazenamento.getItem(CHAVE_SESSAO_NAVEGACAO)?.trim() || null;
}

export function invalidarSessaoNavegacao(
  armazenamento: ArmazenamentoSessao = window.sessionStorage,
): void {
  armazenamento.removeItem(CHAVE_SESSAO_NAVEGACAO);
}

export function ehEstadoHistoricoCedroIA(valor: unknown): valor is EstadoHistoricoCedroIA {
  if (!valor || typeof valor !== "object") return false;
  const estado = valor as Partial<EstadoHistoricoCedroIA>;

  return estado.cedroIA === true
    && typeof estado.protected === "boolean"
    && Number.isSafeInteger(estado.navigationIndex)
    && estado.navigationIndex! >= 0;
}

export function criarEstadoHistoricoCedroIA(opcoes: {
  protegida: boolean;
  sessionNavigationId?: string | null;
  navigationIndex: number;
  aba?: AbaAplicacao;
  registroId?: string | null;
}): EstadoHistoricoCedroIA {
  return {
    cedroIA: true,
    protected: opcoes.protegida,
    sessionNavigationId: opcoes.protegida
      ? opcoes.sessionNavigationId?.trim() || undefined
      : undefined,
    navigationIndex: Math.max(0, Math.trunc(opcoes.navigationIndex)),
    aba: opcoes.aba,
    registroId: opcoes.registroId?.trim() || undefined,
  };
}

export function entradaPrivadaDeSessaoEncerrada(
  estado: unknown,
  autenticado: boolean,
): boolean {
  return !autenticado
    && ehEstadoHistoricoCedroIA(estado)
    && estado.protected;
}

export function rotaPrivadaBloqueada(
  autenticado: boolean,
  rotaProtegida: boolean,
  recuperacaoSenhaEmAndamento = false,
): boolean {
  return rotaProtegida && (!autenticado || recuperacaoSenhaEmAndamento);
}

export function obterDirecaoHistorico(
  indiceAnterior: number,
  estadoDestino: unknown,
): -1 | 0 | 1 {
  if (!ehEstadoHistoricoCedroIA(estadoDestino)) return 0;
  if (estadoDestino.navigationIndex < indiceAnterior) return -1;
  if (estadoDestino.navigationIndex > indiceAnterior) return 1;
  return 0;
}

export function podeContinuarSaltandoHistorico(quantidadeSaltos: number): boolean {
  return quantidadeSaltos < LIMITE_SALTOS_HISTORICO;
}
