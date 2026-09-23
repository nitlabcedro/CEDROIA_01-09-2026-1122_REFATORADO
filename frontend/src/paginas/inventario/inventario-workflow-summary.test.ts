import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  obterEstadoVisualEtapaFluxo,
  obterNomeEtapaAtualInventario,
} from "@/utilitarios/etapa-atual-workflow";
import { obterStatusPorWorkflow } from "@/utilitarios/status-solicitacao";
import { normalizarListaWorkflows } from "@/utilitarios/workflows-aprovacao";

const raiz = resolve(import.meta.dirname, "../../../..");
const hook = readFileSync(resolve(raiz, "frontend/src/hooks/useAplicacao.ts"), "utf8");
const aplicacao = readFileSync(resolve(raiz, "frontend/src/Aplicacao.tsx"), "utf8");
const inventario = readFileSync(resolve(raiz, "frontend/src/paginas/inventario/Inventario.tsx"), "utf8");
const paginaAprovacao = readFileSync(resolve(raiz, "frontend/src/paginas/aprovacoes/PaginaAprovacao.tsx"), "utf8");
const pareceres = readFileSync(resolve(raiz, "frontend/src/utilitarios/pareceres.ts"), "utf8");

function workflow(step: number, finalStatus = "pendente") {
  return normalizarListaWorkflows([{
    ia_record_id: "IA-1",
    current_step: step,
    final_status: finalStatus,
    steps: Array.from({ length: 5 }, (_, index) => ({
      step_number: index + 1,
      status: index + 1 < step ? "aprovado" : "aguardando",
    })),
  }])[0];
}

describe("Inventário usa resumo seguro do workflow", () => {
  it("mapeia current_step 1–5 para os nomes visuais oficiais", () => {
    assert.equal(obterNomeEtapaAtualInventario(1), "NIT");
    assert.equal(obterNomeEtapaAtualInventario(2), "TI");
    assert.equal(obterNomeEtapaAtualInventario(3), "Período de teste");
    assert.equal(obterNomeEtapaAtualInventario(4), "Presidência");
    assert.equal(obterNomeEtapaAtualInventario(5), "Financeiro");
  });

  it("mapeia estados finais para Aprovada Final, Não aprovada e Cancelada", () => {
    assert.equal(obterStatusPorWorkflow(workflow(5, "aprovado")), "Aprovada");
    assert.equal(obterStatusPorWorkflow(workflow(5, "negado")), "Não aprovada");
    assert.equal(obterStatusPorWorkflow(workflow(3, "cancelado")), "Cancelada");
    assert.match(inventario, /Aprovada Final/);
    assert.match(inventario, /Reprovada/);
    assert.match(inventario, /Cancelada/);
  });

  it("avanço NIT → TI atualiza etapa ativa e bolinhas", () => {
    const antes = workflow(1);
    const depois = workflow(2);
    assert.equal(obterEstadoVisualEtapaFluxo(1, antes), "atual");
    assert.equal(obterEstadoVisualEtapaFluxo(1, depois), "aprovado");
    assert.equal(obterEstadoVisualEtapaFluxo(2, depois), "atual");
  });

  it("avanço TI → Período de teste atualiza etapa ativa", () => {
    const depois = workflow(3);
    assert.equal(obterNomeEtapaAtualInventario(depois.currentStep), "Período de teste");
    assert.equal(obterEstadoVisualEtapaFluxo(2, depois), "aprovado");
    assert.equal(obterEstadoVisualEtapaFluxo(3, depois), "atual");
  });

  it("avanço Presidência → Financeiro atualiza etapa ativa", () => {
    const depois = workflow(5);
    assert.equal(obterNomeEtapaAtualInventario(depois.currentStep), "Financeiro");
    assert.equal(obterEstadoVisualEtapaFluxo(4, depois), "aprovado");
    assert.equal(obterEstadoVisualEtapaFluxo(5, depois), "atual");
  });

  it("decisão financeira final atualiza o estado visual terminal", () => {
    assert.equal(obterStatusPorWorkflow(workflow(5, "aprovado")), "Aprovada");
    assert.equal(obterStatusPorWorkflow(workflow(5, "negado")), "Não aprovada");
  });

  it("summary é separado da fila operacional e alimenta apenas o Inventário", () => {
    assert.match(hook, /ROTAS_API\.WORKFLOW_LIST/);
    assert.match(hook, /ROTAS_API\.WORKFLOW_SUMMARY/);
    assert.match(hook, /setWorkflows\(/);
    assert.match(hook, /setWorkflowSummaries\(/);
    assert.match(aplicacao, /<PaginaAprovacao[\s\S]*?workflows=\{workflows\}/);
    assert.match(aplicacao, /<Inventario[\s\S]*?workflows=\{workflowSummaries\}/);
  });

  it("após decisão força releitura do summary sem reload ou cache stale", () => {
    const inicio = hook.indexOf("const handleUpdateStatus");
    const fim = hook.indexOf("const handleResetStatus", inicio);
    const decidir = hook.slice(inicio, fim);

    assert.match(decidir, /await atualizarDadosDaAplicacao\(\)/);
    assert.match(hook, /const atualizarDadosDaAplicacao = \(\) => atualizacaoCoordenada\.forcar\(\)/);
    assert.doesNotMatch(decidir, /window\.location\.reload/);
  });

  it("frontend continua sem leitura direta das tabelas de workflow", () => {
    for (const fonte of [hook, inventario]) {
      assert.doesNotMatch(
        fonte,
        /\.from\([^)]*(fluxos_aprovacao|etapas_aprovacao|configuracao_aprovacao)/,
      );
    }
  });

  it("parecer executivo permanece íntegro", () => {
    assert.match(paginaAprovacao, /campoParecerJustificativo/);
    assert.match(paginaAprovacao, /validarEnvioParecerJustificativo/);
    assert.match(paginaAprovacao, /placeholderParecerJustificativo/);
    assert.match(paginaAprovacao, /montarComentarioParecerJustificativo/);
    assert.match(pareceres, /Parecer justificativo/);
  });
});
