import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  LIMITE_MENSAGEM_COMUNICACAO_TI,
  LIMITE_PERGUNTA_BLOCO_TI,
  LIMITE_RESPOSTA_BLOCO_TI,
  MAXIMO_PERGUNTAS_BLOCO_TI,
} from "../constantes/comunicacao-ti";
import { LIMITE_TEXTO_FLUXO_APROVACAO } from "../constantes/fluxo-aprovacao";
import type { MensagemComunicacaoTI, SolicitacaoInformacoesTI } from "../tipos";
import { obterMensagemErroUsuario } from "./mensagens-erro";
import {
  acaoResolveNotificacaoComunicacaoTI,
  calcularProgressoBlocoTI,
  consolidarHistoricoComunicacaoTI,
  criarTravaEnvioComunicacaoTI,
  mensagemComunicacaoTIValida,
  perguntasBlocoTIValidas,
  respostaBlocoTIValida,
  respostasLocaisBlocoTIValidas,
  salvarEFinalizarRespostasBlocoTI,
  usuarioPodeEscreverComunicacaoTI,
} from "./comunicacao-ti";

const mensagem = (
  id: string,
  sequencia: number,
  criadoEm: string,
  conteudo = id,
): MensagemComunicacaoTI => ({
  id,
  solicitacaoId: "rodada-1",
  sequencia,
  autorId: "autor-1",
  autorNome: "Pessoa",
  papelAutor: "ti",
  conteudo,
  criadoEm,
});

const rodada = (
  id: string,
  numeroRodada: number,
  mensagens: MensagemComunicacaoTI[],
  estado: SolicitacaoInformacoesTI["estado"] = "encerrada",
): SolicitacaoInformacoesTI => ({
  id,
  workflowId: "workflow-1",
  iaRecordId: "record-1",
  numeroRodada,
  solicitadoPorId: "ti-1",
  solicitadoPorNome: "TI",
  solicitanteId: "solicitante-1",
  status: estado === "aguardando_solicitante" ? "aguardando_resposta" : "respondida",
  modo: "chat",
  estado,
  turnoAtual: estado === "aguardando_solicitante"
    ? "solicitante"
    : estado === "aguardando_ti"
      ? "ti"
      : undefined,
  criadoEm: "2026-09-17T10:00:00.000Z",
  perguntas: [],
  mensagens,
  totalPerguntas: 0,
  totalRespondidas: 0,
  todasRespondidas: false,
});

