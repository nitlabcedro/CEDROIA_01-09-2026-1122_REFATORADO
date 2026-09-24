import { papelEhAdmin } from "../utilitarios/permissoes";

export const STATUS_USO_CANCELADA = "Cancelada pelo solicitante";
export const ACAO_HISTORICO_CANCELAMENTO = "Solicitação cancelada";
export const MENSAGEM_HISTORICO_CANCELAMENTO =
  "Esta solicitação foi cancelada e não seguirá para aprovação.";

export type StatusGeralCancelamento =
  | "Aprovada"
  | "Não aprovada"
  | "Cancelada"
  | "Em andamento";

function normalizarTexto(valor?: string | null): string {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function autorizarCancelamento(params: {
  userId?: string | null;
  role?: string | null;
  ownerId?: string | null;
}): { permitido: boolean; status: number; mensagem: string } {
  if (!params.userId) {
    return { permitido: false, status: 401, mensagem: "Não autorizado." };
  }

  if (papelEhAdmin(params.role)) {
    return { permitido: true, status: 200, mensagem: "" };
  }

  if (!params.ownerId) {
    return {
      permitido: false,
      status: 403,
      mensagem: "Apenas o solicitante ou um administrador pode cancelar esta solicitação.",
    };
  }

  if (String(params.ownerId) !== String(params.userId)) {
    return {
      permitido: false,
      status: 403,
      mensagem: "Apenas o solicitante ou um administrador pode cancelar esta solicitação.",
    };
  }

  return { permitido: true, status: 200, mensagem: "" };
}

export function obterStatusGeralCancelamento(params: {
  statusUso?: string | null;
  statusAuditoria?: string | null;
  workflowFinalStatus?: string | null;
}): StatusGeralCancelamento {
  const final = normalizarTexto(params.workflowFinalStatus);
  if (final === "aprovado") return "Aprovada";
  if (final === "negado") return "Não aprovada";
  if (final === "cancelado") return "Cancelada";

  const uso = normalizarTexto(params.statusUso);
  const auditoria = normalizarTexto(params.statusAuditoria);

  if (uso.includes("cancelad") || auditoria.includes("cancelad")) {
    return "Cancelada";
  }
  if (
    uso.includes("nao aprovad")
    || uso.includes("suspens")
    || auditoria === "negado"
    || auditoria.includes("indeferid")
  ) {
    return "Não aprovada";
  }
  if (uso.includes("aprov") || auditoria.includes("aprov")) {
    return "Aprovada";
  }

  return "Em andamento";
}

export function estadoFinalImpedeCancelamento(params: {
  statusUso?: string | null;
  statusAuditoria?: string | null;
  workflowFinalStatus?: string | null;
}): boolean {
  const status = obterStatusGeralCancelamento(params);
  return status === "Aprovada" || status === "Não aprovada" || status === "Cancelada";
}

export function montarDadosRegistroCancelado(
  dadosAtuais: Record<string, unknown>,
  agora: string,
  nomeAtor: string,
  justificativa: string,
): Record<string, unknown> {
  const historicoAtual = Array.isArray(dadosAtuais.historico) ? dadosAtuais.historico : [];
  const justificativaNormalizada = justificativa.trim();
  return {
    ...dadosAtuais,
    statusUso: STATUS_USO_CANCELADA,
    updatedAt: agora,
    cancelamento: {
      justificativa: justificativaNormalizada,
      canceladoEm: agora,
      canceladoPor: nomeAtor,
    },
    historico: [
      ...historicoAtual,
      {
        date: agora,
        action: ACAO_HISTORICO_CANCELAMENTO,
        user: nomeAtor,
        message: `${MENSAGEM_HISTORICO_CANCELAMENTO} Motivo: ${justificativaNormalizada}`,
      },
    ],
  };
}
