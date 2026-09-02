import { criarEtapasWorkflowPadrao } from "@/constantes/fluxo-aprovacao";
import { ApprovalConfig, ApprovalStep, ApprovalWorkflow, IARecord, StatusUso } from "@/tipos";

export interface RelatorioPdfAssinatura {
  etapa: string;
  responsavel: string;
  status: string;
  parecer: string;
  data?: string;
}

export interface RelatorioPdfDados {
  protocolo: string;
  nomeIa: string;
  status: string;
  atualizadoEm: string;
  dataCadastro: string;
  solicitante: string;
  setorSolicitante: string;
  descricaoAtividade: string;
  objetivos: string[];
  objetivoOutro?: string;
  beneficiosEsperados: string;
  assinaturas: RelatorioPdfAssinatura[];
}

const FALLBACK_PARECER = "Parecer ainda não registrado.";
const FALLBACK_RESPONSAVEL = "Responsável não identificado";

const formatarData = (valor?: string) => {
  if (!valor) return "Não informado";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return data.toLocaleDateString("pt-BR");
};

const formatarDataHora = (valor?: string) => {
  if (!valor) return "Não informado";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return data.toLocaleString("pt-BR");
};

const formatarStatusEtapa = (status?: string) => {
  switch ((status || "").toLowerCase()) {
    case "aprovado":
      return "Aprovado";
    case "negado":
      return "Negado";
    case "opiniao":
      return "Parecer registrado";
    default:
      return "Pendente";
  }
};

const extrairParecer = (comentario?: string) => {
  if (!comentario) return FALLBACK_PARECER;
  const linhas = comentario
    .split("\n")
    .map((linha) => linha.trim())
    .filter(Boolean);

  if (!linhas.length) return FALLBACK_PARECER;

  const parecerExplicito = linhas.find((linha) => /^parecer( final)?\s*:/i.test(linha));
  if (parecerExplicito) {
    return parecerExplicito.replace(/^parecer( final)?\s*:/i, "").trim() || FALLBACK_PARECER;
  }

  const chavesIgnoradas = [
    /^decis[aã]o\s*:/i,
    /^data\s*:/i,
    /^respons[aá]vel\s*:/i,
    /^etapa\s*:/i,
    /^status\s*:/i,
  ];

  const linhasLimpas = linhas
    .filter((linha) => !chavesIgnoradas.some((regex) => regex.test(linha)))
    .map((linha) => linha.replace(/^[•\-*]\s*/, "").replace(/\*\*/g, "").trim())
    .filter(Boolean);

  return (linhasLimpas.join(" ") || FALLBACK_PARECER).trim();
};

const obterEtapasEfetivas = (
  record: IARecord,
  workflow?: ApprovalWorkflow,
  approvalConfig?: ApprovalConfig,
): ApprovalStep[] => {
  if (workflow?.steps?.length) {
    return workflow.steps;
  }

  if (approvalConfig?.steps?.length) {
    return approvalConfig.steps.map((step) => ({
      stepNumber: step.stepNumber,
      roleName: step.roleName,
      assignedUserId: step.userId,
      assignedUserName: step.userName,
      status: "aguardando" as const,
      isOpinionOnly: step.isOpinionOnly,
    }));
  }

  return criarEtapasWorkflowPadrao();
};

const formatarStatusGeral = (status: StatusUso | string) => {
  switch (status) {
    case StatusUso.APROVADO:
      return "Aprovado";
    case StatusUso.APROVADO_COM_RESTRICOES:
      return "Aprovado com restrições";
    case StatusUso.NAO_APROVADO:
      return "Negado";
    case StatusUso.CANCELADA:
      return "Cancelado";
    case StatusUso.SUSPENSO:
      return "Suspenso";
    case StatusUso.EM_TESTE_PILOTO:
      return "Em teste";
    default:
      return "Pendente";
  }
};

export function montarDadosRelatorioPdf(
  record: IARecord,
  workflow?: ApprovalWorkflow,
  approvalConfig?: ApprovalConfig,
): RelatorioPdfDados {
  const etapas = obterEtapasEfetivas(record, workflow, approvalConfig);
  const assinaturas = etapas.map((step) => ({
    etapa: step.roleName,
    responsavel: step.assignedUserName?.trim() || FALLBACK_RESPONSAVEL,
    status: formatarStatusEtapa(step.status),
    parecer: extrairParecer(step.comment),
    data: step.decidedAt ? formatarData(step.decidedAt) : undefined,
  }));

  return {
    protocolo: record.id,
    nomeIa: record.nomeFerramenta || "Inteligência Artificial",
    status: formatarStatusGeral(record.statusUso),
    atualizadoEm: formatarDataHora(record.updatedAt || record.createdAt),
    dataCadastro: formatarData(record.dataRegistro || record.createdAt),
    solicitante: record.responsavelPreenchimento || "Não informado",
    setorSolicitante: record.unidadeSetor || "Não informado",
    descricaoAtividade: record.descricaoAtividade || "Não informado.",
    objetivos: Array.isArray(record.objetivos) ? record.objetivos.filter(Boolean) : [],
    objetivoOutro: record.objetivoOutro?.trim() || undefined,
    beneficiosEsperados: record.beneficiosEsperados || "Não informado.",
    assinaturas,
  };
}
