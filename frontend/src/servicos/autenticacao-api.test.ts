import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  criarObterAccessTokenParaApi,
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
    assert.equal(sessaoPrecisaRenovarToken(undefined, agora), false);
  });

  it("bloqueia novas chamadas workflow após 401 e libera após novo login", () => {
    liberarBloqueioAutenticacaoApi();
    assert.equal(workflowApiBloqueadaPorAutenticacao(), false);

    registrarFalhaAutenticacaoApi();
    assert.equal(workflowApiBloqueadaPorAutenticacao(), true);

    liberarBloqueioAutenticacaoApi();
    assert.equal(workflowApiBloqueadaPorAutenticacao(), false);
  });

  it("usa token válido longe da expiração sem refreshSession", async () => {
    let getSession = 0;
    let getUser = 0;
    let refreshSession = 0;
    const auth = {
      async getSession() {
        getSession++;
        return {
          data: {
            session: {
              access_token: "token-atual",
              expires_at: Math.floor(Date.now() / 1000) + 120,
            },
          },
          error: null,
        };
      },
      async getUser() {
        getUser++;
        throw new Error("getUser não deveria ser chamado");
      },
      async refreshSession() {
        refreshSession++;
        throw new Error("refreshSession não deveria ser chamado");
      },
    };

    const obterToken = criarObterAccessTokenParaApi(auth);
    assert.equal(await obterToken(), "token-atual");
    assert.equal(await obterToken(), "token-atual");
    assert.equal(getSession, 2);
    assert.equal(getUser, 0);
    assert.equal(refreshSession, 0);
  });

  it("renova uma vez token perto da expiração e usa o token novo", async () => {
    let refreshSession = 0;
    let sessao = {
      access_token: "token-antigo",
      expires_at: Math.floor(Date.now() / 1000) + 30,
    };
    const obterToken = criarObterAccessTokenParaApi({
      async getSession() {
        return { data: { session: sessao }, error: null };
      },
      async refreshSession() {
        refreshSession++;
        sessao = {
          access_token: "token-novo",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        };
        return { data: { session: sessao }, error: null };
      },
    });

    assert.equal(await obterToken(), "token-novo");
    assert.equal(refreshSession, 1);
  });

  it("não inicia refresh se o SDK já atualizou a sessão", async () => {
    let getSession = 0;
    let refreshSession = 0;
    const obterToken = criarObterAccessTokenParaApi({
      async getSession() {
        getSession++;
        if (getSession === 1) {
          return {
            data: {
              session: {
                access_token: "token-antigo",
                expires_at: Math.floor(Date.now() / 1000) + 20,
              },
            },
            error: null,
          };
        }
        return {
          data: {
            session: {
              access_token: "token-sdk",
              expires_at: Math.floor(Date.now() / 1000) + 3600,
            },
          },
          error: null,
        };
      },
      async refreshSession() {
        refreshSession++;
        throw new Error("refreshSession não deveria ser chamado");
      },
    });

    assert.equal(await obterToken(), "token-sdk");
    assert.equal(refreshSession, 0);
  });

  it("compartilha um único refresh entre 5 chamadas simultâneas", async () => {
    let refreshSession = 0;
    let concluirRefresh!: () => void;
    const esperaRefresh = new Promise<void>((resolve) => {
      concluirRefresh = resolve;
    });
    let sessao = {
      access_token: "token-antigo",
      expires_at: Math.floor(Date.now() / 1000) + 10,
    };
    const obterToken = criarObterAccessTokenParaApi({
      async getSession() {
        return { data: { session: sessao }, error: null };
      },
      async refreshSession() {
        refreshSession++;
        await esperaRefresh;
        sessao = {
          access_token: "token-novo",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        };
        return { data: { session: sessao }, error: null };
      },
    });

    const chamadas = Array.from({ length: 5 }, () => obterToken());
    await Promise.resolve();
    await Promise.resolve();
    concluirRefresh();

    assert.deepEqual(await Promise.all(chamadas), Array(5).fill("token-novo"));
    assert.equal(refreshSession, 1);
  });

  it("polls TI concorrentes usam o mesmo refresh single-flight", async () => {
    let refreshSession = 0;
    let sessao = {
      access_token: "token-poll",
      expires_at: Math.floor(Date.now() / 1000) + 30,
    };
    const obterToken = criarObterAccessTokenParaApi({
      async getSession() {
        return { data: { session: sessao }, error: null };
      },
      async refreshSession() {
        refreshSession++;
        await new Promise((resolve) => setTimeout(resolve, 5));
        sessao = {
          access_token: "token-poll-renovado",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        };
        return { data: { session: sessao }, error: null };
      },
    });

    const tokens = await Promise.all([obterToken(), obterToken(), obterToken()]);
    assert.deepEqual(tokens, Array(3).fill("token-poll-renovado"));
    assert.equal(refreshSession, 1);
  });

  it("falha transitória preserva token local e não chama signOut", async () => {
    let signOut = 0;
    const sessao = {
      access_token: "token-ainda-valido",
      expires_at: Math.floor(Date.now() / 1000) + 30,
    };
    const obterToken = criarObterAccessTokenParaApi({
      async getSession() {
        return { data: { session: sessao }, error: null };
      },
      async refreshSession() {
        throw new Error("rede indisponível");
      },
      async signOut() {
        signOut++;
      },
    } as any);

    assert.equal(await obterToken(), "token-ainda-valido");
    assert.equal(signOut, 0);
  });

  it("aceita token sem expires_at e retorna null para sessão inexistente", async () => {
    let refreshSession = 0;
    const comToken = criarObterAccessTokenParaApi({
      async getSession() {
        return { data: { session: { access_token: "sem-expiracao" } }, error: null };
      },
      async refreshSession() {
        refreshSession++;
        return { data: { session: null }, error: null };
      },
    });
    const semSessao = criarObterAccessTokenParaApi({
      async getSession() {
        return { data: { session: null }, error: null };
      },
      async refreshSession() {
        throw new Error("não deve renovar sem sessão");
      },
    });

    assert.equal(await comToken(), "sem-expiracao");
    assert.equal(refreshSession, 0);
    assert.equal(await semSessao(), null);
  });
});
