import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { obterMensagemErroUsuario } from "./mensagens-erro";

describe("mensagens de erro destinadas ao usuário", () => {
  it("traduz credenciais inválidas", () => {
    assert.equal(
      obterMensagemErroUsuario(new Error("Invalid login credentials"), "login"),
      "E-mail ou senha incorretos.",
    );
  });

  it("traduz usuário já cadastrado", () => {
    assert.equal(
      obterMensagemErroUsuario({ message: "User already registered", name: "AuthApiError" }, "cadastro"),
      "Este e-mail já possui cadastro.",
    );
  });

  it("traduz e-mail ainda não confirmado", () => {
    assert.equal(
      obterMensagemErroUsuario("Email not confirmed", "login"),
      "Confirme seu e-mail antes de entrar.",
    );
  });

  it("traduz falha de banco durante o cadastro", () => {
    assert.equal(
      obterMensagemErroUsuario("Database error saving new user", "cadastro"),
      "Não foi possível concluir o cadastro. Verifique os dados e tente novamente.",
    );
  });

  it("traduz erros de rede", () => {
    assert.equal(
      obterMensagemErroUsuario(new TypeError("Failed to fetch"), "cadastro"),
      "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
    );
  });

  it("traduz indisponibilidade ou configuração do serviço", () => {
    assert.equal(
      obterMensagemErroUsuario({ message: "Service Unavailable", status: 503 }),
      "O serviço está temporariamente indisponível. Tente novamente em alguns instantes.",
    );
  });

  it("não devolve mensagem técnica desconhecida", () => {
    const mensagemTecnica = "PGRST204: column internal_secret does not exist";
    const resultado = obterMensagemErroUsuario({ message: mensagemTecnica }, "operacao");

    assert.equal(resultado, "Não foi possível concluir esta operação. Tente novamente.");
    assert.equal(resultado.includes("PGRST"), false);
    assert.equal(resultado.includes("internal_secret"), false);
  });

  it("preserva mensagens funcionais seguras dos blocos TI", () => {
    assert.equal(
      obterMensagemErroUsuario(
        new Error("Todas as perguntas precisam ser respondidas antes do envio."),
        "aprovacao",
      ),
      "Todas as perguntas precisam ser respondidas antes do envio.",
    );
    assert.equal(
      obterMensagemErroUsuario(
        new Error("Esta resposta já não pode mais ser alterada."),
        "aprovacao",
      ),
      "Esta resposta já não pode mais ser alterada.",
    );
  });

  it("distingue falta de permissão na comunicação de erro genérico do chat", () => {
    assert.equal(
      obterMensagemErroUsuario(
        new Error("Sem permissão para consultar estas interações."),
        "chat",
      ),
      "Você não possui permissão para acessar esta comunicação.",
    );
  });

  it("traduz senha igual à atual na redefinição", () => {
    const mensagemEsperada = "A nova senha deve ser diferente da senha atual.";
    const porCodigo = obterMensagemErroUsuario(
      { code: "same_password", message: "New password should be different from the old password." },
      "redefinicao-senha",
    );
    const porMensagem = obterMensagemErroUsuario(
      { name: "AuthApiError", message: "same_password" },
      "redefinicao-senha",
    );

    assert.equal(porCodigo, mensagemEsperada);
    assert.equal(porMensagem, mensagemEsperada);
    assert.equal(porCodigo.includes("AuthApiError"), false);
    assert.equal(porCodigo.includes("same_password"), false);
  });

  it("não expõe erro técnico ao falhar a redefinição", () => {
    const resultado = obterMensagemErroUsuario(
      new Error("AuthApiError: invalid JWT"),
      "redefinicao-senha",
    );

    assert.equal(resultado, "Não foi possível redefinir sua senha. Tente novamente.");
    assert.equal(resultado.includes("AuthApiError"), false);
    assert.equal(resultado.includes("JWT"), false);
  });
});
