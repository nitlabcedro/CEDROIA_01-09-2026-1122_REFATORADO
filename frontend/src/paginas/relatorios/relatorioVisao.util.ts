import { ETAPAS_APROVACAO_OFICIAIS, NOMES_ETAPAS_EXIBICAO } from "@/constantes/fluxo-aprovacao";
import type { ApprovalStep } from "@/tipos";

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
  { id: "periodo-teste", label: "Período de Teste" },
  { id: "presidencia", label: "Presidência" },
  { id: "financeiro", label: "Financeiro" },
  { id: "relatorio", label: "Relatório" },
] as const;

export type AbaRelatorioId = (typeof ABAS_RELATORIO_IA)[number]["id"];

export function obterRotuloEtapaFluxo(stepNumber: number): string {
  return NOMES_ETAPAS_EXIBICAO[stepNumber] ?? `Etapa ${stepNumber}`;
}

export function obterNumerosEtapasOficiaisOrdenados(): number[] {
  return ETAPAS_APROVACAO_OFICIAIS.map((etapa) => etapa.stepNumber);
}

export function obterEtapasWorkflowPorNumero(
  steps: readonly ApprovalStep[] | null | undefined,
  stepNumber: number,
): ApprovalStep[] {
  return (steps ?? []).filter((step) => step.stepNumber === stepNumber);
}

const LINHA_ETAPA_COMENTARIO = /^etapa\s*:/i;
const ROTULO_RELATORIO_PERIODO_TESTE = /^relat[oó]rio do per[ií]odo de testes?\s*:\s*(.*)$/i;

/** Remove metadados/rótulos da etapa 3 só para exibição; o comment persistido não muda. */
export function extrairTextoParecerPeriodoTeste(commentRaw?: string): string {
  if (!commentRaw) return "";

  const linhas = commentRaw.split("\n").flatMap((linha) => {
    const texto = linha.replace(/^[•\-\*\s]+/, "").replace(/\*\*/g, "").trim();
    if (!texto) return [""];
    if (LINHA_ETAPA_COMENTARIO.test(texto)) return [];

    const rotulo = texto.match(ROTULO_RELATORIO_PERIODO_TESTE);
    if (rotulo) return rotulo[1].trim() ? [rotulo[1].trim()] : [];

    return [linha.trimEnd()];
  });

  return linhas.join("\n").trim();
}

export function formatarDataRelatorio(valor?: string): string | undefined {
  if (!valor) return undefined;

  const dataCivil = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dataCivil) {
    const [, ano, mes, dia] = dataCivil;
    return `${dia}/${mes}/${ano}`;
  }

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return data.toLocaleDateString("pt-BR");
}

export function obterDetalhesStatusEtapaRelatorio(
  step: ApprovalStep,
  currentStep: number,
  workflowFinalizado: boolean,
) {
  const rawStatus = (step.status || "").toLowerCase().trim();
  const isPassed = ["aprovado", "aprovada", "opiniao", "opinado", "concluido"].includes(rawStatus);
  const isFailed = ["negado", "indeferido", "rejeitado", "declinado", "nao_aprovado"].includes(rawStatus);
  const isCurrent =
    (step.stepNumber === currentStep && !workflowFinalizado && !isPassed && !isFailed)
    || rawStatus === "em_avaliacao"
    || rawStatus === "pendente";
  const variante = isPassed ? "aprovada" : isFailed ? "negada" : isCurrent ? "atual" : "aguardando";

  return {
    isPassed,
    isFailed,
    isCurrent,
    isAwaiting: !isPassed && !isFailed && !isCurrent,
    variante,
    badgeText: isPassed
      ? (rawStatus === "opiniao" || rawStatus === "opinado" ? "PARECER EMITIDO" : "APROVADA")
      : isFailed ? "INDEFERIDA" : isCurrent ? "EM ANÁLISE" : "AGUARDANDO",
    iconSymbol: isPassed ? "✓" : isFailed ? "✕" : String(step.stepNumber),
  };
}
