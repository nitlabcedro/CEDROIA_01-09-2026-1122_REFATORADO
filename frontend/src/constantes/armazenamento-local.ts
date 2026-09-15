/** Chaves persistidas pelo frontend no navegador. */
export const CHAVES_ARMAZENAMENTO_LOCAL = {
  ABA_ATIVA: "active_tab",
  REGISTRO_SELECIONADO: "selected_record_id",
  CHAT_ATIVO_COM: "active_chat_with",
  CHAT_ALVO_NOTIFICACAO: "cedro_chat_target",
  MAPA_CHAT_VISUALIZADO_PREFIXO: "cedro_chat_seen_",
  INVENTARIO_LEGADO: "cedro_ia_inventory",
  SETORES_LEGADO: "cedro_custom_sectors",
  DETALHES_SETORES: "cedro_sectors_details_v2",
  EMAIL_LEMBRADO: "cedro_remembered_email",
  LGPD_NIVEL: "lgpd_strictness_level",
  SAUDE_SISTEMA: "system_health",
  MODO_DESEMPENHO: "system_performance_mode",
  RASCUNHO_SOLICITACAO_PREFIXO: "cedro_nova_solicitacao_draft_",
} as const;

export const EVENTOS_APLICACAO = {
  CHAT_LEITURA_ATUALIZADA: "cedro-chat-seen",
  CHAT_ABRIR_CONVERSA: "cedro-open-chat",
  /** Total agregado de não lidas calculado pelo Chat (evita segunda consulta global na aba chat). */
  CHAT_BADGE_ATUALIZADO: "cedro-chat-badge",
} as const;
