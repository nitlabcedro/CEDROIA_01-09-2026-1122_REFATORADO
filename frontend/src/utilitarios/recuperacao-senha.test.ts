import assert from "node:assert/strict";
import { describe, it } from "node:test";

import * as recuperacaoSenha from "./recuperacao-senha";
import {
  CHAVE_RECUPERACAO_SENHA,
  aplicarEventoAutenticacao,
  ativarRecuperacaoSenha,
  concluirRedefinicaoSenha,
  decidirTelaAplicacao,
  lerRecuperacaoSenha,
  obterRecuperacaoDoEventoStorage,
} from "./recuperacao-senha";

function criarArmazenamento() {
  const dados = new Map<string, string>();
  return {
    dados,
    getItem: (chave: string) => dados.get(chave) ?? null,
    setItem: (chave: string, valor: string) => dados.set(chave, valor),
    removeItem: (chave: string) => dados.delete(chave),
  };
}

describe("política de recuperação de senha", () => {
  it("marca recovery pela URL antes de o cliente Supabase processar a sessão", () => {
    const armazenamento = criarArmazenamento();
    const chamadas: string[] = [];
    const inicializarPelaUrl = (
      recuperacaoSenha as typeof recuperacaoSenha & {
        inicializarRecuperacaoSenhaDaUrl: (
          href: string,
          armazenamento: ReturnType<typeof criarArmazenamento>,
          agora: number,
        ) => boolean;
      }
    ).inicializarRecuperacaoSenhaDaUrl;

    chamadas.push("bootstrap-url");
    const detectada = inicializarPelaUrl(
      "https://ia.labcedro.app/reset-password#access_token=segredo&type=recovery&refresh_token=outro-segredo",
      armazenamento,
      1_000,
    );
    chamadas.push("createClient");

    assert.equal(detectada, true);
    assert.deepEqual(chamadas, ["bootstrap-url", "createClient"]);
    assert.equal(lerRecuperacaoSenha(armazenamento, 2_000), "ativa");
    assert.doesNotMatch(
      armazenamento.getItem(CHAVE_RECUPERACAO_SENHA) ?? "",
      /segredo|access_token|refresh_token|jwt/i,
    );
  });

  it("não inicia recovery para login normal sem type=recovery", () => {
    const armazenamento = criarArmazenamento();
    const inicializarPelaUrl = (
      recuperacaoSenha as typeof recuperacaoSenha & {
        inicializarRecuperacaoSenhaDaUrl: (
          href: string,
          armazenamento: ReturnType<typeof criarArmazenamento>,
          agora: number,
        ) => boolean;
      }
    ).inicializarRecuperacaoSenhaDaUrl;

    assert.equal(
      inicializarPelaUrl(
        "https://ia.labcedro.app/painel#access_token=segredo&type=signup",
        armazenamento,
        1_000,
      ),
      false,
    );
    assert.equal(lerRecuperacaoSenha(armazenamento, 2_000), "ausente");
  });

  it("PASSWORD_RECOVERY ativa o modo sem converter SIGNED_IN normal em recovery", () => {
    assert.equal(aplicarEventoAutenticacao("PASSWORD_RECOVERY", false), true);
    assert.equal(aplicarEventoAutenticacao("SIGNED_IN", false), false);
    assert.equal(aplicarEventoAutenticacao("SIGNED_IN", true), true);
    assert.equal(aplicarEventoAutenticacao("TOKEN_REFRESHED", true), true);
    assert.equal(aplicarEventoAutenticacao("SIGNED_OUT", true), false);
  });

  it("sessão com usuário não libera privado durante recovery", () => {
    assert.equal(decidirTelaAplicacao({
      carregando: false,
      temUsuario: true,
      recuperacaoAtiva: true,
      pathname: "/painel",
    }), "redefinir-senha");
    assert.equal(decidirTelaAplicacao({
      carregando: false,
      temUsuario: true,
      recuperacaoAtiva: false,
      pathname: "/painel",
    }), "privada");
  });

  it("permite as duas formas da rota de redefinição e rejeita link sem contexto", () => {
    for (const pathname of ["/reset-password", "/reset-password/"]) {
      assert.equal(decidirTelaAplicacao({
        carregando: false,
        temUsuario: true,
        recuperacaoAtiva: true,
        pathname,
      }), "redefinir-senha");
      assert.equal(decidirTelaAplicacao({
        carregando: false,
        temUsuario: false,
        recuperacaoAtiva: false,
        pathname,
      }), "redefinir-senha-invalida");
    }
  });

  it("mantém o bloqueio no refresh quando sessão e marcador continuam válidos", () => {
    const armazenamento = criarArmazenamento();
    ativarRecuperacaoSenha(armazenamento, 10_000, 1_000);

    assert.equal(lerRecuperacaoSenha(armazenamento, 2_000), "ativa");
    assert.equal(decidirTelaAplicacao({
      carregando: false,
      temUsuario: true,
      recuperacaoAtiva: true,
      pathname: "/painel",
    }), "redefinir-senha");
  });

  it("sincroniza ativação e limpeza com outra aba sem armazenar credenciais", () => {
    const armazenamento = criarArmazenamento();
    ativarRecuperacaoSenha(armazenamento, 10_000, 1_000);
    const valor = armazenamento.getItem(CHAVE_RECUPERACAO_SENHA);

    assert.equal(obterRecuperacaoDoEventoStorage({
      key: CHAVE_RECUPERACAO_SENHA,
      newValue: valor,
    }, 2_000), true);
    assert.equal(obterRecuperacaoDoEventoStorage({
      key: CHAVE_RECUPERACAO_SENHA,
      newValue: null,
    }, 2_000), false);
    assert.doesNotMatch(valor ?? "", /password|senha|token|jwt|refresh|code/i);
  });

  it("trata marcador obsoleto como inseguro quando ainda existe sessão", () => {
    const armazenamento = criarArmazenamento();
    ativarRecuperacaoSenha(armazenamento, 2_000, 1_000);

    assert.equal(lerRecuperacaoSenha(armazenamento, 3_001), "obsoleta");
    assert.equal(decidirTelaAplicacao({
      carregando: false,
      temUsuario: true,
      recuperacaoAtiva: true,
      pathname: "/inventario",
    }), "redefinir-senha");
  });

  it("updateUser bem-sucedido encerra localmente e exige novo login", async () => {
    const chamadas: string[] = [];
    const armazenamento = criarArmazenamento();
    ativarRecuperacaoSenha(armazenamento, 10_000, 1_000);

    await concluirRedefinicaoSenha({
      novaSenha: "nova-senha-segura",
      updateUser: async () => {
        chamadas.push("updateUser");
        return { error: null };
      },
      signOut: async (opcoes) => {
        chamadas.push(`signOut:${opcoes.scope}`);
        return { error: null };
      },
      limparEstadoLocal: () => chamadas.push("limparEstadoLocal"),
      armazenamento,
    });

    assert.deepEqual(chamadas, [
      "updateUser",
      "signOut:local",
      "limparEstadoLocal",
    ]);
    assert.equal(lerRecuperacaoSenha(armazenamento, 2_000), "ausente");
    assert.equal(decidirTelaAplicacao({
      carregando: false,
      temUsuario: false,
      recuperacaoAtiva: false,
      pathname: "/",
    }), "login");
  });

  it("falha de updateUser não encerra prematuramente a recuperação", async () => {
    const armazenamento = criarArmazenamento();
    ativarRecuperacaoSenha(armazenamento, 10_000, 1_000);

    await assert.rejects(() => concluirRedefinicaoSenha({
      novaSenha: "nova-senha-segura",
      updateUser: async () => ({ error: new Error("falha técnica") }),
      signOut: async () => ({ error: null }),
      limparEstadoLocal: () => assert.fail("não deveria limpar"),
      armazenamento,
    }));
    assert.equal(lerRecuperacaoSenha(armazenamento, 2_000), "ativa");
  });

  it("consome a mensagem de sucesso depois do login normal", () => {
    const atualizarMensagem = (
      recuperacaoSenha as typeof recuperacaoSenha & {
        atualizarMensagemTransitoriaLogin: (
          atual: string | null,
          evento:
            | { tipo: "redefinicao-concluida"; mensagem: string }
            | { tipo: "login-normal-concluido" }
            | { tipo: "logout" },
        ) => string | null;
      }
    ).atualizarMensagemTransitoriaLogin;

    const apresentada = atualizarMensagem(null, {
      tipo: "redefinicao-concluida",
      mensagem: "Senha redefinida com sucesso. Faça login com sua nova senha.",
    });
    const consumida = atualizarMensagem(apresentada, {
      tipo: "login-normal-concluido",
    });
    const aposLogout = atualizarMensagem(consumida, { tipo: "logout" });

    assert.equal(
      apresentada,
      "Senha redefinida com sucesso. Faça login com sua nova senha.",
    );
    assert.equal(consumida, null);
    assert.equal(aposLogout, null);
  });
});
