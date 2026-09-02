/**
 * Fallbacks de cargos por setor usados apenas quando o cadastro dinâmico de
 * setores ainda não possui cargos no Supabase/localStorage.
 *
 * Mantidos em um único ponto para evitar divergência entre Cadastro, Perfil e
 * Nova Solicitação.
 */
export const CARGOS_PADRAO_POR_SETOR: Readonly<Record<string, readonly string[]>> = {
  NIT: ["Pesquisador de IA", "Analista de Inovação", "Gestor de Portfólio", "Engenheiro de Processos"],
  TI: ["Analista de Suporte", "Administrador de Sistemas", "Desenvolvedor de Software", "Engenheiro de Dados"],
  Marketing: ["Analista de Comunicação", "Designer Gráfico", "Especialista em SEO", "Social Media"],
  Administrativo: ["Auxiliar Administrativo", "Assistente Financeiro", "Gerente de Operações", "Analista de Contratos"],
  Jurídico: ["Advogado Integrado", "Assessor LGPD", "Consultor Regulatório", "Assistente Jurídico"],
  "Direção Técnica": ["Diretor Técnico", "Supervisor Analítico", "Responsável Técnico", "Auditor Médico"],
  Qualidade: ["Gestor de Qualidade", "Analista de Qualidade", "Auditor de Processos", "Inspetor Sanitário"],
  "Atendimento / Recepção": ["Recepcionista", "Atendente Técnico", "Supervisor de Relacionamento", "Auxiliar de Caixa"],
  "Laboratório de Patologia": ["Médico Patologista", "Técnico em Histologia", "Citotécnico", "Auxiliar de Laboratório"],
  "Laboratório Central": ["Biomédico Palestrante", "Técnico em Análises Clínicas", "Farmacêutico Bioquímico", "Auxiliar de Coleta"],
};

export function obterCargosPadrao(setor: string): string[] {
  return [...(CARGOS_PADRAO_POR_SETOR[setor] ?? ["Colaborador"])];
}
