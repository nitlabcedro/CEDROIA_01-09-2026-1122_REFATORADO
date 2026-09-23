import type { ApprovalWorkflow, ApprovalStep } from "@/tipos";

export type EstadoVisualEtapaFluxo = "aprovado" | "negado" | "atual" | "neutro";

export function normalizarNumeroEtapa(valor: unknown): number | null {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 1) return null;
  return numero;
}

export function fluxoEstaPendente(workflow?: Pick<ApprovalWorkflow, "finalStatus"> | null): boolean {
  return String(workflow?.finalStatus || "").toLowerCase().trim() === "pendente";
}

export function fluxoEstaCancelado(workflow?: Pick<ApprovalWorkflow, "finalStatus"> | null): boolean {
  return String(workflow?.finalStatus || "").toLowerCase().trim() === "cancelado";
}

function statusEtapa(step?: Pick<ApprovalStep, "status"> | null): string {
  return String(step?.status || "").toLowerCase().trim();
}

export function obterEstadoVisualEtapaFluxo(
  stepNumber: unknown,
  workflow?: Pick<ApprovalWorkflow, "currentStep" | "finalStatus" | "steps"> | null,
): EstadoVisualEtapaFluxo {
  const etapa = normalizarNumeroEtapa(stepNumber);
  if (etapa === null) return "neutro";

  const step = workflow?.steps?.find(
    (item) => normalizarNumeroEtapa(item.stepNumber) === etapa,
  );
  const status = statusEtapa(step);

  if (status === "negado") return "negado";
  if (status === "aprovado" || status === "opiniao") return "aprovado";

  if (fluxoEstaCancelado(workflow)) return "neutro";

  const etapaAtual = normalizarNumeroEtapa(workflow?.currentStep);
  if (fluxoEstaPendente(workflow) && etapaAtual !== null && etapa === etapaAtual) {
    return "atual";
  }

  return "neutro";
}
