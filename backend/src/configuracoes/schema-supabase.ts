/**
 * Nomes físicos do schema Supabase usados pelo backend.
 *
 * Mantidos centralizados para impedir divergência entre serviços e facilitar
 * migrações futuras sem alterar dezenas de consultas isoladas.
 */
export const TABELAS_SUPABASE = {
  PERFIS: "perfis",
  REGISTROS_IA: "registros_ia",
  CONFIGURACAO_APROVACAO: "configuracao_aprovacao",
  FLUXOS_APROVACAO: "fluxos_aprovacao",
  ETAPAS_APROVACAO: "etapas_aprovacao",
  MENSAGENS: "mensagens",
  SETORES: "setores",
  SOLICITACOES_TI: "solicitacoes_ti",
  PERGUNTAS_TI: "perguntas_ti",
  OBJETOS_STORAGE: "storage.objects",
} as const;

export const BUCKETS_SUPABASE = {
  AVATARES: "avatars",
} as const;

/** Relações embutidas usadas em selects do PostgREST/Supabase. */
export const RELACOES_SUPABASE = {
  ETAPAS_DO_FLUXO: `steps:${TABELAS_SUPABASE.ETAPAS_APROVACAO}(*)`,
  PERGUNTAS_TI: `questions:${TABELAS_SUPABASE.PERGUNTAS_TI}(*)`,
} as const;
