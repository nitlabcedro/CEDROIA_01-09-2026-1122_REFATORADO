export const ETAPAS_PADRAO_APROVACAO = [
  { step_number: 1, role_name: "Coordenador NIT", is_opinion_only: false },
  { step_number: 2, role_name: "Gerente TI", is_opinion_only: false },
  { step_number: 3, role_name: "Período de Teste", is_opinion_only: false },
  { step_number: 4, role_name: "Presidência", is_opinion_only: false },
  { step_number: 5, role_name: "Direção Financeira", is_opinion_only: false },
] as const;

export const TOTAL_ETAPAS_APROVACAO = ETAPAS_PADRAO_APROVACAO.length;
export const NOME_ETAPA_FINANCEIRA = ETAPAS_PADRAO_APROVACAO[4].role_name;
