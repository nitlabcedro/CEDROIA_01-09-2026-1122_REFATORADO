import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  adaptarMensagensLegadasTI,
  chamarRpcCriarConversaTI,
  chamarRpcCriarBlocoTI,
  chamarRpcDecidirEtapaTI,
  chamarRpcEncerrarConversaTI,
  chamarRpcEnviarMensagemTI,
  chamarRpcFinalizarBlocoTI,
  chamarRpcSalvarRespostaBlocoTI,
  conversaEhPendenciaResponsavelTI,
  conversaEhPendenciaSolicitanteTI,
  estruturaChatAusente,
  formatarInteracao,
  identificarModoInteracaoTI,
  identificarPayloadCriacaoInteracaoTI,
  mapearErroRpcInteracaoTI,
  usuarioPodeConsultarInteracoesTI,
  validarMensagemComunicacaoTI,
  validarPerguntasBlocoTI,
  validarRespostaBlocoTI,
} from "./interacoes-ti.servico";

type ChamadaRpc = {
  funcao: string;
  parametros: Record<string, unknown>;
};

function criarClienteRpc(
  resultado: { data: unknown; error: unknown },
  chamadas: ChamadaRpc[],
) {
  return {
    rpc: async (funcao: string, parametros: Record<string, unknown>) => {
      chamadas.push({ funcao, parametros });
      return resultado;
    },
  };
}

