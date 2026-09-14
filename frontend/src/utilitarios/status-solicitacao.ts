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

export interface WorkflowStatusInput {
  finalStatus?: string | null;
  currentStep?: number | null;
}

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

export function obterStatusGeralDoRegistro(
  record: {
    statusUso?: string | null;
    statusAuditoria?: string | null;
  },
  workflow?: WorkflowStatusInput | null,
): StatusGeral {
  const statusArmazenado = record.statusUso || record.statusAuditoria;
  const statusNormalizado = statusArmazenado ? normalizar(statusArmazenado) : null;
  const finalWorkflow = normalizarTexto(workflow?.finalStatus || "");

  if (finalWorkflow === "aprovado") return "Aprovada";
  if (finalWorkflow === "negado") return "Não aprovada";
  if (finalWorkflow === "cancelado") return "Cancelada";

  if (statusNormalizado === "Cancelada") return "Cancelada";

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
