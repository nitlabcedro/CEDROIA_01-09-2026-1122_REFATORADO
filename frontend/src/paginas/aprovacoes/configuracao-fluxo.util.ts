import type { ApprovalConfig } from "@/tipos";

export type EtapaFluxoLocal = ApprovalConfig["steps"][number];

export function normalizarEtapasFluxoLocal(
  steps: ApprovalConfig["steps"],
  nomesFixosPorEtapa: Record<number, string>,
): ApprovalConfig["steps"] {
  return steps.map((step) => ({
    ...step,
    roleName: nomesFixosPorEtapa[step.stepNumber] || step.roleName,
  }));
}

/** Impressão estável dos responsáveis por etapa (ignora nomes de papel exibidos). */
export function impressaoDigitalEtapasFluxo(steps: ApprovalConfig["steps"]): string {
  const ordenado = [...steps].sort((a, b) => a.stepNumber - b.stepNumber);
  const payload = ordenado.map((step) => ({
    stepNumber: step.stepNumber,
    userId: step.userId ?? "",
    isOpinionOnly: Boolean(step.isOpinionOnly),
  }));
  return JSON.stringify(payload);
}

/** Evita sobrescrever edições locais quando o pai atualiza `approvalConfig`. */
export function deveAplicarEtapasDoServidor(
  editandoLocalmente: boolean,
): boolean {
  return !editandoLocalmente;
}

export function formatarHorarioSalvoFluxo(data: Date): string {
  return data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
