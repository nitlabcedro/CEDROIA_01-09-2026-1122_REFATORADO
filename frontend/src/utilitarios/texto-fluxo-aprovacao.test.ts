import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  LIMITE_TEXTO_FLUXO_APROVACAO,
  MENSAGEM_LIMITE_TEXTO_FLUXO_APROVACAO,
} from "@/constantes/fluxo-aprovacao";
import {
  aplicarLimiteEntradaFluxoAprovacao,
  limitarTextoEntradaFluxoAprovacao,
  textoEntradaExcedeLimiteFluxoAprovacao,
  textoEntradaRespeitaLimiteFluxoAprovacao,
} from "@/utilitarios/texto-fluxo-aprovacao";

describe("texto-fluxo-aprovacao", () => {
  it("define o limite oficial em 2000 caracteres", () => {
    assert.equal(LIMITE_TEXTO_FLUXO_APROVACAO, 2000);
    assert.match(MENSAGEM_LIMITE_TEXTO_FLUXO_APROVACAO, /2000/);
  });

  it("aceita texto com exatamente 2000 caracteres", () => {
    const texto = "a".repeat(2000);
    assert.equal(textoEntradaRespeitaLimiteFluxoAprovacao(texto), true);
    assert.equal(limitarTextoEntradaFluxoAprovacao(texto), texto);
  });

  it("impede nova entrada acima de 2000 caracteres", () => {
    const texto = "a".repeat(2001);
    assert.equal(textoEntradaExcedeLimiteFluxoAprovacao(texto), true);
    assert.equal(limitarTextoEntradaFluxoAprovacao(texto).length, 2000);
  });

  it("não trunca conteúdo legado na exibição (utilitário só limita entrada)", () => {
    const legado = "b".repeat(3500);
    assert.equal(limitarTextoEntradaFluxoAprovacao(legado).length, 2000);
    assert.equal(legado.length, 3500);
  });

  it("preserva texto legado acima do limite em campo editável até o usuário encurtar", () => {
    const legado = "c".repeat(2500);
    assert.equal(aplicarLimiteEntradaFluxoAprovacao(legado, legado), legado);
    assert.equal(aplicarLimiteEntradaFluxoAprovacao(legado, "c".repeat(2499)).length, 2499);
    assert.equal(aplicarLimiteEntradaFluxoAprovacao(legado, "c".repeat(2501)), legado);
  });
});
