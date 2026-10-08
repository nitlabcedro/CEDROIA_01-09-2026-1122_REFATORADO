import {
  ROTAS_API,
  rotaEncerrarInteracaoTI,
  rotaEnviarInteracaoTI,
  rotaFinalizarBlocoTI,
  rotaInteracoesTI,
  rotaMensagemInteracaoTI,
  rotaRascunhoInteracaoTI,
  rotaRespostaBlocoTI,
} from "@/constantes/api";
import { workflowApiBloqueadaPorAutenticacao } from "@/servicos/autenticacao-api";
import { requisicaoApi } from "@/servicos/api";
import type { SolicitacaoInformacoesTI } from "@/tipos";

let requisicaoPendencias: Promise<SolicitacaoInformacoesTI[]> | null = null;
let requisicaoPendenciasResponsavel: Promise<SolicitacaoInformacoesTI[]> | null = null;

async function lerJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const mensagem = (payload as { error?: string })?.error || `Erro HTTP ${response.status}`;
    throw new Error(mensagem);
  }
  return payload as T;
}

function garantirChamadaWorkflowAutenticada(): void {
  if (workflowApiBloqueadaPorAutenticacao()) {
    throw new Error("Sessão expirada. Faça login novamente para continuar.");
  }
}

export async function listarInteracoesTI(recordId: string): Promise<SolicitacaoInformacoesTI[]> {
  garantirChamadaWorkflowAutenticada();
  const response = await requisicaoApi(rotaInteracoesTI(recordId));
  const payload = await lerJson<{ interactions: SolicitacaoInformacoesTI[] }>(response);
  return payload.interactions || [];
}

export async function listarPendenciasTI(): Promise<SolicitacaoInformacoesTI[]> {
  if (requisicaoPendencias) return requisicaoPendencias;

  requisicaoPendencias = (async () => {
    if (workflowApiBloqueadaPorAutenticacao()) return [];
    const response = await requisicaoApi(ROTAS_API.TI_INTERACOES_PENDENTES);
    const payload = await lerJson<{ interactions: SolicitacaoInformacoesTI[] }>(response);
    return payload.interactions || [];
  })().finally(() => {
    requisicaoPendencias = null;
  });

  return requisicaoPendencias;
}

export async function listarPendenciasResponsavelTI(): Promise<SolicitacaoInformacoesTI[]> {
  if (requisicaoPendenciasResponsavel) return requisicaoPendenciasResponsavel;

  requisicaoPendenciasResponsavel = (async () => {
    if (workflowApiBloqueadaPorAutenticacao()) return [];
    const response = await requisicaoApi(ROTAS_API.TI_INTERACOES_PENDENTES_RESPONSAVEL);
    const payload = await lerJson<{ interactions: SolicitacaoInformacoesTI[] }>(response);
    return payload.interactions || [];
  })().finally(() => {
    requisicaoPendenciasResponsavel = null;
  });

  return requisicaoPendenciasResponsavel;
}

export async function criarSolicitacaoInformacoesTI(
  recordId: string,
  perguntas: string[],
): Promise<SolicitacaoInformacoesTI> {
  return criarBlocoPerguntasTI(recordId, perguntas);
}

export async function criarBlocoPerguntasTI(
  recordId: string,
  perguntas: string[],
): Promise<SolicitacaoInformacoesTI> {
  const response = await requisicaoApi(ROTAS_API.TI_INTERACOES_BLOCOS, {
    method: "POST",
    body: JSON.stringify({ recordId, perguntas }),
  });
  const payload = await lerJson<{ interaction: SolicitacaoInformacoesTI }>(response);
  return payload.interaction;
}

export async function salvarRespostaBlocoTI(
  solicitacaoId: string,
  perguntaId: string,
  resposta: string,
): Promise<SolicitacaoInformacoesTI> {
  const response = await requisicaoApi(rotaRespostaBlocoTI(solicitacaoId, perguntaId), {
    method: "PUT",
    body: JSON.stringify({ resposta }),
  });
  const payload = await lerJson<{ interaction: SolicitacaoInformacoesTI }>(response);
  return payload.interaction;
}

export async function finalizarBlocoRespostasTI(
  solicitacaoId: string,
): Promise<SolicitacaoInformacoesTI> {
  const response = await requisicaoApi(rotaFinalizarBlocoTI(solicitacaoId), {
    method: "POST",
  });
  const payload = await lerJson<{ interaction: SolicitacaoInformacoesTI }>(response);
  return payload.interaction;
}

export async function criarConversaComunicacaoTI(
  recordId: string,
  mensagem: string,
): Promise<SolicitacaoInformacoesTI> {
  const response = await requisicaoApi(ROTAS_API.TI_INTERACOES_SOLICITAR, {
    method: "POST",
    body: JSON.stringify({ recordId, mensagem }),
  });
  const payload = await lerJson<{ interaction: SolicitacaoInformacoesTI }>(response);
  return payload.interaction;
}

export async function enviarMensagemComunicacaoTI(
  solicitacaoId: string,
  mensagem: string,
): Promise<SolicitacaoInformacoesTI> {
  const response = await requisicaoApi(rotaMensagemInteracaoTI(solicitacaoId), {
    method: "POST",
    body: JSON.stringify({ mensagem }),
  });
  const payload = await lerJson<{ interaction: SolicitacaoInformacoesTI }>(response);
  return payload.interaction;
}

export async function encerrarConversaComunicacaoTI(
  solicitacaoId: string,
): Promise<SolicitacaoInformacoesTI> {
  const response = await requisicaoApi(rotaEncerrarInteracaoTI(solicitacaoId), {
    method: "POST",
  });
  const payload = await lerJson<{ interaction: SolicitacaoInformacoesTI }>(response);
  return payload.interaction;
}

export async function salvarRascunhoRespostasTI(
  solicitacaoId: string,
  respostas: Array<{ perguntaId: string; resposta: string }>,
): Promise<void> {
  const response = await requisicaoApi(rotaRascunhoInteracaoTI(solicitacaoId), {
    method: "PUT",
    body: JSON.stringify({ respostas }),
  });
  await lerJson<{ success: boolean }>(response);
}

export async function enviarRespostasTI(
  solicitacaoId: string,
  respostas: Array<{ perguntaId: string; resposta: string }>,
): Promise<SolicitacaoInformacoesTI> {
  const response = await requisicaoApi(rotaEnviarInteracaoTI(solicitacaoId), {
    method: "POST",
    body: JSON.stringify({ respostas }),
  });
  const payload = await lerJson<{ interaction: SolicitacaoInformacoesTI }>(response);
  return payload.interaction;
}
