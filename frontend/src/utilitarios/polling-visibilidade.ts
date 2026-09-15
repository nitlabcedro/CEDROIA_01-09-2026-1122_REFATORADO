/** Intervalo do heartbeat de presença (`last_seen` em perfis). */
export const INTERVALO_HEARTBEAT_PRESENCA_MS = 60_000;

/** Intervalo do polling de pendências de interações TI. */
export const INTERVALO_PENDENCIAS_TI_MS = 30_000;

export type DocumentoVisibilidadePolling = {
  hidden: boolean;
  visibilityState?: DocumentVisibilityState;
  addEventListener: (tipo: string, ouvinte: () => void) => void;
  removeEventListener: (tipo: string, ouvinte: () => void) => void;
};

export type JanelaPolling = {
  setInterval: (callback: () => void, ms: number) => number;
  clearInterval: (id: number) => void;
};

export function documentoEstaOculto(documento: Pick<DocumentoVisibilidadePolling, "hidden" | "visibilityState">): boolean {
  if (documento.hidden) return true;
  return documento.visibilityState === "hidden";
}

export type ControlePollingVisibilidade = {
  dispose: () => void;
  sincronizarAgora: () => void;
};

export function registrarPollingComVisibilidade(opcoes: {
  intervaloMs: number;
  executar: () => void;
  documento: DocumentoVisibilidadePolling;
  janela?: JanelaPolling;
  executarAoIniciar?: boolean;
}): ControlePollingVisibilidade {
  const { intervaloMs, executar, documento } = opcoes;
  const janela = opcoes.janela ?? window;
  const executarAoIniciar = opcoes.executarAoIniciar ?? true;

  let intervaloId: number | null = null;
  let ativo = true;

  const pararIntervalo = () => {
    if (intervaloId === null) return;
    janela.clearInterval(intervaloId);
    intervaloId = null;
  };

  const iniciarIntervalo = () => {
    if (!ativo || intervaloId !== null) return;
    intervaloId = janela.setInterval(() => {
      if (!ativo || documentoEstaOculto(documento)) return;
      executar();
    }, intervaloMs);
  };

  const sincronizarSeVisivel = () => {
    if (!ativo || documentoEstaOculto(documento)) return;
    executar();
  };

  const aoAlterarVisibilidade = () => {
    if (!ativo) return;
    if (documentoEstaOculto(documento)) {
      pararIntervalo();
      return;
    }
    sincronizarSeVisivel();
    iniciarIntervalo();
  };

  if (!documentoEstaOculto(documento)) {
    if (executarAoIniciar) sincronizarSeVisivel();
    iniciarIntervalo();
  }

  documento.addEventListener("visibilitychange", aoAlterarVisibilidade);

  return {
    sincronizarAgora: sincronizarSeVisivel,
    dispose: () => {
      ativo = false;
      pararIntervalo();
      documento.removeEventListener("visibilitychange", aoAlterarVisibilidade);
    },
  };
}
