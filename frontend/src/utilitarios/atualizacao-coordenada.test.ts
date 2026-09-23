import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  criarAtualizacaoCoordenada,
  criarControleRespostaRecente,
} from "./atualizacao-coordenada";

function promessaControlada() {
  let liberar!: () => void;
  const promessa = new Promise<void>((resolve) => {
    liberar = resolve;
  });
  return { promessa, liberar };
}

describe("atualização coordenada de registros e fluxos", () => {
  it("B/C) leituras de tela reaproveitam a atualização em andamento", async () => {
    let execucoes = 0;
    const leitura = promessaControlada();
    const coordenada = criarAtualizacaoCoordenada(async () => {
      execucoes += 1;
      await leitura.promessa;
    });

    const primeira = coordenada.reaproveitar();
    const segunda = coordenada.reaproveitar();
    assert.equal(coordenada.emAndamento(), true);

    leitura.liberar();
    await Promise.all([primeira, segunda]);

    assert.equal(execucoes, 1);
    assert.equal(coordenada.emAndamento(), false);

    await coordenada.reaproveitar();
    assert.equal(execucoes, 2);
  });

  it("D) a releitura após a escrita não reaproveita leitura iniciada antes dela", async () => {
    let fluxoInicializado = false;
    const fluxosLidos: boolean[] = [];
    const leituraEmVoo = promessaControlada();
    let primeiraExecucao = true;

    const coordenada = criarAtualizacaoCoordenada(async () => {
      const lidoDoServidor = fluxoInicializado;
      if (primeiraExecucao) {
        primeiraExecucao = false;
        await leituraEmVoo.promessa;
      }
      fluxosLidos.push(lidoDoServidor);
    });

    const emVoo = coordenada.reaproveitar();

    // Registro criado e fluxo inicializado enquanto a leitura anterior ainda corria.
    fluxoInicializado = true;
    assert.equal(
      coordenada.reaproveitar(),
      emVoo,
      "reaproveitar devolveria a leitura anterior à escrita",
    );

    const posEscrita = coordenada.forcar();
    assert.notEqual(posEscrita, emVoo);

    leituraEmVoo.liberar();
    await Promise.all([emVoo, posEscrita]);

    assert.equal(fluxosLidos[0], true, "a releitura forçada enxerga o fluxo já criado");
    assert.equal(fluxosLidos[1], false, "a leitura em voo ficou no estado anterior à escrita");
  });

  it("uma falha na atualização não bloqueia as próximas", async () => {
    let execucoes = 0;
    const coordenada = criarAtualizacaoCoordenada(async () => {
      execucoes += 1;
      throw new Error("falha de rede");
    });

    await assert.rejects(coordenada.forcar(), /falha de rede/);
    assert.equal(coordenada.emAndamento(), false);

    await assert.rejects(coordenada.reaproveitar(), /falha de rede/);
    assert.equal(execucoes, 2);
  });

  it("descarta a resposta antiga quando uma leitura mais recente já começou", () => {
    const controle = criarControleRespostaRecente();

    const antiga = controle.iniciar();
    assert.equal(controle.estaAtual(antiga), true);

    const recente = controle.iniciar();
    assert.equal(controle.estaAtual(antiga), false);
    assert.equal(controle.estaAtual(recente), true);
  });
});
