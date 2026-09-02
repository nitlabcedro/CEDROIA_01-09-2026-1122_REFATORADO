import type { ApprovalConfig, ApprovalStep } from "@/tipos";

export const ETAPAS_APROVACAO_OFICIAIS = [
  { stepNumber: 1, roleName: "Coordenador NIT", shortName: "NIT", displayName: "NIT", isOpinionOnly: false },
  { stepNumber: 2, roleName: "Gerente TI", shortName: "TI", displayName: "TI", isOpinionOnly: false },
  { stepNumber: 3, roleName: "Período de Teste", shortName: "PERÍODO DE TESTE", displayName: "Período de teste", isOpinionOnly: false },
  { stepNumber: 4, roleName: "Presidência", shortName: "PRESIDÊNCIA", displayName: "Presidência", isOpinionOnly: false },
  { stepNumber: 5, roleName: "Direção Financeira", shortName: "FINANCEIRO", displayName: "Financeiro", isOpinionOnly: true },
] as const;

export const TOTAL_ETAPAS_APROVACAO = ETAPAS_APROVACAO_OFICIAIS.length;
export const NOME_ETAPA_FINANCEIRA = ETAPAS_APROVACAO_OFICIAIS[4].roleName;

export const NOMES_ETAPAS_CURTOS: Record<number, string> = Object.fromEntries(
  ETAPAS_APROVACAO_OFICIAIS.map((etapa) => [etapa.stepNumber, etapa.shortName]),
);

export const NOMES_ETAPAS_EXIBICAO: Record<number, string> = Object.fromEntries(
  ETAPAS_APROVACAO_OFICIAIS.map((etapa) => [etapa.stepNumber, etapa.displayName]),
);

export function criarConfiguracaoAprovacaoPadrao(): ApprovalConfig {
  return {
    steps: ETAPAS_APROVACAO_OFICIAIS.map(({ stepNumber, roleName, isOpinionOnly }) => ({
      stepNumber,
      roleName,
      isOpinionOnly,
    })),
  };
}

export function criarEtapasWorkflowPadrao(): ApprovalStep[] {
  return ETAPAS_APROVACAO_OFICIAIS.map(({ stepNumber, roleName, isOpinionOnly }) => ({
    stepNumber,
    roleName,
    assignedUserName: "",
    status: "aguardando",
    isOpinionOnly,
  }));
}
