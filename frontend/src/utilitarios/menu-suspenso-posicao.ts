export interface GatilhoMenuSuspenso {
  top: number;
  bottom: number;
  left: number;
  width: number;
}

export interface JanelaMenuSuspenso {
  largura: number;
  altura: number;
}

export interface PosicaoMenuSuspenso {
  top: number | "auto";
  bottom: number | "auto";
  left: number;
  width: number;
  maxHeight: number;
  abrirAcima: boolean;
}

export const MARGEM_VIEWPORT = 10;
export const ESPACO_PAINEL = 6;
export const ALTURA_MAXIMA_PAINEL = 280;
export const ALTURA_MINIMA_PAINEL = 96;

/**
 * Posiciona o painel sempre dentro da área visível: quando a lista não cabe
 * abaixo do gatilho e há mais espaço acima, o painel abre para cima em vez de
 * ficar fora da tela exigindo rolagem da página.
 */
export function calcularPosicaoMenuSuspenso(
  gatilho: GatilhoMenuSuspenso,
  janela: JanelaMenuSuspenso,
  alturaMaxima = ALTURA_MAXIMA_PAINEL,
): PosicaoMenuSuspenso {
  const larguraDisponivel = Math.max(180, janela.largura - MARGEM_VIEWPORT * 2);
  const width = Math.min(gatilho.width, larguraDisponivel);
  const left = Math.min(
    Math.max(gatilho.left, MARGEM_VIEWPORT),
    Math.max(MARGEM_VIEWPORT, janela.largura - width - MARGEM_VIEWPORT),
  );

  const espacoAbaixo = janela.altura - gatilho.bottom - ESPACO_PAINEL - MARGEM_VIEWPORT;
  const espacoAcima = gatilho.top - ESPACO_PAINEL - MARGEM_VIEWPORT;
  const abrirAcima = espacoAbaixo < alturaMaxima && espacoAcima > espacoAbaixo;

  const espacoEscolhido = abrirAcima ? espacoAcima : espacoAbaixo;
  const maxHeight = Math.max(
    ALTURA_MINIMA_PAINEL,
    Math.min(alturaMaxima, espacoEscolhido),
  );

  return {
    top: abrirAcima ? "auto" : gatilho.bottom + ESPACO_PAINEL,
    bottom: abrirAcima ? janela.altura - gatilho.top + ESPACO_PAINEL : "auto",
    left,
    width,
    maxHeight,
    abrirAcima,
  };
}
