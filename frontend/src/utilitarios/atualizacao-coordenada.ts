/**
 * Coordenação das releituras de registros e fluxos de aprovação.
 *
 * Telas que apenas querem dados recentes podem reaproveitar a atualização em
 * andamento. Depois de uma escrita isso é incorreto: a requisição em voo pode
 * ter lido o servidor antes da escrita e devolveria o estado anterior a ela.
 */
export interface AtualizacaoCoordenada {
  /** Reaproveita a atualização em andamento, se houver. */
  reaproveitar: () => Promise<void>;
  /** Inicia uma atualização nova, sem reaproveitar leituras anteriores à escrita. */
  forcar: () => Promise<void>;
  emAndamento: () => boolean;
}

export function criarAtualizacaoCoordenada(
  executar: () => Promise<void>,
): AtualizacaoCoordenada {
  let emVoo: Promise<void> | null = null;

  const iniciar = (): Promise<void> => {
    const requisicao = executar().finally(() => {
      if (emVoo === requisicao) emVoo = null;
    });
    emVoo = requisicao;
    return requisicao;
  };

  return {
    reaproveitar: () => emVoo || iniciar(),
    forcar: () => iniciar(),
    emAndamento: () => emVoo !== null,
  };
}

export interface ControleRespostaRecente {
  /** Registra o início de uma leitura e devolve o identificador dela. */
  iniciar: () => number;
  /** Falso quando uma leitura mais recente já começou. */
  estaAtual: (requisicao: number) => boolean;
}

/** Descarta respostas antigas que chegam depois de uma leitura mais recente. */
export function criarControleRespostaRecente(): ControleRespostaRecente {
  let ultima = 0;

  return {
    iniciar: () => {
      ultima += 1;
      return ultima;
    },
    estaAtual: (requisicao: number) => requisicao === ultima,
  };
}
