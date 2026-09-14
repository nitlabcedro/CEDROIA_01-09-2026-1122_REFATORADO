import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  LIMITE_SALTOS_HISTORICO,
  criarEstadoHistoricoCedroIA,
  entradaPrivadaDeSessaoEncerrada,
  invalidarSessaoNavegacao,
  obterDirecaoHistorico,
  obterIdSessaoNavegacao,
  obterOuCriarIdSessaoNavegacao,
  podeContinuarSaltandoHistorico,
  rotaPrivadaBloqueada,
} from "./historico-navegacao";

function criarArmazenamento() {
  const dados = new Map<string, string>();
  return {
    getItem: (chave: string) => dados.get(chave) ?? null,
    setItem: (chave: string, valor: string) => dados.set(chave, valor),
    removeItem: (chave: string) => dados.delete(chave),
  };
}

describe("histórico de navegação autenticada", () => {
  it("cria entradas privadas identificáveis sem incluir credenciais", () => {
    const estado = criarEstadoHistoricoCedroIA({
      protegida: true,
      sessionNavigationId: "sessao-navegacao-1",
      navigationIndex: 3,
      aba: "inventory",
    });

    assert.deepEqual(estado, {
      cedroIA: true,
      protected: true,
      sessionNavigationId: "sessao-navegacao-1",
      navigationIndex: 3,
      aba: "inventory",
      registroId: undefined,
    });
    assert.equal("token" in estado, false);
    assert.equal("password" in estado, false);
  });

  it("mantém um ID durante a sessão e o invalida no logout", () => {
    const armazenamento = criarArmazenamento();
    const primeiro = obterOuCriarIdSessaoNavegacao(armazenamento);
    assert.equal(obterOuCriarIdSessaoNavegacao(armazenamento), primeiro);

    invalidarSessaoNavegacao(armazenamento);
    assert.equal(obterIdSessaoNavegacao(armazenamento), null);

    const proximo = obterOuCriarIdSessaoNavegacao(armazenamento);
    assert.notEqual(proximo, primeiro);
  });

  it("identifica Voltar e Avançar para saltar entradas encerradas", () => {
    const anterior = criarEstadoHistoricoCedroIA({
      protegida: true,
      sessionNavigationId: "encerrada",
      navigationIndex: 2,
      aba: "inventory",
    });
    const posterior = criarEstadoHistoricoCedroIA({
      protegida: true,
      sessionNavigationId: "encerrada",
      navigationIndex: 4,
      aba: "admin",
    });

    assert.equal(obterDirecaoHistorico(3, anterior), -1);
    assert.equal(obterDirecaoHistorico(3, posterior), 1);
    assert.equal(entradaPrivadaDeSessaoEncerrada(anterior, false), true);
    assert.equal(entradaPrivadaDeSessaoEncerrada(posterior, false), true);
  });

  it("mantém a autenticação como autoridade para navegação normal", () => {
    const estado = criarEstadoHistoricoCedroIA({
      protegida: true,
      sessionNavigationId: "atual",
      navigationIndex: 1,
      aba: "dashboard",
    });

    assert.equal(entradaPrivadaDeSessaoEncerrada(estado, true), false);
    assert.equal(entradaPrivadaDeSessaoEncerrada({}, false), false);
    assert.equal(obterDirecaoHistorico(1, { cedroIA: true, protected: true }), 0);
    assert.equal(rotaPrivadaBloqueada(false, true), true);
    assert.equal(rotaPrivadaBloqueada(true, true), false);
    assert.equal(
      (rotaPrivadaBloqueada as (...args: boolean[]) => boolean)(true, true, true),
      true,
    );
    assert.equal(rotaPrivadaBloqueada(false, false), false);
  });

  it("impõe limite finito aos saltos consecutivos", () => {
    for (let salto = 0; salto < LIMITE_SALTOS_HISTORICO; salto += 1) {
      assert.equal(podeContinuarSaltandoHistorico(salto), true);
    }
    assert.equal(podeContinuarSaltandoHistorico(LIMITE_SALTOS_HISTORICO), false);
    assert.equal(podeContinuarSaltandoHistorico(LIMITE_SALTOS_HISTORICO + 1), false);
  });
});
