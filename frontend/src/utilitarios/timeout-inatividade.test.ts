import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DURACAO_INATIVIDADE_MS,
  EVENTOS_ATIVIDADE_HUMANA,
  criarControleTimeoutInatividade,
  interpretarTimestampAtividade,
  msRestantesInatividade,
  sessaoInativaExpirou,
  type AlvoEventosInatividade,
  type ArmazenamentoInatividade,
  type DocumentoInatividade,
} from "./timeout-inatividade";

function criarArmazenamento(inicial: Record<string, string> = {}): ArmazenamentoInatividade & { dados: Record<string, string> } {
  const dados = { ...inicial };
  return {
    dados,
    getItem(chave: string) {
      return Object.prototype.hasOwnProperty.call(dados, chave) ? dados[chave] : null;
    },
    setItem(chave: string, valor: string) {
      dados[chave] = valor;
    },
    removeItem(chave: string) {
      delete dados[chave];
    },
  };
}

function criarAlvo(): AlvoEventosInatividade & { disparar: (tipo: string, evento?: Event) => void } {
  const ouvintes = new Map<string, Set<EventListener>>();
  return {
    addEventListener(tipo, ouvinte) {
      if (!ouvintes.has(tipo)) ouvintes.set(tipo, new Set());
      ouvintes.get(tipo)!.add(ouvinte);
    },
    removeEventListener(tipo, ouvinte) {
      ouvintes.get(tipo)?.delete(ouvinte);
    },
    disparar(tipo, evento) {
      const sintetico = evento ?? new Event(tipo);
      for (const ouvinte of ouvintes.get(tipo) ?? []) ouvinte(sintetico);
    },
  };
}

describe("regras de inatividade", () => {
  it("usa exatamente 3 horas em milissegundos", () => {
    assert.equal(DURACAO_INATIVIDADE_MS, 10_800_000);
  });

  it("interpreta timestamp persistido e rejeita valores inválidos", () => {
    assert.equal(interpretarTimestampAtividade("1700000000000"), 1_700_000_000_000);
    assert.equal(interpretarTimestampAtividade(null), null);
    assert.equal(interpretarTimestampAtividade("abc"), null);
    assert.equal(interpretarTimestampAtividade("0"), null);
  });

  it("menos de 3 horas não expira; exatamente 3 horas expira", () => {
    const inicio = 1_000_000;
    assert.equal(sessaoInativaExpirou(inicio, inicio + DURACAO_INATIVIDADE_MS - 1), false);
    assert.equal(sessaoInativaExpirou(inicio, inicio + DURACAO_INATIVIDADE_MS), true);
    assert.equal(sessaoInativaExpirou(inicio, inicio + DURACAO_INATIVIDADE_MS + 5_000), true);
    assert.equal(msRestantesInatividade(inicio, inicio + 30 * 60 * 1000), DURACAO_INATIVIDADE_MS - 1_800_000);
  });

  it("não considera polling nem requisições como atividade humana", () => {
    assert.deepEqual([...EVENTOS_ATIVIDADE_HUMANA], [
      "pointerdown",
      "keydown",
      "touchstart",
      "scroll",
    ]);
    assert.equal(EVENTOS_ATIVIDADE_HUMANA.includes("fetch" as never), false);
    assert.equal(EVENTOS_ATIVIDADE_HUMANA.includes("message" as never), false);
    assert.equal(EVENTOS_ATIVIDADE_HUMANA.includes("mousemove" as never), false);
  });
});

