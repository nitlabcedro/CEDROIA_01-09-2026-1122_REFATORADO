import { ROTAS_API, rotaEnviarInteracaoTI, rotaInteracoesTI, rotaRascunhoInteracaoTI } from "@/constantes/api";
import { requisicaoApi } from "@/servicos/api";
import type { SolicitacaoInformacoesTI } from "@/tipos";

const CACHE_PENDENCIAS_MS = 30000;
let pendenciasCache: SolicitacaoInformacoesTI[] | null = null;
let pendenciasCacheEm = 0;
let requisicaoPendencias: Promise<SolicitacaoInformacoesTI[]> | null = null;

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

export async function criarSolicitacaoInformacoesTI(
  recordId: string,
  perguntas: string[],
): Promise<SolicitacaoInformacoesTI> {
  const response = await requisicaoApi(ROTAS_API.TI_INTERACOES_SOLICITAR, {
    method: "POST",
    body: JSON.stringify({ recordId, perguntas }),
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
  pendenciasCache = null;
  pendenciasCacheEm = 0;
  return payload.interaction;
}
