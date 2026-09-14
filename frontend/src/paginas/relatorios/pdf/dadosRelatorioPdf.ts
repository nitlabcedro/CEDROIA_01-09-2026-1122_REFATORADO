import { ETAPAS_APROVACAO_OFICIAIS } from "@/constantes/fluxo-aprovacao";
import { ApprovalConfig, ApprovalStep, ApprovalWorkflow, IARecord } from "@/tipos";
import { obterStatusGeralDoRegistro } from "@/utilitarios/status-solicitacao";

export interface RelatorioPdfAssinatura {
  stepNumber: number;
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

const formatarStatusEtapa = (
  step: ApprovalStep | undefined,
  stepNumber: number,
  workflow?: ApprovalWorkflow,
  solicitacaoCancelada = false,
) => {
  const etapaCancelamento = workflow?.currentStep;
  const etapaCancelamentoValida = typeof etapaCancelamento === "number"
    && Number.isInteger(etapaCancelamento)
    && etapaCancelamento >= 1
    && etapaCancelamento <= ETAPAS_APROVACAO_OFICIAIS.length;

  if (solicitacaoCancelada && etapaCancelamentoValida) {
    if (stepNumber === etapaCancelamento) return "Cancelada";
    if (stepNumber > etapaCancelamento) return "Não iniciada";
  }

  const status = step?.status;
  switch ((status || "").toLowerCase()) {
    case "aprovado":
    case "opiniao":
      return "Aprovado";
    case "negado":
      return "Negado";
    default:
      return workflow?.finalStatus === "pendente" && workflow.currentStep === stepNumber
        ? "Em andamento"
        : "Não iniciada";
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

export function montarDadosRelatorioPdf(
  record: IARecord,
  workflow?: ApprovalWorkflow,
  approvalConfig?: ApprovalConfig,
): RelatorioPdfDados {
  const statusGeral = obterStatusGeralDoRegistro(record, workflow);
  const solicitacaoCancelada = statusGeral === "Cancelada";
  const etapasWorkflowPorNumero = new Map(
    (workflow?.steps || []).map((step) => [step.stepNumber, step]),
  );
  const configuracaoPorNumero = new Map(
    (approvalConfig?.steps || []).map((step) => [step.stepNumber, step]),
  );
  const assinaturas = ETAPAS_APROVACAO_OFICIAIS.map((etapaOficial) => {
    const step = etapasWorkflowPorNumero.get(etapaOficial.stepNumber);
    const configStep = configuracaoPorNumero.get(etapaOficial.stepNumber);

    return {
      stepNumber: etapaOficial.stepNumber,
      etapa: etapaOficial.shortName,
      responsavel:
        step?.assignedUserName?.trim() ||
        configStep?.userName?.trim() ||
        FALLBACK_RESPONSAVEL,
      status: formatarStatusEtapa(
        step,
        etapaOficial.stepNumber,
        workflow,
        solicitacaoCancelada,
      ),
      parecer: extrairParecer(step?.comment),
      data: step?.decidedAt ? formatarData(step.decidedAt) : undefined,
    };
  });

  return {
    protocolo: record.id,
    nomeIa: record.nomeFerramenta || "Inteligência Artificial",
    status: statusGeral,
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