describe("controle de timeout de inatividade", () => {
  it("login sem timestamp válido registra Date.now()", () => {
    const armazenamento = criarArmazenamento();
    let agora = 5_000;
    const controle = criarControleTimeoutInatividade({
      armazenamento,
      agora: () => agora,
      encerrarSessao() {},
      agendarTimeout() { return 1; },
      cancelarTimeout() {},
    });

    controle.iniciar();

    assert.equal(armazenamento.getItem("cedro_ultima_atividade"), "5000");
  });

  it("F5 reutiliza timestamp persistido e não reinicia as 3 horas", () => {
    const persistido = String(1_000);
    const armazenamento = criarArmazenamento({ cedro_ultima_atividade: persistido });
    let agora = 1_000 + 2.5 * 60 * 60 * 1000;
    const controle = criarControleTimeoutInatividade({
      armazenamento,
      agora: () => agora,
      encerrarSessao() {
        throw new Error("não deveria deslogar no reload");
      },
      agendarTimeout(_callback, ms) {
        assert.equal(ms, 30 * 60 * 1000);
        return 1;
      },
      cancelarTimeout() {},
    });

    controle.iniciar();

    assert.equal(armazenamento.getItem("cedro_ultima_atividade"), persistido);
  });

  it("atividade humana atualiza o timestamp e reinicia o prazo", () => {
    const armazenamento = criarArmazenamento();
    let agora = 10_000;
    const alvo = criarAlvo();
    const controle = criarControleTimeoutInatividade({
      armazenamento,
      agora: () => agora,
      alvoEventos: alvo,
      encerrarSessao() {},
      intervaloPersistenciaMs: 0,
      agendarTimeout() { return 1; },
      cancelarTimeout() {},
    });

    controle.iniciar();
    agora = 80_000;
    alvo.disparar("pointerdown");

    assert.equal(armazenamento.getItem("cedro_ultima_atividade"), "80000");
  });

  it("menos de 3 horas não desloga; 3 horas desloga uma vez com sessão local", async () => {
    const armazenamento = criarArmazenamento({ cedro_ultima_atividade: "1000" });
    let agora = 1000 + DURACAO_INATIVIDADE_MS - 1;
    let logouts = 0;
    const pendentes: Array<() => void> = [];
    const controle = criarControleTimeoutInatividade({
      armazenamento,
      agora: () => agora,
      encerrarSessao() {
        logouts++;
      },
      agendarTimeout(callback) {
        pendentes.push(callback);
        return pendentes.length;
      },
      cancelarTimeout() {},
    });

    controle.iniciar();
    assert.equal(logouts, 0);

    agora = 1000 + DURACAO_INATIVIDADE_MS;
    pendentes[0]();
    pendentes[0]();
    controle.verificarExpiracao();

    assert.equal(logouts, 1);
    assert.equal(armazenamento.getItem("cedro_ultima_atividade"), null);
  });

  it("atividade de outra aba atualiza o prazo via storage", () => {
    const armazenamento = criarArmazenamento({ cedro_ultima_atividade: "1000" });
    let agora = 2_000;
    let agendado = 0;
    const alvo = criarAlvo();
    const controle = criarControleTimeoutInatividade({
      armazenamento,
      agora: () => agora,
      alvoEventos: alvo,
      encerrarSessao() {
        throw new Error("não deveria deslogar");
      },
      agendarTimeout(_callback, ms) {
        agendado = ms;
        return 1;
      },
      cancelarTimeout() {},
    });

    controle.iniciar();
    agora = 50_000;
    armazenamento.setItem("cedro_ultima_atividade", "40000");
    alvo.disparar("storage", {
      key: "cedro_ultima_atividade",
      newValue: "40000",
    } as StorageEvent);

    assert.equal(agendado, DURACAO_INATIVIDADE_MS - (50_000 - 40_000));
  });

  it("retorno de aba suspensa desloga se as 3 horas já passaram", () => {
    const armazenamento = criarArmazenamento({ cedro_ultima_atividade: "1000" });
    let agora = 2_000;
    let logouts = 0;
    const documento: DocumentoInatividade & { disparar: () => void } = {
      hidden: true,
      addEventListener(_tipo, ouvinte) {
        this.disparar = () => ouvinte(new Event("visibilitychange"));
      },
      removeEventListener() {},
      disparar() {},
    };
    const controle = criarControleTimeoutInatividade({
      armazenamento,
      agora: () => agora,
      documento,
      encerrarSessao() {
        logouts++;
      },
      agendarTimeout() { return 1; },
      cancelarTimeout() {},
    });

    controle.iniciar();
    agora = 1000 + DURACAO_INATIVIDADE_MS + 10_000;
    documento.disparar();

    assert.equal(logouts, 1);
  });

  it("não chama refreshSession nem apaga tokens sb-*", () => {
    const armazenamento = criarArmazenamento({
      cedro_ultima_atividade: "1000",
      "sb-projeto-auth-token": "segredo",
    });
    let agora = 1000 + DURACAO_INATIVIDADE_MS;
    const chamadas: string[] = [];
    const controle = criarControleTimeoutInatividade({
      armazenamento,
      agora: () => agora,
      encerrarSessao() {
        chamadas.push("encerrar");
      },
      agendarTimeout() { return 1; },
      cancelarTimeout() {},
    });

    controle.iniciar();

    assert.deepEqual(chamadas, ["encerrar"]);
    assert.equal(armazenamento.getItem("sb-projeto-auth-token"), "segredo");
    assert.equal(armazenamento.getItem("cedro_ultima_atividade"), null);
  });
});
