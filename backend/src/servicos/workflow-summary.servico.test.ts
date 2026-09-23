import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  montarResumoWorkflow,
  usuarioPodeVisualizarResumoWorkflow,
} from "./aprovacao.servico";

const raiz = resolve(import.meta.dirname, "../../..");
const servico = readFileSync(resolve(raiz, "backend/src/servicos/aprovacao.servico.ts"), "utf8");
const rotas = readFileSync(resolve(raiz, "backend/src/rotas/aprovacoes.rotas.ts"), "utf8");

describe("GET /api/workflow/summary", () => {
  it("só permite resumos das IAs visíveis no Inventário", () => {
    const base = {
      userId: "user-1",
      role: "user",
      setores: "TI; Jurídico",
    };

    assert.equal(usuarioPodeVisualizarResumoWorkflow({
      ...base,
      registro: { owner_id: "user-1", unidade_setor: "Outro" },
    }), true);
    assert.equal(usuarioPodeVisualizarResumoWorkflow({
      ...base,
      registro: { owner_id: "user-2", unidade_setor: "ti" },
    }), true);
    assert.equal(usuarioPodeVisualizarResumoWorkflow({
      ...base,
      registro: { owner_id: "user-2", unidade_setor: "Financeiro" },
    }), false);
    assert.equal(usuarioPodeVisualizarResumoWorkflow({
      ...base,
      role: "moderator",
      registro: { owner_id: "user-2", unidade_setor: "Financeiro" },
    }), true);
    assert.equal(usuarioPodeVisualizarResumoWorkflow({
      ...base,
      role: "admin",
      registro: { owner_id: "user-2", unidade_setor: "Financeiro" },
    }), true);
  });

  it("retorna somente andamento e status resumidos das etapas", () => {
    const resumo = montarResumoWorkflow({
      id: "workflow-secreto",
      ia_record_id: "IA-10",
      current_step: 4,
      final_status: "pendente",
      completed_at: null,
      steps: [{
        step_number: 4,
        status: "aguardando",
        comment: "parecer sigiloso",
        assigned_user_id: "user-secret",
        assigned_user_name: "Nome secreto",
      }],
    });

    assert.deepEqual(resumo, {
      ia_record_id: "IA-10",
      current_step: 4,
      final_status: "pendente",
      steps: [{ step_number: 4, status: "aguardando" }],
    });
    const serializado = JSON.stringify(resumo);
    assert.doesNotMatch(serializado, /comment|parecer|assigned_user_id|assigned_user_name|workflow-secreto/);
  });

  it("a consulta do summary não seleciona parecer, responsável ou configuração", () => {
    const inicio = servico.indexOf("export async function resumirWorkflowsVisiveis");
    const fim = servico.indexOf("export async function inicializarWorkflow", inicio);
    const summary = servico.slice(inicio, fim);

    assert.match(summary, /\.select\(`ia_record_id, current_step, final_status, steps:/);
    assert.match(summary, /\(step_number,status\)/);
    assert.match(summary, /\.filter\(\(registro: any\) => usuarioPodeVisualizarResumoWorkflow\(/);
    assert.match(summary, /\.in\("ia_record_id", idsVisiveis\)/);
    assert.doesNotMatch(summary, /comment|assigned_user_id|assigned_user_name|CONFIGURACAO_APROVACAO|MENSAGENS_TI/);
    assert.match(rotas, /aprovacoesRotas\.get\("\/summary", resumir\)/);
  });

  it("/workflow/list mantém a fila operacional endurecida da Etapa 5B", () => {
    const inicio = servico.indexOf("export async function listarWorkflows");
    const fim = servico.indexOf("export async function resumirWorkflowsVisiveis", inicio);
    const listar = servico.slice(inicio, fim);

    assert.match(listar, /\.eq\("assigned_user_id", userId\)/);
    assert.match(listar, /\.eq\("final_status", "pendente"\)/);
    assert.match(listar, /filtrarWorkflowsVisiveis/);
    assert.doesNotMatch(listar, /REGISTROS_IA|WORKFLOW_SUMMARY/);
  });
});
