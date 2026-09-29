/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NOMES_ETAPAS_CURTOS } from "@/constantes/fluxo-aprovacao";
import type { ApprovalStep, ApprovalWorkflow, IARecord } from "@/tipos";
import { fluxoEncerrado, obterStatusGeralDoRegistro } from "@/utilitarios/status-solicitacao";

export type LinhaWorkflow = Record<string, unknown>;

const CHAVES_ID_REGISTRO = ["ia_record_id", "iaRecordId", "record_id", "recordId"];
const CHAVES_ETAPA_ATUAL = ["current_step", "currentStep"];
const CHAVES_STATUS_FINAL = ["final_status", "finalStatus"];
const CHAVES_CONCLUSAO = ["completed_at", "completedAt"];
const CHAVES_ETAPAS = ["steps", "etapas", "etapas_aprovacao"];
const CHAVES_NUMERO_ETAPA = ["step_number", "stepNumber"];
const CHAVES_NOME_PAPEL = ["role_name", "roleName"];
const CHAVES_RESPONSAVEL_ID = ["assigned_user_id", "assignedUserId"];
const CHAVES_RESPONSAVEL_NOME = ["assigned_user_name", "assignedUserName"];
const CHAVES_DECISAO_EM = ["decided_at", "decidedAt"];
const CHAVES_SOMENTE_PARECER = ["is_opinion_only", "isOpinionOnly"];
const CHAVES_ID_FLUXO = ["workflow_id", "workflowId"];

function primeiroValor(linha: LinhaWorkflow, chaves: string[]): unknown {
  for (const chave of chaves) {
    const valor = linha[chave];
    if (valor !== undefined && valor !== null) return valor;
  }
  return undefined;
}

function texto(valor: unknown): string | undefined {
  if (valor === undefined || valor === null) return undefined;
  const conteudo = String(valor).trim();
  return conteudo === "" ? undefined : conteudo;
}

/** Identificadores de registro chegam do banco em snake_case e da UI em camelCase. */
export function normalizarIdRegistroIa(valor: unknown): string {
  if (typeof valor === "string") return valor.trim().toUpperCase();
  if (typeof valor === "number") return String(valor);
  return "";
}

export function mesmoRegistroIa(a: unknown, b: unknown): boolean {
  const idA = normalizarIdRegistroIa(a);
  return idA !== "" && idA === normalizarIdRegistroIa(b);
}

export function normalizarEtapaAprovacao(linha: LinhaWorkflow): ApprovalStep | null {
  const numero = Number(primeiroValor(linha, CHAVES_NUMERO_ETAPA));
  if (!Number.isInteger(numero) || numero < 1) return null;

  return {
    stepNumber: numero,
    roleName: NOMES_ETAPAS_CURTOS[numero]
      || texto(primeiroValor(linha, CHAVES_NOME_PAPEL))
      || `Etapa ${numero}`,
    assignedUserId: texto(primeiroValor(linha, CHAVES_RESPONSAVEL_ID)),
    assignedUserName: texto(primeiroValor(linha, CHAVES_RESPONSAVEL_NOME)),
    status: (texto(linha.status) || "aguardando") as ApprovalStep["status"],
    comment: texto(linha.comment),
    decidedAt: texto(primeiroValor(linha, CHAVES_DECISAO_EM)),
    isOpinionOnly: Boolean(primeiroValor(linha, CHAVES_SOMENTE_PARECER)),
  };
}

export function normalizarWorkflowAprovacao(linha: LinhaWorkflow): ApprovalWorkflow | null {
  const iaRecordId = normalizarIdRegistroIa(primeiroValor(linha, CHAVES_ID_REGISTRO));
  if (!iaRecordId) return null;

  const etapaAtual = Number(primeiroValor(linha, CHAVES_ETAPA_ATUAL));
  const etapas = primeiroValor(linha, CHAVES_ETAPAS);

  return {
    iaRecordId,
    currentStep: Number.isInteger(etapaAtual) && etapaAtual >= 1 ? etapaAtual : 1,
    finalStatus: texto(primeiroValor(linha, CHAVES_STATUS_FINAL)) as ApprovalWorkflow["finalStatus"],
    completedAt: texto(primeiroValor(linha, CHAVES_CONCLUSAO)),
    steps: Array.isArray(etapas)
      ? etapas
        .map((etapa) => normalizarEtapaAprovacao(etapa as LinhaWorkflow))
        .filter((etapa): etapa is ApprovalStep => etapa !== null)
        .sort((a, b) => a.stepNumber - b.stepNumber)
      : [],
  };
}

