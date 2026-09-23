/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const STATUS_GERAIS_OFICIAIS = [
  "Em análise",
  "Em teste",
  "Aprovada",
  "Não aprovada",
  "Cancelada",
] as const;

export type StatusGeral = (typeof STATUS_GERAIS_OFICIAIS)[number];

export type VarianteStatusGeral = "analise" | "teste" | "aprovada" | "negada" | "cancelada";

export interface WorkflowStepStatusInput {
  stepNumber?: number | null;
  status?: string | null;
  isOpinionOnly?: boolean | null;
}

export interface WorkflowStatusInput {
  finalStatus?: string | null;
  currentStep?: number | null;
  steps?: WorkflowStepStatusInput[] | null;
}

const STATUS_GERAIS_TERMINAIS: StatusGeral[] = [
  "Aprovada",
  "Não aprovada",
  "Cancelada",
];

function normalizarTexto(status: string): string {
  return String(status)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Normaliza qualquer representação de status para um dos cinco status gerais oficiais.
 */
export function normalizar(status?: string | null): StatusGeral {
  if (!status) return "Em análise";

  const texto = normalizarTexto(status);

  if (
    texto === "cancelada" ||
    texto === "cancelado" ||
    texto.includes("cancelad")
  ) {
    return "Cancelada";
  }

  if (
    texto.includes("nao aprovad") ||
    texto === "negado" ||
    texto === "negada" ||
    texto.includes("suspens") ||
    texto.includes("indeferid")
  ) {
    return "Não aprovada";
  }

  if (
    texto.includes("teste") ||
    texto.includes("piloto") ||
    texto.includes("homolog")
  ) {
    return "Em teste";
  }

  if (texto.includes("aprov")) {
    return "Aprovada";
  }

  if (
    texto.includes("analise") ||
    texto.includes("avaliac") ||
    texto.includes("pendent") ||
    texto.includes("andamento")
  ) {
    return "Em análise";
  }

  return "Em análise";
}

export function obterStatusPorEtapa(etapa: number): StatusGeral {
  if (etapa === 3) return "Em teste";
  return "Em análise";
}

export function obterStatusPorWorkflow(
  workflow?: WorkflowStatusInput | null,
): StatusGeral | null {
  if (!workflow) return null;

  const final = normalizarTexto(workflow.finalStatus || "");

  if (final === "aprovado") return "Aprovada";
  if (final === "negado") return "Não aprovada";
  if (final === "cancelado") return "Cancelada";

  if (final === "pendente" || !final) {
    const etapa = workflow.currentStep;
    if (typeof etapa === "number" && etapa >= 1) {
      return obterStatusPorEtapa(etapa);
    }
  }

  return null;
}

/**
 * Etapa com "negado" encerra o fluxo. Todas as 5 etapas oficiais são decisórias.
 */
export function obterStatusPorNegacaoEmEtapas(
  workflow?: WorkflowStatusInput | null,
): StatusGeral | null {
  if (!workflow?.steps?.length) return null;

  for (const step of workflow.steps) {
    const statusEtapa = normalizarTexto(step.status || "");
    if (statusEtapa !== "negado") continue;
    return "Não aprovada";
  }

  return null;
}

export function rotuloStatusEtapa(step: WorkflowStepStatusInput): string {
  const status = normalizarTexto(step.status || "");

  if (status === "negado") return "Negado";
  if (status === "aprovado" || status === "opiniao") return "Aprovado";
  if (status === "aguardando") return "Em avaliação";
  return "Pendente";
}

function obterStatusNormalizadoDoRegistro(record: {
  statusUso?: string | null;
  statusAuditoria?: string | null;
}): StatusGeral | null {
  const usoNorm = record.statusUso ? normalizar(record.statusUso) : null;
  const audNorm = record.statusAuditoria ? normalizar(record.statusAuditoria) : null;

  if (audNorm && STATUS_GERAIS_TERMINAIS.includes(audNorm)) return audNorm;
  if (usoNorm && STATUS_GERAIS_TERMINAIS.includes(usoNorm)) return usoNorm;
  if (usoNorm) return usoNorm;
  if (audNorm) return audNorm;

  return null;
}

/** Fluxo encerrado (aprovada, negada ou cancelada) — filas ativas de aprovação. */
export function fluxoEncerrado(
  record: {
    statusUso?: string | null;
    statusAuditoria?: string | null;
  },
  workflow?: WorkflowStatusInput | null,
): boolean {
  const status = obterStatusGeralDoRegistro(record, workflow);
  return (
    status === "Aprovada" ||
    status === "Não aprovada" ||
    status === "Cancelada"
  );
}

/**
 * Detecta divergência crítica: etapa negada mas status global ainda "em andamento".
 */
export function detectarDivergenciaEncerramentoNegado(
  record: {
    statusUso?: string | null;
    statusAuditoria?: string | null;
  },
  workflow?: WorkflowStatusInput | null,
): boolean {
  const negacaoEtapa = obterStatusPorNegacaoEmEtapas(workflow);
  if (negacaoEtapa !== "Não aprovada") return false;

  const finalWorkflow = normalizarTexto(workflow?.finalStatus || "");
  if (finalWorkflow === "negado" || finalWorkflow === "cancelado") return false;

  const statusPersistido = obterStatusNormalizadoDoRegistro(record);
  if (statusPersistido === "Não aprovada" || statusPersistido === "Aprovada") {
    return false;
  }

  return true;
}

export function obterStatusGeralDoRegistro(
  record: {
    statusUso?: string | null;
    statusAuditoria?: string | null;
  },
  workflow?: WorkflowStatusInput | null,
): StatusGeral {
  const statusNormalizado = obterStatusNormalizadoDoRegistro(record);
  const finalWorkflow = normalizarTexto(workflow?.finalStatus || "");

  if (finalWorkflow === "negado") return "Não aprovada";
  if (finalWorkflow === "cancelado") return "Cancelada";

  if (statusNormalizado === "Cancelada") return "Cancelada";
  if (statusNormalizado === "Não aprovada") return "Não aprovada";

  const negacaoEtapa = obterStatusPorNegacaoEmEtapas(workflow);
  if (negacaoEtapa) return negacaoEtapa;

  if (finalWorkflow === "aprovado") return "Aprovada";
  if (statusNormalizado === "Aprovada") return "Aprovada";

  const statusWorkflow = obterStatusPorWorkflow(workflow);
  if (statusWorkflow) return statusWorkflow;
  if (statusNormalizado) return statusNormalizado;

  return "Em análise";
}

export function obterVarianteStatus(status: StatusGeral): VarianteStatusGeral {
  switch (status) {
    case "Em teste":
      return "teste";
    case "Aprovada":
      return "aprovada";
    case "Não aprovada":
      return "negada";
    case "Cancelada":
      return "cancelada";
    default:
      return "analise";
  }
}

export function ehStatusGeralOficial(status: string): status is StatusGeral {
  return (STATUS_GERAIS_OFICIAIS as readonly string[]).includes(status);
}
