export const ROTAS_API = {
  WORKFLOW_CONFIG: "/api/workflow/config",
  WORKFLOW_LIST: "/api/workflow/list",
  WORKFLOW_SUMMARY: "/api/workflow/summary",
  WORKFLOW_INIT: "/api/workflow/init",
  WORKFLOW_DECIDE: "/api/workflow/decide",
  WORKFLOW_RESET_STATUS: "/api/workflow/reset-status",
  WORKFLOW_CANCEL: "/api/workflow/cancel",
  REGISTROS_PROXIMO_ID: "/api/registros/next-id",
  TI_INTERACOES_PENDENTES: "/api/workflow/ti-interactions/pending",
  TI_INTERACOES_PENDENTES_RESPONSAVEL: "/api/workflow/ti-interactions/pending-ti",
  TI_INTERACOES_SOLICITAR: "/api/workflow/ti-interactions/request",
  TI_INTERACOES_BLOCOS: "/api/workflow/ti-interactions/blocks",
  ADMIN_ATUALIZAR_ATRIBUICOES: "/api/admin/update-assignments",
  ADMIN_ATUALIZAR_ROLE: "/api/admin/update-role",
  ADMIN_EXCLUIR_USUARIO: "/api/admin/delete-user",
  AVATAR_UPLOAD: "/api/avatar/upload",
} as const;

export const rotaInteracoesTI = (recordId: string) =>
  `/api/workflow/ti-interactions?recordId=${encodeURIComponent(recordId)}`;

export const rotaDetalheWorkflow = (recordId: string) =>
  `/api/workflow/detail/${encodeURIComponent(recordId)}`;

export const rotaExcluirRegistro = (recordId: string) =>
  `/api/registros/${encodeURIComponent(recordId)}`;

export const rotaRascunhoInteracaoTI = (solicitacaoId: string) =>
  `/api/workflow/ti-interactions/${encodeURIComponent(solicitacaoId)}/draft`;

export const rotaEnviarInteracaoTI = (solicitacaoId: string) =>
  `/api/workflow/ti-interactions/${encodeURIComponent(solicitacaoId)}/submit`;

export const rotaMensagemInteracaoTI = (solicitacaoId: string) =>
  `/api/workflow/ti-interactions/${encodeURIComponent(solicitacaoId)}/message`;

export const rotaEncerrarInteracaoTI = (solicitacaoId: string) =>
  `/api/workflow/ti-interactions/${encodeURIComponent(solicitacaoId)}/close-round`;

export const rotaRespostaBlocoTI = (solicitacaoId: string, perguntaId: string) =>
  `/api/workflow/ti-interactions/${encodeURIComponent(solicitacaoId)}/questions/${encodeURIComponent(perguntaId)}`;

export const rotaFinalizarBlocoTI = (solicitacaoId: string) =>
  `/api/workflow/ti-interactions/${encodeURIComponent(solicitacaoId)}/finalize`;
