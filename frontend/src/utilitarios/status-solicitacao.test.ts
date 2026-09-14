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
});
