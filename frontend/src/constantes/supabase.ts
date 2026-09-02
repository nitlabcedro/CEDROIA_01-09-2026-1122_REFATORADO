/**
 * Nomes físicos usados no Supabase.
 *
 * Centralizar estes identificadores evita strings espalhadas pela aplicação e
 * torna uma futura migração/renomeação de tabelas muito mais segura.
 * Os valores refletem o schema atual em português após a migração de banco.
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
} as const;

export const BUCKETS_SUPABASE = {
  AVATARES: "avatars",
  ANEXOS_CHAT: "chat-attachments",
} as const;

/** Relações embutidas usadas em selects do PostgREST/Supabase. */
export const RELACOES_SUPABASE = {
  ETAPAS_DO_FLUXO: `steps:${TABELAS_SUPABASE.ETAPAS_APROVACAO}(*)`,
  PERGUNTAS_TI: `questions:${TABELAS_SUPABASE.PERGUNTAS_TI}(*)`,
} as const;
