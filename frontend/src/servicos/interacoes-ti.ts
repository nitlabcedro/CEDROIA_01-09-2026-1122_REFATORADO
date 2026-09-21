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
import { requisicaoApi } from "@/servicos/api";
import type { SolicitacaoInformacoesTI } from "@/tipos";

const CACHE_PENDENCIAS_MS = 30000;
let pendenciasCache: SolicitacaoInformacoesTI[] | null = null;
let pendenciasCacheEm = 0;
let requisicaoPendencias: Promise<SolicitacaoInformacoesTI[]> | null = null;
let pendenciasResponsavelCache: SolicitacaoInformacoesTI[] | null = null;
let pendenciasResponsavelCacheEm = 0;
let requisicaoPendenciasResponsavel: Promise<SolicitacaoInformacoesTI[]> | null = null;

export function invalidarCachesInteracoesTI() {
  pendenciasCache = null;
  pendenciasCacheEm = 0;
  pendenciasResponsavelCache = null;
  pendenciasResponsavelCacheEm = 0;
}

function invalidarCachePendenciasSolicitanteTI() {
  pendenciasCache = null;
  pendenciasCacheEm = 0;
}

async function lerJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const mensagem = (payload as any)?.error || `Erro HTTP ${response.status}`;
    throw new Error(mensagem);
  }
  return payload as T;
}

export async function listarInteracoesTI(recordId: string): Promise<SolicitacaoInformacoesTI[]> {
  const response = await requisicaoApi(rotaInteracoesTI(recordId));
  const payload = await lerJson<{ interactions: SolicitacaoInformacoesTI[] }>(response);
  return payload.interactions || [];
}

export async function listarPendenciasTI(): Promise<SolicitacaoInformacoesTI[]> {
  if (requisicaoPendencias) return requisicaoPendencias;
  if (pendenciasCache && Date.now() - pendenciasCacheEm < CACHE_PENDENCIAS_MS) {
    return [...pendenciasCache];
  }

  requisicaoPendencias = (async () => {
    const response = await requisicaoApi(ROTAS_API.TI_INTERACOES_PENDENTES);
    const payload = await lerJson<{ interactions: SolicitacaoInformacoesTI[] }>(response);
    pendenciasCache = payload.interactions || [];
    pendenciasCacheEm = Date.now();
    return [...pendenciasCache];
  })().finally(() => {
    requisicaoPendencias = null;
  });

  return requisicaoPendencias;
}

export async function listarPendenciasResponsavelTI(): Promise<SolicitacaoInformacoesTI[]> {
  if (requisicaoPendenciasResponsavel) return requisicaoPendenciasResponsavel;
  if (
    pendenciasResponsavelCache
    && Date.now() - pendenciasResponsavelCacheEm < CACHE_PENDENCIAS_MS
  ) {
    return [...pendenciasResponsavelCache];
  }

  requisicaoPendenciasResponsavel = (async () => {
    const response = await requisicaoApi(ROTAS_API.TI_INTERACOES_PENDENTES_RESPONSAVEL);
    const payload = await lerJson<{ interactions: SolicitacaoInformacoesTI[] }>(response);
    pendenciasResponsavelCache = payload.interactions || [];
    pendenciasResponsavelCacheEm = Date.now();
    return [...pendenciasResponsavelCache];
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
  invalidarCachesInteracoesTI();
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
  invalidarCachePendenciasSolicitanteTI();
  return payload.interaction;
}

export async function finalizarBlocoRespostasTI(
  solicitacaoId: string,
): Promise<SolicitacaoInformacoesTI> {
  const response = await requisicaoApi(rotaFinalizarBlocoTI(solicitacaoId), {
    method: "POST",
  });
  const payload = await lerJson<{ interaction: SolicitacaoInformacoesTI }>(response);
  invalidarCachesInteracoesTI();
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
  invalidarCachesInteracoesTI();
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
  invalidarCachesInteracoesTI();
  return payload.interaction;
}

export async function encerrarConversaComunicacaoTI(
  solicitacaoId: string,
): Promise<SolicitacaoInformacoesTI> {
  const response = await requisicaoApi(rotaEncerrarInteracaoTI(solicitacaoId), {
    method: "POST",
  });
  const payload = await lerJson<{ interaction: SolicitacaoInformacoesTI }>(response);
  invalidarCachesInteracoesTI();
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
  invalidarCachesInteracoesTI();
  return payload.interaction;
}
