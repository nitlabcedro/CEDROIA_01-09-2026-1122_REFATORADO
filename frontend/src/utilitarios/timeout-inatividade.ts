import { CHAVES_ARMAZENAMENTO_LOCAL } from "@/constantes/armazenamento-local";

export const DURACAO_INATIVIDADE_MS = 10_800_000;
export const INTERVALO_PERSISTENCIA_ATIVIDADE_MS = 15_000;
export const EVENTOS_ATIVIDADE_HUMANA = [
  "pointerdown",
  "keydown",
  "touchstart",
  "scroll",
] as const;

export type ArmazenamentoInatividade = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type AlvoEventosInatividade = {
  addEventListener: (tipo: string, ouvinte: EventListener, opcoes?: AddEventListenerOptions | boolean) => void;
  removeEventListener: (tipo: string, ouvinte: EventListener, opcoes?: AddEventListenerOptions | boolean) => void;
};

export type DocumentoInatividade = {
  hidden?: boolean;
  addEventListener: (tipo: string, ouvinte: EventListener) => void;
  removeEventListener: (tipo: string, ouvinte: EventListener) => void;
};

export function interpretarTimestampAtividade(valor: string | null): number | null {
  if (!valor) return null;
  const timestamp = Number(valor);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  return Math.trunc(timestamp);
}

export function sessaoInativaExpirou(
  ultimaAtividadeMs: number,
  agoraMs: number,
  duracaoMs = DURACAO_INATIVIDADE_MS,
): boolean {
  return agoraMs - ultimaAtividadeMs >= duracaoMs;
}

export function msRestantesInatividade(
  ultimaAtividadeMs: number,
  agoraMs: number,
  duracaoMs = DURACAO_INATIVIDADE_MS,
): number {
  return Math.max(0, duracaoMs - (agoraMs - ultimaAtividadeMs));
}

export function criarControleTimeoutInatividade(opcoes: {
  armazenamento: ArmazenamentoInatividade;
  encerrarSessao: () => void | Promise<void>;
  agora?: () => number;
  duracaoMs?: number;
  chave?: string;
  intervaloPersistenciaMs?: number;
  alvoEventos?: AlvoEventosInatividade;
  documento?: DocumentoInatividade;
  agendarTimeout?: (callback: () => void, ms: number) => number;
  cancelarTimeout?: (id: number) => void;
}) {
  const agora = opcoes.agora ?? Date.now;
  const duracaoMs = opcoes.duracaoMs ?? DURACAO_INATIVIDADE_MS;
  const chave = opcoes.chave ?? CHAVES_ARMAZENAMENTO_LOCAL.ULTIMA_ATIVIDADE;
  const intervaloPersistenciaMs =
    opcoes.intervaloPersistenciaMs ?? INTERVALO_PERSISTENCIA_ATIVIDADE_MS;
  const armazenamento = opcoes.armazenamento;
  const alvoEventos = opcoes.alvoEventos;
  const documento = opcoes.documento;
  const agendarTimeout = opcoes.agendarTimeout ?? ((callback, ms) => window.setTimeout(callback, ms));
  const cancelarTimeout = opcoes.cancelarTimeout ?? ((id) => window.clearTimeout(id));

  let timeoutId: number | null = null;
  let ultimaPersistenciaMs = 0;
  let encerrando = false;
  let ativo = false;

  const lerUltimaAtividade = (): number | null =>
    interpretarTimestampAtividade(armazenamento.getItem(chave));

  const gravarUltimaAtividade = (timestamp: number) => {
    armazenamento.setItem(chave, String(timestamp));
    ultimaPersistenciaMs = timestamp;
  };

  const limparMarca = () => {
    armazenamento.removeItem(chave);
    ultimaPersistenciaMs = 0;
  };

  const cancelarAgendamento = () => {
    if (timeoutId === null) return;
    cancelarTimeout(timeoutId);
    timeoutId = null;
  };

  const encerrarPorInatividade = () => {
    if (encerrando) return;
    encerrando = true;
    cancelarAgendamento();
    limparMarca();
    void opcoes.encerrarSessao();
  };

  const verificarExpiracao = () => {
    if (!ativo || encerrando) return false;
    const ultimaAtividade = lerUltimaAtividade();
    if (ultimaAtividade === null) return false;
    if (!sessaoInativaExpirou(ultimaAtividade, agora(), duracaoMs)) return false;
    encerrarPorInatividade();
    return true;
  };

  const agendarVerificacao = () => {
    cancelarAgendamento();
    if (!ativo || encerrando) return;
    const ultimaAtividade = lerUltimaAtividade();
    if (ultimaAtividade === null) return;
    const restantes = msRestantesInatividade(ultimaAtividade, agora(), duracaoMs);
    if (restantes === 0) {
      verificarExpiracao();
      return;
    }
    timeoutId = agendarTimeout(() => {
      timeoutId = null;
      verificarExpiracao();
    }, restantes);
  };

  const garantirTimestampInicial = () => {
    const existente = lerUltimaAtividade();
    if (existente !== null) {
      ultimaPersistenciaMs = existente;
      return existente;
    }
    const inicial = agora();
    gravarUltimaAtividade(inicial);
    return inicial;
  };

  const registrarAtividade = (forcarPersistencia = false) => {
    if (!ativo || encerrando) return;
    const instante = agora();
    const devePersistir = forcarPersistencia
      || ultimaPersistenciaMs === 0
      || instante - ultimaPersistenciaMs >= intervaloPersistenciaMs;
    if (devePersistir) gravarUltimaAtividade(instante);
    agendarVerificacao();
  };

  const aoEventoAtividade = () => registrarAtividade(false);

  const aoVisibilidadeOuFoco = () => {
    if (!verificarExpiracao()) agendarVerificacao();
  };

  const aoStorage = (evento: Event) => {
    const storage = evento as StorageEvent;
    if (storage.key !== chave && storage.key !== null) return;
    if (encerrando || !ativo) return;
    const recebido = interpretarTimestampAtividade(storage.newValue);
    if (recebido === null) return;
    ultimaPersistenciaMs = recebido;
    if (!verificarExpiracao()) agendarVerificacao();
  };

  const iniciar = () => {
    if (ativo) return;
    ativo = true;
    encerrando = false;
    garantirTimestampInicial();
    if (verificarExpiracao()) return;

    for (const evento of EVENTOS_ATIVIDADE_HUMANA) {
      alvoEventos?.addEventListener(evento, aoEventoAtividade, { capture: true });
    }
    alvoEventos?.addEventListener("focus", aoVisibilidadeOuFoco);
    alvoEventos?.addEventListener("pageshow", aoVisibilidadeOuFoco);
    alvoEventos?.addEventListener("storage", aoStorage);
    documento?.addEventListener("visibilitychange", aoVisibilidadeOuFoco);
    agendarVerificacao();
  };

  const dispose = () => {
    ativo = false;
    cancelarAgendamento();
    for (const evento of EVENTOS_ATIVIDADE_HUMANA) {
      alvoEventos?.removeEventListener(evento, aoEventoAtividade, { capture: true });
    }
    alvoEventos?.removeEventListener("focus", aoVisibilidadeOuFoco);
    alvoEventos?.removeEventListener("pageshow", aoVisibilidadeOuFoco);
    alvoEventos?.removeEventListener("storage", aoStorage);
    documento?.removeEventListener("visibilitychange", aoVisibilidadeOuFoco);
  };

  return {
    iniciar,
    dispose,
    limparMarca,
    registrarAtividade,
    verificarExpiracao,
    garantirTimestampInicial,
    lerUltimaAtividade,
  };
}
