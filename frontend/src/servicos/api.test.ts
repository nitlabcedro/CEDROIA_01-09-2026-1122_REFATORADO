import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { criarRequisicaoApi } from "./api";

describe("requisicaoApi", () => {
  it("após 401 renova e repete uma vez com o token novo", async () => {
    const opcoesTokens: Array<{ forcarRenovacao?: boolean } | undefined> = [];
    const requisicoes: Headers[] = [];
    const respostas = [new Response(null, { status: 401 }), new Response(null, { status: 200 })];
    const requisicao = criarRequisicaoApi({
      async obterToken(opcoes) {
        opcoesTokens.push(opcoes);
        return opcoes?.forcarRenovacao ? "token-novo" : "token-antigo";
      },
      async fetch(_url, opcoes) {
        requisicoes.push(new Headers(opcoes?.headers));
        return respostas.shift()!;
      },
      registrarFalha() {
        throw new Error("não deve registrar falha depois de um retry bem-sucedido");
      },
      urlBase: "https://api.exemplo",
    });

    const resposta = await requisicao("/recurso");

    assert.equal(resposta.status, 200);
    assert.equal(requisicoes.length, 2);
    assert.equal(requisicoes[0].get("Authorization"), "Bearer token-antigo");
    assert.equal(requisicoes[1].get("Authorization"), "Bearer token-novo");
    assert.equal(requisicoes[1].get("X-Auth-Retry"), "1");
    assert.deepEqual(opcoesTokens, [undefined, { forcarRenovacao: true }]);
  });

  it("segundo 401 retorna normalmente sem entrar em loop ou chamar signOut", async () => {
    let fetches = 0;
    let falhas = 0;
    let signOut = 0;
    const requisicao = criarRequisicaoApi({
      async obterToken(opcoes) {
        return opcoes?.forcarRenovacao ? "token-novo" : "token-antigo";
      },
      async fetch() {
        fetches++;
        return new Response(null, { status: 401 });
      },
      registrarFalha() {
        falhas++;
      },
      urlBase: "https://api.exemplo",
    });

    const resposta = await requisicao("/recurso");

    assert.equal(resposta.status, 401);
    assert.equal(fetches, 2);
    assert.equal(falhas, 1);
    assert.equal(signOut, 0);
  });

  it("respeita X-Auth-Retry pré-existente e não tenta novamente", async () => {
    let fetches = 0;
    let renovacoes = 0;
    const requisicao = criarRequisicaoApi({
      async obterToken(opcoes) {
        if (opcoes?.forcarRenovacao) renovacoes++;
        return "token";
      },
      async fetch() {
        fetches++;
        return new Response(null, { status: 401 });
      },
      registrarFalha() {},
      urlBase: "https://api.exemplo",
    });

    await requisicao("/recurso", { headers: { "X-Auth-Retry": "1" } });

    assert.equal(fetches, 1);
    assert.equal(renovacoes, 0);
  });
});
