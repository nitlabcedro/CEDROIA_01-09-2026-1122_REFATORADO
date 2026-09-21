import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import type { SolicitacaoInformacoesTI } from "../tipos";
import {
  criarBlocoPerguntasTI,
  encerrarConversaComunicacaoTI,
  enviarMensagemComunicacaoTI,
  finalizarBlocoRespostasTI,
  invalidarCachesInteracoesTI,
  listarPendenciasResponsavelTI,
  listarPendenciasTI,
  salvarRespostaBlocoTI,
} from "./interacoes-ti";

const interacao = {
  id: "conversa-1",
  workflowId: "workflow-1",
  iaRecordId: "record-1",
  numeroRodada: 1,
  solicitadoPorId: "ti-1",
  solicitadoPorNome: "TI",
  solicitanteId: "solicitante-1",
  status: "respondida",
  modo: "chat",
  estado: "aguardando_ti",
  turnoAtual: "ti",
  criadoEm: "2026-09-17T10:00:00Z",
  perguntas: [],
  mensagens: [],
  totalPerguntas: 0,
  totalRespondidas: 0,
  todasRespondidas: false,
} satisfies SolicitacaoInformacoesTI;

const fetchOriginal = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = fetchOriginal;
  invalidarCachesInteracoesTI();
});

describe("serviço de interações TI", () => {
  it("usa caches separados para pendências do solicitante e do responsável", async () => {
    const chamadas: string[] = [];
    globalThis.fetch = (async (entrada) => {
      chamadas.push(String(entrada));
      return new Response(JSON.stringify({ interactions: [interacao] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    await listarPendenciasTI();
    await listarPendenciasTI();
    await listarPendenciasResponsavelTI();
    await listarPendenciasResponsavelTI();

    assert.equal(chamadas.filter((url) => url.endsWith("/pending")).length, 1);
    assert.equal(chamadas.filter((url) => url.endsWith("/pending-ti")).length, 1);
  });

  it("invalida pendências depois de enviar mensagem e encerrar", async () => {
    let consultasPendencias = 0;
    globalThis.fetch = (async (entrada) => {
      const url = String(entrada);
      if (url.endsWith("/pending-ti")) {
        consultasPendencias += 1;
        return new Response(JSON.stringify({ interactions: [interacao] }), { status: 200 });
      }
      return new Response(JSON.stringify({ interaction: interacao }), { status: 200 });
    }) as typeof fetch;

    await listarPendenciasResponsavelTI();
    await enviarMensagemComunicacaoTI("conversa-1", "Nova pergunta");
    await listarPendenciasResponsavelTI();
    await encerrarConversaComunicacaoTI("conversa-1");
    await listarPendenciasResponsavelTI();

    assert.equal(consultasPendencias, 3);
  });

  it("usa endpoints próprios para criar, salvar e finalizar blocos", async () => {
    const chamadas: Array<{ url: string; method?: string; body?: string }> = [];
    globalThis.fetch = (async (entrada, init) => {
      chamadas.push({
        url: String(entrada),
        method: init?.method,
        body: String(init?.body || ""),
      });
      return new Response(JSON.stringify({ interaction: { ...interacao, modo: "bloco" } }), {
        status: 200,
      });
    }) as typeof fetch;

    await criarBlocoPerguntasTI("record-1", ["P1"]);
    await salvarRespostaBlocoTI("bloco-1", "pergunta-1", "R1");
    await finalizarBlocoRespostasTI("bloco-1");

    assert.deepEqual(chamadas.map(({ url, method }) => ({ url, method })), [
      { url: "/api/workflow/ti-interactions/blocks", method: "POST" },
      { url: "/api/workflow/ti-interactions/bloco-1/questions/pergunta-1", method: "PUT" },
      { url: "/api/workflow/ti-interactions/bloco-1/finalize", method: "POST" },
    ]);
    assert.match(chamadas[0].body || "", /"perguntas":\["P1"\]/);
    assert.match(chamadas[1].body || "", /"resposta":"R1"/);
  });
});
