/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizar,
  STATUS_GERAIS_OFICIAIS,
  ehStatusGeralOficial,
  obterStatusPorEtapa,
  obterStatusPorWorkflow,
  obterStatusGeralDoRegistro,
  obterStatusPorNegacaoEmEtapas,
  fluxoEncerrado,
  detectarDivergenciaEncerramentoNegado,
  rotuloStatusEtapa,
} from "./status-solicitacao.ts";

describe("status-solicitacao", () => {
  it("normaliza 'Não aprovada' corretamente sem confundir com 'Aprovada'", () => {
    assert.equal(normalizar("Não aprovada"), "Não aprovada");
    assert.equal(normalizar("Não aprovado"), "Não aprovada");
    assert.equal(normalizar("nao aprovada"), "Não aprovada");
    assert.equal(normalizar("nao aprovado"), "Não aprovada");
    assert.equal(normalizar("Negado"), "Não aprovada");
    assert.equal(normalizar("Aprovada"), "Aprovada");
    assert.equal(normalizar("Aprovado"), "Aprovada");
  });

  it("valida os cinco status gerais oficiais", () => {
    assert.deepEqual(STATUS_GERAIS_OFICIAIS, [
      "Em análise",
      "Em teste",
      "Aprovada",
      "Não aprovada",
      "Cancelada",
    ]);

    for (const status of STATUS_GERAIS_OFICIAIS) {
      assert.equal(normalizar(status), status);
      assert.equal(ehStatusGeralOficial(status), true);
    }
  });

  it("mapeia variantes legadas para os status oficiais", () => {
    assert.equal(normalizar("Em avaliação"), "Em análise");
    assert.equal(normalizar("Pendente"), "Em análise");
    assert.equal(normalizar("Em teste/piloto"), "Em teste");
    assert.equal(normalizar("Cancelada pelo solicitante"), "Cancelada");
    assert.equal(normalizar("Cancelado"), "Cancelada");
    assert.equal(normalizar("Aprovado com restrições"), "Aprovada");
    assert.equal(normalizar("Suspenso"), "Não aprovada");
  });

  it("determina status por etapa do workflow", () => {
    assert.equal(obterStatusPorEtapa(1), "Em análise");
    assert.equal(obterStatusPorEtapa(2), "Em análise");
    assert.equal(obterStatusPorEtapa(3), "Em teste");
    assert.equal(obterStatusPorEtapa(4), "Em análise");
    assert.equal(obterStatusPorEtapa(5), "Em análise");
  });

  it("determina status por workflow finalizado ou em andamento", () => {
    assert.equal(obterStatusPorWorkflow({ finalStatus: "aprovado" }), "Aprovada");
    assert.equal(obterStatusPorWorkflow({ finalStatus: "negado" }), "Não aprovada");
    assert.equal(obterStatusPorWorkflow({ finalStatus: "cancelado" }), "Cancelada");
    assert.equal(
      obterStatusPorWorkflow({ finalStatus: "pendente", currentStep: 3 }),
      "Em teste",
    );
    assert.equal(
      obterStatusPorWorkflow({ finalStatus: "pendente", currentStep: 1 }),
      "Em análise",
    );
    assert.equal(
      obterStatusPorWorkflow({ finalStatus: "pendente", currentStep: 4 }),
      "Em análise",
    );
    assert.equal(
      obterStatusPorWorkflow({ finalStatus: "pendente", currentStep: 5 }),
      "Em análise",
    );
  });

  it("prioriza workflow na etapa 3 para exibir 'Em teste'", () => {
    assert.equal(
      obterStatusGeralDoRegistro(
        { statusUso: "Em avaliação" },
        { finalStatus: "pendente", currentStep: 3 },
      ),
      "Em teste",
    );
  });

  it("não exibe 'Em teste' fora da etapa 3 quando há workflow", () => {
    assert.equal(
      obterStatusGeralDoRegistro(
        { statusUso: "Em teste/piloto" },
        { finalStatus: "pendente", currentStep: 2 },
      ),
      "Em análise",
    );
  });

  it("prioriza cancelamento final nas etapas 1 e 3 sobre status legados", () => {
    for (const currentStep of [1, 3]) {
      assert.equal(
        obterStatusGeralDoRegistro(
          { statusUso: "Em avaliação", statusAuditoria: "Pendente" },
          { finalStatus: "cancelado", currentStep },
        ),
        "Cancelada",
      );
    }
  });

  it("prioriza registro cancelado sobre currentStep de workflow legado pendente", () => {
    assert.equal(
      obterStatusGeralDoRegistro(
        { statusUso: "Cancelada" },
        { finalStatus: "pendente", currentStep: 3 },
      ),
      "Cancelada",
    );
  });

  it("prioriza todos os estados finais do workflow", () => {
    assert.equal(
      obterStatusGeralDoRegistro(
        { statusUso: "Em avaliação" },
        { finalStatus: "aprovado", currentStep: 5 },
      ),
      "Aprovada",
    );
    assert.equal(
      obterStatusGeralDoRegistro(
        { statusUso: "Aprovado" },
        { finalStatus: "negado", currentStep: 2 },
      ),
      "Não aprovada",
    );
  });

  it("prioriza statusAuditoria Negado sobre statusUso Em avaliação legado", () => {
    assert.equal(
      obterStatusGeralDoRegistro(
        { statusUso: "Em avaliação", statusAuditoria: "Negado" },
        { finalStatus: "pendente", currentStep: 1 },
      ),
      "Não aprovada",
    );
  });

  it("infere Não aprovada quando etapa NIT está negada mas final_status ainda pendente", () => {
    const workflow = {
      finalStatus: "pendente",
      currentStep: 1,
      steps: [{ stepNumber: 1, status: "negado", isOpinionOnly: false }],
    };
    assert.equal(
      obterStatusGeralDoRegistro({ statusUso: "Em avaliação" }, workflow),
      "Não aprovada",
    );
    assert.equal(fluxoEncerrado({ statusUso: "Em avaliação" }, workflow), true);
  });

  it("trata negativa da etapa financeira como Não aprovada mesmo com isOpinionOnly legado", () => {
    const workflow = {
      finalStatus: "pendente",
      currentStep: 5,
      steps: [{ stepNumber: 5, status: "negado", isOpinionOnly: true }],
    };
    assert.equal(obterStatusPorNegacaoEmEtapas(workflow), "Não aprovada");
    assert.equal(obterStatusGeralDoRegistro({ statusUso: "Em avaliação" }, workflow), "Não aprovada");
  });

  it("exibe status global Negada quando o Financeiro nega, inclusive em legado consultivo", () => {
    const workflow = {
      finalStatus: "aprovado",
      currentStep: 5,
      steps: [
        { stepNumber: 1, status: "aprovado", isOpinionOnly: false },
        { stepNumber: 2, status: "aprovado", isOpinionOnly: false },
        { stepNumber: 3, status: "aprovado", isOpinionOnly: false },
        { stepNumber: 4, status: "aprovado", isOpinionOnly: false },
        { stepNumber: 5, status: "negado", isOpinionOnly: true },
      ],
    };
    assert.equal(
      obterStatusGeralDoRegistro({ statusUso: "Aprovado", statusAuditoria: "Aprovado" }, workflow),
      "Não aprovada",
    );
    assert.equal(rotuloStatusEtapa({ status: "negado", isOpinionOnly: true }), "Negado");
    assert.equal(rotuloStatusEtapa({ status: "aprovado", isOpinionOnly: true }), "Aprovado");
    assert.equal(rotuloStatusEtapa({ status: "negado", isOpinionOnly: false }), "Negado");
  });

  it("detecta divergência crítica entre etapa negada e registro ainda em andamento", () => {
    const workflow = {
      finalStatus: "pendente",
      currentStep: 1,
      steps: [{ stepNumber: 1, status: "negado", isOpinionOnly: false }],
    };
    assert.equal(
      detectarDivergenciaEncerramentoNegado({ statusUso: "Em avaliação" }, workflow),
      true,
    );
    assert.equal(
      detectarDivergenciaEncerramentoNegado(
        { statusUso: "Não aprovado", statusAuditoria: "Negado" },
        { finalStatus: "negado", currentStep: 1, steps: workflow.steps },
      ),
      false,
    );
  });

  it("contagem de dashboard: 5 IAs com 1 negada em etapa", () => {
    const records = [
      { id: "1", statusUso: "Em avaliação" },
      { id: "2", statusUso: "Em avaliação" },
      { id: "3", statusUso: "Em avaliação" },
      { id: "4", statusUso: "Em avaliação" },
      { id: "5", statusUso: "Em avaliação" },
    ];
    const workflows = [
      { iaRecordId: "5", finalStatus: "pendente", currentStep: 1, steps: [{ stepNumber: 1, status: "negado" }] },
    ];
    let emAndamento = 0;
    let naoAprovadas = 0;
    for (const record of records) {
      const wf = workflows.find((w) => w.iaRecordId === record.id);
      const status = obterStatusGeralDoRegistro(record, wf);
      if (status === "Em análise" || status === "Em teste") emAndamento += 1;
      if (status === "Não aprovada") naoAprovadas += 1;
    }
    assert.equal(records.length, 5);
    assert.equal(emAndamento, 4);
    assert.equal(naoAprovadas, 1);
  });

  it("normaliza legado Em análise e Em andamento para o mesmo bucket", () => {
    assert.equal(normalizar("Em análise"), "Em análise");
    assert.equal(normalizar("Em andamento"), "Em análise");
  });
});
