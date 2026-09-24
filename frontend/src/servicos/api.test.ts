import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { criarRequisicaoApi } from "./api";

describe("requisicaoApi", () => {
  it("após 401 com token novo na sessão repete uma vez com o token novo", async () => {
    const tokens = ["token-antigo", "token-novo"];
    const requisicoes: Headers[] = [];
    const respostas = [new Response(null, { status: 401 }), new Response(null, { status: 200 })];
    const requisicao = criarRequisicaoApi({
      async obterToken() {
        return tokens.shift() ?? "token-novo";
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
  });

  it("401 com o mesmo token local válido não força refresh nem retry", async () => {
    let obterToken = 0;
    let fetches = 0;
    let falhas = 0;
    const requisicao = criarRequisicaoApi({
      async obterToken() {
        obterToken++;
        return "token-ainda-valido";
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
    assert.equal(fetches, 1);
    assert.equal(obterToken, 2);
    assert.equal(falhas, 1);
  });

  it("401 com token renovado ainda 401 não entra em loop", async () => {
    let fetches = 0;
    let falhas = 0;
    let signOut = 0;
    let obterToken = 0;
    const requisicao = criarRequisicaoApi({
      async obterToken() {
        obterToken++;
        return obterToken === 1 ? "token-antigo" : "token-novo";
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
    assert.equal(obterToken, 2);
    assert.equal(falhas, 1);
    assert.equal(signOut, 0);
  });

  it("HTTP 503 não tenta refresh nem retry", async () => {
    let obterToken = 0;
    let fetches = 0;
    let falhas = 0;
    const requisicao = criarRequisicaoApi({
      async obterToken() {
        obterToken++;
        return "token-valido";
      },
      async fetch() {
        fetches++;
        return new Response(null, { status: 503 });
      },
      registrarFalha() {
        falhas++;
      },
      urlBase: "https://api.exemplo",
    });

    const resposta = await requisicao("/recurso");

    assert.equal(resposta.status, 503);
    assert.equal(fetches, 1);
    assert.equal(obterToken, 1);
    assert.equal(falhas, 0);
  });

  it("erro de rede não tenta refresh nem chama signOut", async () => {
    let obterToken = 0;
    let signOut = 0;
    const requisicao = criarRequisicaoApi({
      async obterToken() {
        obterToken++;
        return "token-valido";
      },
      async fetch() {
        throw new TypeError("Failed to fetch");
      },
      registrarFalha() {
        throw new Error("não deve registrar falha em erro de rede");
      },
      urlBase: "https://api.exemplo",
    });

    await assert.rejects(() => requisicao("/recurso"), /Failed to fetch/);
    assert.equal(obterToken, 1);
    assert.equal(signOut, 0);
  });

  it("respeita X-Auth-Retry pré-existente e não tenta novamente", async () => {
    let fetches = 0;
    let obterToken = 0;
    const requisicao = criarRequisicaoApi({
      async obterToken() {
        obterToken++;
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
    assert.equal(obterToken, 1);
  });
});
