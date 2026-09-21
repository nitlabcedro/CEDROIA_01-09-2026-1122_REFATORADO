import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  liberarBloqueioAutenticacaoApi,
  registrarFalhaAutenticacaoApi,
  sessaoPrecisaRenovarToken,
  workflowApiBloqueadaPorAutenticacao,
} from "./autenticacao-api";

describe("autenticacao-api", () => {
  it("detecta access token próximo do vencimento", () => {
    const agora = 1_700_000_000;
    assert.equal(sessaoPrecisaRenovarToken(agora + 30, agora), true);
    assert.equal(sessaoPrecisaRenovarToken(agora + 120, agora), false);
  });

  it("bloqueia novas chamadas workflow após 401 e libera após novo login", () => {
    liberarBloqueioAutenticacaoApi();
    assert.equal(workflowApiBloqueadaPorAutenticacao(), false);

    registrarFalhaAutenticacaoApi();
    assert.equal(workflowApiBloqueadaPorAutenticacao(), true);

    liberarBloqueioAutenticacaoApi();
    assert.equal(workflowApiBloqueadaPorAutenticacao(), false);
  });
});