describe("comunicação TI", () => {
  it("mantém limites independentes para chat e parecer", () => {
    assert.equal(LIMITE_MENSAGEM_COMUNICACAO_TI, 1000);
    assert.equal(LIMITE_PERGUNTA_BLOCO_TI, 1000);
    assert.equal(LIMITE_RESPOSTA_BLOCO_TI, 1000);
    assert.equal(MAXIMO_PERGUNTAS_BLOCO_TI, 10);
    assert.equal(LIMITE_TEXTO_FLUXO_APROVACAO, 2000);
  });

  it("valida criação de bloco entre 1 e 10 perguntas", () => {
    assert.equal(perguntasBlocoTIValidas(["Pergunta"]), true);
    assert.equal(perguntasBlocoTIValidas(Array(10).fill("Pergunta")), true);
    assert.equal(perguntasBlocoTIValidas(Array(11).fill("Pergunta")), false);
    assert.equal(perguntasBlocoTIValidas([" "]), false);
    assert.equal(perguntasBlocoTIValidas(["x".repeat(1001)]), false);
  });

  it("calcula progresso e exige save explícito válido", () => {
    assert.equal(respostaBlocoTIValida("x".repeat(1000)), true);
    assert.equal(respostaBlocoTIValida("x".repeat(1001)), false);
    assert.deepEqual(
      calcularProgressoBlocoTI([
        { resposta: "R1" },
        { resposta: "" },
        { resposta: " R3 " },
        { resposta: undefined },
        { resposta: "R5" },
      ]),
      { totalPerguntas: 5, totalRespondidas: 3, todasRespondidas: false },
    );
  });

  it("habilita envio apenas quando todas as respostas locais são válidas", () => {
    const perguntas = [{ id: "p1" }, { id: "p2" }];
    assert.equal(respostasLocaisBlocoTIValidas(perguntas, { p1: "R1", p2: "R2" }), true);
    assert.equal(respostasLocaisBlocoTIValidas(perguntas, { p1: "R1", p2: " " }), false);
    assert.equal(respostasLocaisBlocoTIValidas(perguntas, { p1: "R1" }), false);
    assert.equal(respostasLocaisBlocoTIValidas([], {}), false);
  });

  it("salva todas as respostas sequencialmente antes de finalizar", async () => {
    const eventos: string[] = [];
    const resultado = await salvarEFinalizarRespostasBlocoTI({
      perguntas: [{ id: "p1" }, { id: "p2" }],
      respostas: { p1: "R1", p2: "R2" },
      salvar: async (id, resposta) => {
        eventos.push(`salvar:${id}:${resposta}`);
      },
      finalizar: async () => {
        eventos.push("finalizar");
        return "enviado";
      },
    });

    assert.equal(resultado, "enviado");
    assert.deepEqual(eventos, ["salvar:p1:R1", "salvar:p2:R2", "finalizar"]);
  });

  it("falha em um salvamento impede a finalização", async () => {
    const eventos: string[] = [];
    await assert.rejects(
      salvarEFinalizarRespostasBlocoTI({
        perguntas: [{ id: "p1" }, { id: "p2" }],
        respostas: { p1: "R1", p2: "R2" },
        salvar: async (id) => {
          eventos.push(`salvar:${id}`);
          if (id === "p2") throw new Error("falha");
        },
        finalizar: async () => {
          eventos.push("finalizar");
          return "enviado";
        },
      }),
      /falha/,
    );
    assert.deepEqual(eventos, ["salvar:p1", "salvar:p2"]);
  });

  it("aceita 1000 caracteres e bloqueia 1001", () => {
    assert.equal(mensagemComunicacaoTIValida("a".repeat(1000)), true);
    assert.equal(mensagemComunicacaoTIValida("a".repeat(1001)), false);
  });

  it("preserva integralmente conteúdo legado maior que o limite", () => {
    const legado = "L".repeat(1400);
    const historico = consolidarHistoricoComunicacaoTI([
      { ...rodada("legado", 1, [mensagem("legado-msg", 1, "2026-09-17T09:00:00Z", legado)]), modo: "legado" },
    ]);
    assert.equal(historico[0].conteudo, legado);
  });

  it("ordena mensagens por rodada e sequência sem duplicar ids", () => {
    const repetida = mensagem("msg-2", 2, "2026-09-17T10:02:00Z");
    const historico = consolidarHistoricoComunicacaoTI([
      rodada("rodada-2", 2, [mensagem("msg-3", 1, "2026-09-17T11:00:00Z")]),
      rodada("rodada-1", 1, [repetida, mensagem("msg-1", 1, "2026-09-17T10:01:00Z"), repetida]),
    ]);
    assert.deepEqual(historico.map((item) => item.id), ["msg-1", "msg-2", "msg-3"]);
  });

  it("habilita escrita somente para o papel correspondente ao turno", () => {
    assert.equal(usuarioPodeEscreverComunicacaoTI("solicitante", rodada("r1", 1, [], "aguardando_solicitante")), true);
    assert.equal(usuarioPodeEscreverComunicacaoTI("ti", rodada("r1", 1, [], "aguardando_solicitante")), false);
    assert.equal(usuarioPodeEscreverComunicacaoTI("ti", rodada("r2", 2, [], "aguardando_ti")), true);
    assert.equal(usuarioPodeEscreverComunicacaoTI("solicitante", rodada("r2", 2, [], "aguardando_ti")), false);
    assert.equal(usuarioPodeEscreverComunicacaoTI("ti", rodada("r3", 3, [], "encerrada")), false);
  });

  it("mantém rodadas encerradas no histórico consolidado", () => {
    const historico = consolidarHistoricoComunicacaoTI([
      rodada("encerrada", 1, [mensagem("antiga", 1, "2026-09-16T10:00:00Z")]),
      rodada("aberta", 2, [mensagem("nova", 1, "2026-09-17T10:00:00Z")], "aguardando_solicitante"),
    ]);
    assert.deepEqual(historico.map((item) => item.id), ["antiga", "nova"]);
  });

  it("fechar ou apenas abrir o modal não resolve nenhuma pendência", () => {
    for (const papel of ["solicitante", "ti"] as const) {
      assert.equal(acaoResolveNotificacaoComunicacaoTI(papel, "abrir_modal"), false);
      assert.equal(acaoResolveNotificacaoComunicacaoTI(papel, "fechar_modal"), false);
    }
  });

  it("notificação do solicitante só é resolvida após enviar resposta", () => {
    assert.equal(acaoResolveNotificacaoComunicacaoTI("solicitante", "enviar_mensagem"), true);
    assert.equal(acaoResolveNotificacaoComunicacaoTI("solicitante", "salvar_resposta_bloco"), false);
    assert.equal(acaoResolveNotificacaoComunicacaoTI("solicitante", "finalizar_bloco"), true);
    assert.equal(acaoResolveNotificacaoComunicacaoTI("solicitante", "encerrar_conversa"), false);
  });

  it("notificação da TI só é resolvida após nova mensagem ou encerramento", () => {
    assert.equal(acaoResolveNotificacaoComunicacaoTI("ti", "enviar_mensagem"), true);
    assert.equal(acaoResolveNotificacaoComunicacaoTI("ti", "encerrar_conversa"), true);
  });

  it("bloqueia clique duplo enquanto o primeiro envio está em andamento", () => {
    const trava = criarTravaEnvioComunicacaoTI();
    assert.equal(trava.tentarIniciar(), true);
    assert.equal(trava.tentarIniciar(), false);
    trava.liberar();
    assert.equal(trava.tentarIniciar(), true);
  });

  it("não apresenta detalhes técnicos de banco ao usuário", () => {
    const mensagemUsuario = obterMensagemErroUsuario(
      new Error("P0001 constraint current_turn failed"),
      "chat",
    );
    assert.equal(mensagemUsuario, "Não foi possível concluir a operação no chat. Tente novamente.");
  });
});
