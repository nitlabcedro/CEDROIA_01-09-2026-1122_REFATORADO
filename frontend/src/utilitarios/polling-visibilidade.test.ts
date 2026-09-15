import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  INTERVALO_HEARTBEAT_PRESENCA_MS,
  INTERVALO_PENDENCIAS_TI_MS,
  documentoEstaOculto,
  registrarPollingComVisibilidade,
  type DocumentoVisibilidadePolling,
  type JanelaPolling,
} from "./polling-visibilidade";

type DocumentoMock = DocumentoVisibilidadePolling & {
  disparar: (tipo: string) => void;
  definirOculto: (valor: boolean) => void;
};

type JanelaMock = JanelaPolling & {
  avancarTempo: (ms: number) => void;
  quantidadeTimersAtivos: () => number;
};

function criarDocumentoMock(ocultoInicial = false): DocumentoMock {
  let oculto = ocultoInicial;
  const ouvintes = new Map<string, Set<() => void>>();

  const documento: DocumentoMock = {
    get hidden() {
      return oculto;
    },
    get visibilityState() {
      return oculto ? "hidden" : "visible";
    },
    addEventListener(tipo: string, ouvinte: () => void) {
      if (!ouvintes.has(tipo)) ouvintes.set(tipo, new Set());
      ouvintes.get(tipo)!.add(ouvinte);
    },
    removeEventListener(tipo: string, ouvinte: () => void) {
      ouvintes.get(tipo)?.delete(ouvinte);
    },
    disparar(tipo: string) {
      for (const ouvinte of ouvintes.get(tipo) ?? []) ouvinte();
    },
    definirOculto(valor: boolean) {
      oculto = valor;
    },
  };

  return documento;
}

function criarJanelaMock(): JanelaMock {
  let proximoId = 1;
  const timers = new Map<number, { callback: () => void; ms: number }>();

  const janela: JanelaMock = {
    setInterval(callback: () => void, ms: number) {
      const id = proximoId++;
      timers.set(id, { callback, ms });
      return id;
    },
    clearInterval(id: number) {
      timers.delete(id);
    },
    avancarTempo(ms: number) {
      for (const { callback, ms: intervalo } of timers.values()) {
        if (ms >= intervalo) callback();
      }
    },
    quantidadeTimersAtivos() {
      return timers.size;
    },
  };

  return janela;
}

describe("polling-visibilidade", () => {
  it("documentoEstaOculto reflete hidden e visibilityState", () => {
    assert.equal(documentoEstaOculto({ hidden: true }), true);
    assert.equal(documentoEstaOculto({ hidden: false, visibilityState: "visible" }), false);
    assert.equal(documentoEstaOculto({ hidden: false, visibilityState: "hidden" }), true);
  });

  it("não executa polling enquanto o documento está oculto", () => {
    const documento = criarDocumentoMock(true);
    const janela = criarJanelaMock();
    let execucoes = 0;

    const controle = registrarPollingComVisibilidade({
      intervaloMs: 1000,
      executar: () => {
        execucoes += 1;
      },
      documento,
      janela,
      executarAoIniciar: true,
    });

    assert.equal(execucoes, 0);
    janela.avancarTempo(5000);
    assert.equal(execucoes, 0);

    controle.dispose();
  });

  it("sincroniza imediatamente ao voltar para visible", () => {
    const documento = criarDocumentoMock(true);
    const janela = criarJanelaMock();
    let execucoes = 0;

    const controle = registrarPollingComVisibilidade({
      intervaloMs: 60_000,
      executar: () => {
        execucoes += 1;
      },
      documento,
      janela,
      executarAoIniciar: false,
    });

    documento.definirOculto(false);
    documento.disparar("visibilitychange");
    assert.equal(execucoes, 1);

    controle.dispose();
  });

  it("mantém no máximo um timer ativo por controle", () => {
    const documento = criarDocumentoMock(false);
    const janela = criarJanelaMock();

    const controle = registrarPollingComVisibilidade({
      intervaloMs: 1000,
      executar: () => {},
      documento,
      janela,
      executarAoIniciar: false,
    });

    assert.equal(janela.quantidadeTimersAtivos(), 1);

    documento.definirOculto(true);
    documento.disparar("visibilitychange");
    assert.equal(janela.quantidadeTimersAtivos(), 0);

    documento.definirOculto(false);
    documento.disparar("visibilitychange");
    assert.equal(janela.quantidadeTimersAtivos(), 1);

    controle.dispose();
    assert.equal(janela.quantidadeTimersAtivos(), 0);
  });

  it("dispose cancela timer e impede novas execuções", () => {
    const documento = criarDocumentoMock(false);
    const janela = criarJanelaMock();
    let execucoes = 0;

    const controle = registrarPollingComVisibilidade({
      intervaloMs: 500,
      executar: () => {
        execucoes += 1;
      },
      documento,
      janela,
      executarAoIniciar: true,
    });

    assert.equal(execucoes, 1);
    controle.dispose();
    assert.equal(janela.quantidadeTimersAtivos(), 0);

    janela.avancarTempo(2000);
    assert.equal(execucoes, 1);
  });

  it("continua executando no intervalo com aba visível", () => {
    const documento = criarDocumentoMock(false);
    const janela = criarJanelaMock();
    let execucoes = 0;

    const controle = registrarPollingComVisibilidade({
      intervaloMs: 1000,
      executar: () => {
        execucoes += 1;
      },
      documento,
      janela,
      executarAoIniciar: true,
    });

    assert.equal(execucoes, 1);
    janela.avancarTempo(1000);
    assert.equal(execucoes, 2);
    janela.avancarTempo(1000);
    assert.equal(execucoes, 3);

    controle.dispose();
  });

  it("expõe intervalos oficiais de presença e pendências TI", () => {
    assert.equal(INTERVALO_HEARTBEAT_PRESENCA_MS, 60_000);
    assert.equal(INTERVALO_PENDENCIAS_TI_MS, 30_000);
  });
});
