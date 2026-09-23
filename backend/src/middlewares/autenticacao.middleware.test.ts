import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NextFunction, Response } from "express";
import type { User } from "@supabase/supabase-js";

import {
  classificarFalhaAuth,
  criarMiddlewareAutenticar,
  falhaAuthETransitoria,
  falhaAuthRejeitaToken,
} from "./autenticacao.middleware";
import type { RequisicaoAutenticada } from "../tipos/requisicao";

type RespostaCapturada = {
  status: number;
  corpo: unknown;
};

function criarResposta() {
  const capturada: RespostaCapturada = { status: 0, corpo: null };
  const res = {
    status(codigo: number) {
      capturada.status = codigo;
      return this;
    },
    json(corpo: unknown) {
      capturada.corpo = corpo;
      return this;
    },
  } as Response;
  return { res, capturada };
}

function criarRequisicao(authorization?: string): RequisicaoAutenticada {
  return {
    headers: authorization ? { authorization } : {},
  } as RequisicaoAutenticada;
}

describe("classificação de falhas do Supabase Auth", () => {
  it("trata AuthRetryableFetchError, timeout, rede e 5xx como transitórios", () => {
    assert.equal(
      falhaAuthETransitoria({ name: "AuthRetryableFetchError", status: 0 }),
      true,
    );
    assert.equal(falhaAuthETransitoria({ name: "AuthError", status: 408 }), true);
    assert.equal(falhaAuthETransitoria({ name: "AuthError", statusCode: 503 }), true);
    assert.equal(falhaAuthETransitoria({ name: "AuthApiError", status: 502 }), true);
    assert.equal(falhaAuthETransitoria({ name: "AuthApiError", status: 429 }), true);
    assert.equal(classificarFalhaAuth(undefined), "indisponivel");
    assert.equal(classificarFalhaAuth("falha desconhecida"), "indisponivel");
  });

  it("trata JWT inválido, expirado ou rejeitado como token inválido", () => {
    assert.equal(
      falhaAuthRejeitaToken({ name: "AuthApiError", status: 401, code: "bad_jwt" }),
      true,
    );
    assert.equal(
      falhaAuthRejeitaToken({ name: "AuthApiError", status: 403 }),
      true,
    );
    assert.equal(
      falhaAuthRejeitaToken({ name: "AuthInvalidJwtError", status: 400, code: "invalid_jwt" }),
      true,
    );
    assert.equal(classificarFalhaAuth({ name: "AuthApiError", status: 401 }), "token_invalido");
    assert.equal(
      classificarFalhaAuth({ name: "AuthRetryableFetchError", status: 503 }),
      "indisponivel",
    );
  });

  it("não classifica falha desconhecida como token inválido", () => {
    assert.equal(falhaAuthRejeitaToken({ name: "Error" }), false);
    assert.equal(classificarFalhaAuth({ name: "Error" }), "indisponivel");
  });
});

describe("middleware autenticar", () => {
  it("Authorization ausente retorna 401", async () => {
    const autenticar = criarMiddlewareAutenticar(async () => {
      throw new Error("getUser não deve ser chamado sem Bearer");
    });
    const { res, capturada } = criarResposta();
    let nextChamado = 0;
    await autenticar(criarRequisicao(), res, (() => { nextChamado++; }) as NextFunction);

    assert.equal(capturada.status, 401);
    assert.deepEqual(capturada.corpo, {
      sucesso: false,
      mensagem: "Não autorizado: token ausente",
      error: "Unauthorized",
    });
    assert.equal(nextChamado, 0);
  });

  it("token inválido retorna 401 Invalid token", async () => {
    const autenticar = criarMiddlewareAutenticar(async () => ({
      data: { user: null },
      error: { name: "AuthApiError", status: 401, code: "bad_jwt" },
    }));
    const { res, capturada } = criarResposta();
    await autenticar(criarRequisicao("Bearer token-invalido"), res, (() => {}) as NextFunction);

    assert.equal(capturada.status, 401);
    assert.deepEqual(capturada.corpo, {
      sucesso: false,
      mensagem: "Token inválido ou expirado",
      error: "Invalid token",
    });
  });

  it("token expirado ou rejeitado retorna 401 Invalid token", async () => {
    const autenticar = criarMiddlewareAutenticar(async () => ({
      data: { user: null },
      error: { name: "AuthApiError", status: 403, code: "session_not_found" },
    }));
    const { res, capturada } = criarResposta();
    await autenticar(criarRequisicao("Bearer token-expirado"), res, (() => {}) as NextFunction);

    assert.equal(capturada.status, 401);
    assert.equal((capturada.corpo as { error: string }).error, "Invalid token");
  });

  it("falha retryable do Auth retorna 503", async () => {
    const autenticar = criarMiddlewareAutenticar(async () => ({
      data: { user: null },
      error: { name: "AuthRetryableFetchError", status: 0 },
    }));
    const { res, capturada } = criarResposta();
    await autenticar(criarRequisicao("Bearer token-valido"), res, (() => {}) as NextFunction);

    assert.equal(capturada.status, 503);
    assert.deepEqual(capturada.corpo, {
      sucesso: false,
      mensagem: "Autenticação temporariamente indisponível",
      error: "Auth service unavailable",
    });
  });

  it("erro 5xx do Auth retorna 503", async () => {
    const autenticar = criarMiddlewareAutenticar(async () => ({
      data: { user: null },
      error: { name: "AuthApiError", status: 502 },
    }));
    const { res, capturada } = criarResposta();
    await autenticar(criarRequisicao("Bearer token-valido"), res, (() => {}) as NextFunction);

    assert.equal(capturada.status, 503);
    assert.equal((capturada.corpo as { error: string }).error, "Auth service unavailable");
  });

  it("usuário válido segue para o próximo handler", async () => {
    const usuario = { id: "user-1", email: "a@b.c" } as User;
    const autenticar = criarMiddlewareAutenticar(async (token) => {
      assert.equal(token, "token-ok");
      return { data: { user: usuario }, error: null };
    });
    const req = criarRequisicao("Bearer token-ok");
    const { res, capturada } = criarResposta();
    let nextChamado = 0;
    await autenticar(req, res, (() => { nextChamado++; }) as NextFunction);

    assert.equal(nextChamado, 1);
    assert.equal(capturada.status, 0);
    assert.equal(req.usuarioAutenticado, usuario);
  });
});
