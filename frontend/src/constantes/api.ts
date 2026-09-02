export const ROTAS_API = {
  WORKFLOW_CONFIG: "/api/workflow/config",
  WORKFLOW_LIST: "/api/workflow/list",
  WORKFLOW_INIT: "/api/workflow/init",
  WORKFLOW_DECIDE: "/api/workflow/decide",
  WORKFLOW_RESET_STATUS: "/api/workflow/reset-status",
  TI_INTERACOES_PENDENTES: "/api/workflow/ti-interactions/pending",
  TI_INTERACOES_SOLICITAR: "/api/workflow/ti-interactions/request",
  ADMIN_ATUALIZAR_ROLE: "/api/admin/update-role",
  ADMIN_EXCLUIR_USUARIO: "/api/admin/delete-user",
  AVATAR_UPLOAD: "/api/avatar/upload",
} as const;

export const rotaInteracoesTI = (recordId: string) =>
  `/api/workflow/ti-interactions?recordId=${encodeURIComponent(recordId)}`;

export const rotaRascunhoInteracaoTI = (solicitacaoId: string) =>
  `/api/workflow/ti-interactions/${encodeURIComponent(solicitacaoId)}/draft`;

export const rotaEnviarInteracaoTI = (solicitacaoId: string) =>
  `/api/workflow/ti-interactions/${encodeURIComponent(solicitacaoId)}/submit`;
