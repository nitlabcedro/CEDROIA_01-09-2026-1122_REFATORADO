import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ALTURA_MAXIMA_PAINEL,
  ESPACO_PAINEL,
  MARGEM_VIEWPORT,
  calcularPosicaoMenuSuspenso,
} from "./menu-suspenso-posicao";

const JANELA = { largura: 1440, altura: 1030 };

describe("Menu suspenso — posição do painel", () => {
  it("abre abaixo do gatilho quando a lista cabe na área visível", () => {
    const posicao = calcularPosicaoMenuSuspenso(
      { top: 220, bottom: 252, left: 300, width: 420 },
      JANELA,
    );

    assert.equal(posicao.abrirAcima, false);
    assert.equal(posicao.top, 252 + ESPACO_PAINEL);
    assert.equal(posicao.bottom, "auto");
    assert.equal(posicao.maxHeight, ALTURA_MAXIMA_PAINEL);
  });

  it("abre acima quando a etapa final fica no rodapé da página", () => {
    const posicao = calcularPosicaoMenuSuspenso(
      { top: 780, bottom: 812, left: 300, width: 420 },
      JANELA,
    );

    assert.equal(posicao.abrirAcima, true);
    assert.equal(posicao.top, "auto");
    assert.equal(posicao.bottom, JANELA.altura - 780 + ESPACO_PAINEL);
    assert.equal(posicao.maxHeight, ALTURA_MAXIMA_PAINEL);
  });

  it("mantém o painel dentro da tela sem exigir rolagem da página", () => {
    const abaixo = calcularPosicaoMenuSuspenso(
      { top: 120, bottom: 152, left: 40, width: 300 },
      { largura: 1440, altura: 420 },
    );
    assert.equal(abaixo.abrirAcima, false);
    assert.ok(
      Number(abaixo.top) + abaixo.maxHeight <= 420 - MARGEM_VIEWPORT,
      "o painel aberto para baixo não pode passar do limite visível",
    );

    const acima = calcularPosicaoMenuSuspenso(
      { top: 300, bottom: 332, left: 40, width: 300 },
      { largura: 1440, altura: 420 },
    );
    assert.equal(acima.abrirAcima, true);
    assert.ok(
      Number(acima.bottom) + acima.maxHeight <= 420 - MARGEM_VIEWPORT,
      "o painel aberto para cima não pode passar do limite visível",
    );
  });

  it("limita largura e deslocamento horizontal às margens da janela", () => {
    const posicao = calcularPosicaoMenuSuspenso(
      { top: 100, bottom: 132, left: 700, width: 600 },
      { largura: 760, altura: 1030 },
    );

    assert.equal(posicao.width, 600);
    assert.equal(posicao.left, 760 - 600 - MARGEM_VIEWPORT);
  });
});
