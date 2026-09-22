import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  autorizarCancelamento,
  estadoFinalImpedeCancelamento,
  montarDadosRegistroCancelado,
  obterStatusGeralCancelamento,
  STATUS_USO_CANCELADA,
} from "./cancelamento-solicitacao.regras";

describe("autorizarCancelamento", () => {
  it("A — owner consegue cancelar o próprio registro", () => {
    const resultado = autorizarCancelamento({
      userId: "user-1",
      role: "usuario",
      ownerId: "user-1",
    });
    assert.equal(resultado.permitido, true);
    assert.equal(resultado.status, 200);
  });

  it("B — admin consegue cancelar", () => {
    const resultado = autorizarCancelamento({
      userId: "admin-1",
      role: "admin",
      ownerId: "user-1",
    });
    assert.equal(resultado.permitido, true);
  });

  it("C — usuário comum não cancela registro alheio", () => {
    const resultado = autorizarCancelamento({
      userId: "user-2",
      role: "coordenador nit",
      ownerId: "user-1",
    });
    assert.equal(resultado.permitido, false);
    assert.equal(resultado.status, 403);
  });

  it("D — owner_id null bloqueia usuário comum", () => {
    const resultado = autorizarCancelamento({
      userId: "user-1",
      role: "usuario",
      ownerId: null,
    });
    assert.equal(resultado.permitido, false);
    assert.equal(resultado.status, 403);
  });

  it("E — admin consegue cancelar owner_id null", () => {
    const resultado = autorizarCancelamento({
      userId: "admin-1",
      role: "admin",
      ownerId: null,
    });
    assert.equal(resultado.permitido, true);
  });

  it("não autoriza por nome ou e-mail — só owner_id e papel", () => {
    const fonte = autorizarCancelamento.toString();
    assert.equal(fonte.includes("email"), false);
    assert.equal(fonte.includes("full_name"), false);
    assert.match(fonte, /ownerId/);
    assert.match(fonte, /papelEhAdmin/);
  });
});

describe("estadoFinalImpedeCancelamento", () => {
  it("F — estados finais não podem ser cancelados", () => {
    assert.equal(estadoFinalImpedeCancelamento({
      workflowFinalStatus: "aprovado",
    }), true);
    assert.equal(estadoFinalImpedeCancelamento({
      workflowFinalStatus: "negado",
    }), true);
    assert.equal(estadoFinalImpedeCancelamento({
      workflowFinalStatus: "cancelado",
    }), true);
    assert.equal(estadoFinalImpedeCancelamento({
      statusUso: "Aprovada",
    }), true);
    assert.equal(estadoFinalImpedeCancelamento({
      statusUso: "Não aprovada",
    }), true);
    assert.equal(estadoFinalImpedeCancelamento({
      statusUso: STATUS_USO_CANCELADA,
    }), true);
    assert.equal(estadoFinalImpedeCancelamento({
      statusUso: "Em análise",
      workflowFinalStatus: null,
    }), false);
  });
});

describe("montarDadosRegistroCancelado", () => {
  it("J/K — não altera owner_id e acrescenta histórico coerente", () => {
    const agora = "2026-09-22T12:00:00.000Z";
    const resultado = montarDadosRegistroCancelado(
      {
        ownerId: "user-1",
        statusUso: "Em análise",
        historico: [{ date: "antes", action: "Criação", user: "user-1", message: "ok" }],
      },
      agora,
      "Maria",
    );

    assert.equal(resultado.ownerId, "user-1");
    assert.equal(resultado.statusUso, STATUS_USO_CANCELADA);
    assert.equal(resultado.updatedAt, agora);
    const historico = resultado.historico as Array<{ action: string; user: string }>;
    assert.equal(historico.length, 2);
    assert.equal(historico[1].action, "Solicitação cancelada");
    assert.equal(historico[1].user, "Maria");
    assert.equal(obterStatusGeralCancelamento({ statusUso: STATUS_USO_CANCELADA }), "Cancelada");
  });
});