describe("integração RPC das interações TI", () => {
  it("permite consulta global ao admin e preserva os demais limites", () => {
    assert.equal(usuarioPodeConsultarInteracoesTI({
      userId: "admin-1",
      role: "ADMIN",
      ownerId: null,
      responsavelTiId: "ti-1",
    }), true);
    assert.equal(usuarioPodeConsultarInteracoesTI({
      userId: "solicitante-1",
      role: "user",
      ownerId: null,
      responsavelTiId: "ti-1",
    }), false);
    assert.equal(usuarioPodeConsultarInteracoesTI({
      userId: "ti-1",
      role: "user",
      ownerId: "solicitante-1",
      responsavelTiId: "ti-1",
    }), true);
    assert.equal(usuarioPodeConsultarInteracoesTI({
      userId: "outro-1",
      role: "user",
      ownerId: "solicitante-1",
      responsavelTiId: "ti-1",
    }), false);
  });

  it("pending-ti inclui somente chat aberto no turno da TI", () => {
    assert.equal(conversaEhPendenciaResponsavelTI({ current_turn: "ti", closed_at: null }), true);
    assert.equal(conversaEhPendenciaResponsavelTI({ current_turn: "solicitante", closed_at: null }), false);
    assert.equal(conversaEhPendenciaResponsavelTI({ current_turn: null, closed_at: null, status: "respondida" }), false);
    assert.equal(conversaEhPendenciaResponsavelTI({ current_turn: "ti", closed_at: "2026-09-17T10:00:00Z" }), false);
  });

  it("mantém bloco parcial ou 5/5 não finalizado na pendência do solicitante", () => {
    assert.equal(conversaEhPendenciaSolicitanteTI({
      current_turn: "solicitante",
      closed_at: null,
      status: "aguardando_resposta",
      totalRespondidas: 1,
      totalPerguntas: 5,
    }), true);
    assert.equal(conversaEhPendenciaSolicitanteTI({
      current_turn: "solicitante",
      closed_at: null,
      status: "aguardando_resposta",
      totalRespondidas: 5,
      totalPerguntas: 5,
    }), true);
    assert.equal(conversaEhPendenciaSolicitanteTI({
      current_turn: "ti",
      closed_at: null,
      status: "respondida",
    }), false);
  });

  it("adapta perguntas legadas em mensagens sem duplicar conteúdo", () => {
    const conteudoLongo = "x".repeat(1200);
    const mensagens = adaptarMensagensLegadasTI({
      id: "rodada-legada",
      requested_by_id: "ti-1",
      requested_by_name: "Responsável TI",
      requester_id: "solicitante-1",
      created_at: "2026-09-17T10:00:00Z",
      questions: [{
        id: "pergunta-1",
        order_number: 1,
        question: conteudoLongo,
        answer: "Resposta",
        answered_at: "2026-09-17T10:05:00Z",
      }],
    });

    assert.deepEqual(mensagens.map((item) => item.id), [
      "legado-pergunta-pergunta-1",
      "legado-resposta-pergunta-1",
    ]);
    assert.equal(mensagens[0].content, conteudoLongo);
    assert.equal(mensagens[0].sequence_number, 1);
    assert.equal(mensagens[1].sequence_number, 2);
  });

  it("distingue payload de chat, bloco, ambíguo e ausente", () => {
    assert.deepEqual(
      identificarPayloadCriacaoInteracaoTI({ recordId: "ia-1", mensagem: " Nova pergunta " }),
      { modo: "chat", recordId: "ia-1", mensagem: "Nova pergunta" },
    );
    assert.deepEqual(
      identificarPayloadCriacaoInteracaoTI({ recordId: "ia-1", perguntas: [" Primeira ", "Segunda"] }),
      { modo: "bloco", recordId: "ia-1", perguntas: ["Primeira", "Segunda"] },
    );
    assert.equal(
      identificarPayloadCriacaoInteracaoTI({ recordId: "ia-1", mensagem: "x", perguntas: ["y"] }).modo,
      "invalido",
    );
    assert.equal(identificarPayloadCriacaoInteracaoTI({ recordId: "ia-1" }).modo, "invalido");
  });

  it("aceita blocos com 1 ou 10 perguntas e rejeita 11 ou pergunta acima de 1000", () => {
    assert.equal(validarPerguntasBlocoTI(["Pergunta"]).valido, true);
    assert.equal(validarPerguntasBlocoTI(Array.from({ length: 10 }, (_, i) => `Pergunta ${i}`)).valido, true);
    assert.equal(validarPerguntasBlocoTI(Array.from({ length: 11 }, (_, i) => `Pergunta ${i}`)).valido, false);
    assert.equal(validarPerguntasBlocoTI(["x".repeat(1001)]).valido, false);
    assert.equal(validarPerguntasBlocoTI(["   "]).valido, false);
  });

  it("valida respostas individuais entre 1 e 1000 caracteres", () => {
    assert.equal(validarRespostaBlocoTI(" Resposta "), "Resposta");
    assert.equal(validarRespostaBlocoTI(" "), null);
    assert.equal(validarRespostaBlocoTI("x".repeat(1001)), null);
  });

  it("detecta legado, chat e bloco sem mascarar modo misto", () => {
    assert.equal(identificarModoInteracaoTI({ current_turn: null, questions: [{}], messages: [] }), "legado");
    assert.equal(identificarModoInteracaoTI({ current_turn: "ti", questions: [], messages: [{}] }), "chat");
    assert.equal(identificarModoInteracaoTI({ current_turn: "solicitante", questions: [{}], messages: [] }), "bloco");
    assert.throws(
      () => identificarModoInteracaoTI({ current_turn: "ti", questions: [{}], messages: [{}] }),
      /DADOS_TI_MODO_MISTO/,
    );
  });

  it("normaliza bloco parcial sem criar mensagens sintéticas", () => {
    const bloco = formatarInteracao({
      id: "bloco-1",
      workflow_id: "workflow-1",
      ia_record_id: "ia-1",
      round_number: 2,
      requested_by_id: "ti-1",
      requested_by_name: "TI",
      requester_id: "solicitante-1",
      status: "aguardando_resposta",
      current_turn: "solicitante",
      closed_at: null,
      created_at: "2026-09-18T10:00:00Z",
      questions: [
        { id: "p1", request_id: "bloco-1", order_number: 1, question: "P1", answer: "R1" },
        { id: "p2", request_id: "bloco-1", order_number: 2, question: "P2", answer: null },
      ],
      messages: [],
    });

    assert.equal(bloco.modo, "bloco");
    assert.equal(bloco.estado, "aguardando_solicitante");
    assert.equal(bloco.totalPerguntas, 2);
    assert.equal(bloco.totalRespondidas, 1);
    assert.equal(bloco.todasRespondidas, false);
    assert.deepEqual(bloco.mensagens, []);
  });

  it("normaliza bloco finalizado no turno da TI", () => {
    const bloco = formatarInteracao({
      id: "bloco-1",
      workflow_id: "workflow-1",
      ia_record_id: "ia-1",
      round_number: 1,
      requested_by_id: "ti-1",
      requested_by_name: "TI",
      requester_id: "solicitante-1",
      status: "respondida",
      current_turn: "ti",
      closed_at: null,
      created_at: "2026-09-18T10:00:00Z",
      questions: [{ id: "p1", request_id: "bloco-1", order_number: 1, question: "P1", answer: "R1" }],
      messages: [],
    });
    assert.equal(bloco.estado, "aguardando_ti");
    assert.equal(bloco.todasRespondidas, true);
  });

  it("valida no backend conteúdo após trim entre 1 e 1000 caracteres", () => {
    assert.equal(validarMensagemComunicacaoTI("   "), null);
    assert.equal(validarMensagemComunicacaoTI(` ${"a".repeat(1000)} `)?.length, 1000);
    assert.equal(validarMensagemComunicacaoTI("a".repeat(1001)), null);
  });

  it("cria conversa por uma única RPC sem aceitar papel do HTTP", async () => {
    const chamadas: ChamadaRpc[] = [];
    const retorno = { id: "thread-1", current_turn: "solicitante" };

    const resultado = await chamarRpcCriarConversaTI(
      criarClienteRpc({ data: retorno, error: null }, chamadas),
      {
        recordId: "ia-1",
        userId: "user-ti",
        userName: "Responsável TI",
        mensagem: "Primeira pergunta",
      },
    );

    assert.deepEqual(resultado, retorno);
    assert.deepEqual(chamadas, [{
      funcao: "criar_conversa_comunicacao_ti",
      parametros: {
        p_ia_record_id: "ia-1",
        p_user_id: "user-ti",
        p_user_name: "Responsável TI",
        p_content: "Primeira pergunta",
      },
    }]);
  });

  it("envia mensagem e encerra somente por RPCs transacionais", async () => {
    const chamadas: ChamadaRpc[] = [];
    const cliente = criarClienteRpc({ data: { id: "thread-1" }, error: null }, chamadas);

    await chamarRpcEnviarMensagemTI(cliente, {
      solicitacaoId: "thread-1",
      userId: "user-1",
      mensagem: "Resposta",
    });
    await chamarRpcEncerrarConversaTI(cliente, {
      solicitacaoId: "thread-1",
      userId: "user-ti",
    });

    assert.deepEqual(chamadas, [
      {
        funcao: "enviar_mensagem_comunicacao_ti",
        parametros: {
          p_request_id: "thread-1",
          p_user_id: "user-1",
          p_content: "Resposta",
        },
      },
      {
        funcao: "encerrar_conversa_comunicacao_ti",
        parametros: {
          p_request_id: "thread-1",
          p_user_id: "user-ti",
        },
      },
    ]);
  });

  it("cria, salva e finaliza bloco somente pelas RPCs transacionais", async () => {
    const chamadas: ChamadaRpc[] = [];
    const cliente = criarClienteRpc({ data: { request: { id: "bloco-1" } }, error: null }, chamadas);

    await chamarRpcCriarBlocoTI(cliente, {
      recordId: "ia-1",
      userId: "ti-1",
      userName: "Responsável TI",
      perguntas: ["P1", "P2"],
    });
    await chamarRpcSalvarRespostaBlocoTI(cliente, {
      solicitacaoId: "bloco-1",
      perguntaId: "pergunta-2",
      userId: "solicitante-1",
      resposta: "Resposta parcial",
    });
    await chamarRpcFinalizarBlocoTI(cliente, {
      solicitacaoId: "bloco-1",
      userId: "solicitante-1",
    });

    assert.deepEqual(chamadas, [
      {
        funcao: "criar_bloco_perguntas_ti",
        parametros: {
          p_ia_record_id: "ia-1",
          p_user_id: "ti-1",
          p_user_name: "Responsável TI",
          p_questions: ["P1", "P2"],
        },
      },
      {
        funcao: "salvar_resposta_bloco_ti",
        parametros: {
          p_request_id: "bloco-1",
          p_question_id: "pergunta-2",
          p_user_id: "solicitante-1",
          p_answer: "Resposta parcial",
        },
      },
      {
        funcao: "finalizar_respostas_bloco_ti",
        parametros: {
          p_request_id: "bloco-1",
          p_user_id: "solicitante-1",
        },
      },
    ]);
  });

  it("decide a etapa 2 por RPC atômica com a checagem de pendência", async () => {
    const chamadas: ChamadaRpc[] = [];
    await chamarRpcDecidirEtapaTI(
      criarClienteRpc({ data: { final_status: "pendente", next_step: 3 }, error: null }, chamadas),
      {
        workflowId: "workflow-1",
        stepId: "step-2",
        userId: "user-ti",
        decision: "aprovado",
        comment: "Parecer",
        userName: "Responsável TI",
      },
    );

    assert.deepEqual(chamadas, [{
      funcao: "decidir_etapa_ti_comunicacao_segura",
      parametros: {
        p_workflow_id: "workflow-1",
        p_step_id: "step-2",
        p_user_id: "user-ti",
        p_decision: "aprovado",
        p_comment: "Parecer",
        p_user_name: "Responsável TI",
      },
    }]);
  });

  it("mapeia códigos funcionais estruturados para HTTP", () => {
    const casos = [
      ["MENSAGEM_INVALIDA", 400],
      ["WORKFLOW_INVALIDO", 400],
      ["NAO_AUTORIZADO", 403],
      ["THREAD_NAO_ENCONTRADA", 404],
      ["CONVERSA_ABERTA", 409],
      ["CONVERSA_ENCERRADA", 409],
      ["TURNO_INVALIDO", 409],
      ["MODO_LEGADO", 409],
      ["PENDENCIA_SOLICITANTE", 409],
      ["QUANTIDADE_PERGUNTAS_INVALIDA", 400],
      ["PERGUNTA_INVALIDA", 400],
      ["RESPOSTA_INVALIDA", 400],
      ["BLOCO_INCOMPLETO", 400],
      ["BLOCO_NAO_ENCONTRADO", 404],
      ["PERGUNTA_NAO_ENCONTRADA", 404],
      ["RESPOSTAS_IMUTAVEIS", 409],
      ["MODO_CHAT_SIMPLES", 409],
      ["MODO_BLOCO_PERGUNTAS", 409],
    ] as const;

    for (const [codigo, status] of casos) {
      assert.equal(
        mapearErroRpcInteracaoTI({ code: "P0001", details: codigo, message: "texto humano" }).status,
        status,
      );
    }
  });

  it("distingue ausência do chat novo de erro na estrutura legada", () => {
    assert.equal(
      estruturaChatAusente({
        code: "PGRST202",
        message: "Could not find function criar_conversa_comunicacao_ti",
      }),
      true,
    );
    assert.equal(
      estruturaChatAusente({ code: "PGRST205", message: "Could not find table perguntas_ti" }),
      false,
    );
  });

  it("propaga falha da RPC sem executar atualização complementar", async () => {
    const chamadas: ChamadaRpc[] = [];
    const erroRpc = { code: "P0001", details: "TURNO_INVALIDO", message: "Não é o turno esperado." };

    await assert.rejects(
      chamarRpcEnviarMensagemTI(
        criarClienteRpc({ data: null, error: erroRpc }, chamadas),
        { solicitacaoId: "thread-1", userId: "user-1", mensagem: "duplicada" },
      ),
      (erro: unknown) => erro === erroRpc,
    );

    assert.equal(chamadas.length, 1);
  });
});
