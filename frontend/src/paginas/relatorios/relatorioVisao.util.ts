import { ETAPAS_APROVACAO_OFICIAIS, NOMES_ETAPAS_EXIBICAO } from "@/constantes/fluxo-aprovacao";

/** Marcador do card que envolve o fluxo horizontal de aprovação. */
export const ESTRUTURA_FLUXO_APROVACAO_CARD = "fluxo-aprovacao-card";

/** Marcador da lista horizontal de etapas dentro do card. */
export const ESTRUTURA_FLUXO_APROVACAO_HORIZONTAL = "fluxo-aprovacao-horizontal";

/** Marcador do controle segmentado de abas. */
export const ESTRUTURA_ABAS_RELATORIO_SEGMENTADO = "abas-relatorio-segmentado";

export const ABAS_RELATORIO_IA = [
  { id: "visao-geral", label: "Resumo" },
  { id: "finalidade-uso", label: "Uso da IA" },
  { id: "nit", label: "NIT" },
  { id: "ti", label: "TI" },
  { id: "relatorio", label: "Relatório" },
] as const;

export type AbaRelatorioId = (typeof ABAS_RELATORIO_IA)[number]["id"];

export function obterRotuloEtapaFluxo(stepNumber: number): string {
  return NOMES_ETAPAS_EXIBICAO[stepNumber] ?? `Etapa ${stepNumber}`;
}

export function obterNumerosEtapasOficiaisOrdenados(): number[] {
  return ETAPAS_APROVACAO_OFICIAIS.map((etapa) => etapa.stepNumber);
}