export function normalizarListaWorkflows(linhas: unknown): ApprovalWorkflow[] {
  if (!Array.isArray(linhas)) return [];
  return linhas
    .map((linha) => normalizarWorkflowAprovacao(linha as LinhaWorkflow))
    .filter((workflow): workflow is ApprovalWorkflow => workflow !== null);
}

export function encontrarWorkflowDoRegistro(
  workflows: readonly ApprovalWorkflow[] | null | undefined,
  recordId: unknown,
): ApprovalWorkflow | undefined {
  const alvo = normalizarIdRegistroIa(recordId);
  if (!alvo) return undefined;
  return workflows?.find((workflow) => normalizarIdRegistroIa(workflow.iaRecordId) === alvo);
}

/** Leitura sem embed: junta etapas pelo id do fluxo e, se faltar, pelo id do registro. */
export function mesclarEtapasEmFluxos(
  fluxos: readonly LinhaWorkflow[],
  etapas: readonly LinhaWorkflow[],
): LinhaWorkflow[] {
  return fluxos.map((fluxo) => ({
    ...fluxo,
    steps: etapas.filter((etapa) => {
      const idFluxo = primeiroValor(etapa, CHAVES_ID_FLUXO);
      if (idFluxo !== undefined && fluxo.id !== undefined) return idFluxo === fluxo.id;
      return mesmoRegistroIa(
        primeiroValor(etapa, CHAVES_ID_REGISTRO),
        primeiroValor(fluxo, CHAVES_ID_REGISTRO),
      );
    }),
  }));
}

/**
 * A leitura direta do Supabase é limitada por RLS e devolve lista vazia sem erro.
 * Só substituímos o estado quando a origem é confiável ou quando trouxe dados.
 */
export function decidirAtualizacaoWorkflows(
  atuais: readonly ApprovalWorkflow[],
  carregados: readonly ApprovalWorkflow[],
  origemConfiavel: boolean,
): ApprovalWorkflow[] {
  if (origemConfiavel || carregados.length > 0) return [...carregados];
  return [...atuais];
}

function registroPendenteNaFilaAprovacao(
  record: IARecord,
  workflow?: ApprovalWorkflow | null,
): boolean {
  const status = obterStatusGeralDoRegistro(record, workflow);
  return status === "Em análise" || status === "Em teste";
}

/** Solicitação na etapa atual do fluxo em que o usuário logado é o responsável configurado. */
export function solicitacaoNaMinhaEtapaAprovacao(
  record: IARecord,
  workflows: readonly ApprovalWorkflow[],
  currentUserId: string | null | undefined,
): boolean {
  if (!currentUserId) return false;

  const workflow = encontrarWorkflowDoRegistro(workflows, record.id);
  if (fluxoEncerrado(record, workflow)) return false;
  if (!registroPendenteNaFilaAprovacao(record, workflow)) return false;

  const currentStepNum = workflow?.currentStep ?? 1;
  const wfStep = workflow?.steps?.find((step) => step.stepNumber === currentStepNum);
  return wfStep?.assignedUserId === currentUserId;
}

export function contarAprovacoesNaMinhaEtapa(
  records: readonly IARecord[],
  workflows: readonly ApprovalWorkflow[],
  currentUserId: string | null | undefined,
): number {
  if (!currentUserId) return 0;
  return records.filter((record) =>
    solicitacaoNaMinhaEtapaAprovacao(record, workflows, currentUserId),
  ).length;
}
