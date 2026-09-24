import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { ETAPAS_APROVACAO_OFICIAIS } from "@/constantes/fluxo-aprovacao";
import { normalizarWorkflowAprovacao } from "@/utilitarios/workflows-aprovacao";

import {
  ABAS_RELATORIO_IA,
  ESTRUTURA_ABAS_RELATORIO_SEGMENTADO,
  ESTRUTURA_FLUXO_APROVACAO_CARD,
  ESTRUTURA_FLUXO_APROVACAO_HORIZONTAL,
  extrairTextoParecerPeriodoTeste,
  formatarDataRelatorio,
  obterDetalhesStatusEtapaRelatorio,
  obterEtapasWorkflowPorNumero,
  obterNumerosEtapasOficiaisOrdenados,
  obterRotuloEtapaFluxo,
} from "./relatorioVisao.util";

describe("relatorioVisao.util — estrutura da página de detalhes", () => {
  const visualizacao = readFileSync(
    fileURLToPath(new URL("./VisualizacaoRelatorio.tsx", import.meta.url)),
    "utf8",
  );

  it("define marcadores de estrutura para card do fluxo, lista horizontal e abas segmentadas", () => {
    assert.equal(ESTRUTURA_FLUXO_APROVACAO_CARD, "fluxo-aprovacao-card");
    assert.equal(ESTRUTURA_FLUXO_APROVACAO_HORIZONTAL, "fluxo-aprovacao-horizontal");
    assert.equal(ESTRUTURA_ABAS_RELATORIO_SEGMENTADO, "abas-relatorio-segmentado");
  });

  it("mantém as 8 abas oficiais na ordem esperada", () => {
    assert.deepEqual(
      ABAS_RELATORIO_IA.map((aba) => aba.id),
      ["visao-geral", "finalidade-uso", "nit", "ti", "periodo-teste", "presidencia", "financeiro", "relatorio"]
    );
    assert.deepEqual(
      ABAS_RELATORIO_IA.map((aba) => aba.label),
      ["Resumo", "Uso da IA", "NIT", "TI", "Período de Teste", "Presidência", "Financeiro", "Relatório"]
    );
  });

  it("seleciona os dados reais de cada etapa nova pelo número oficial", () => {
    const steps = [
      { stepNumber: 3, roleName: "Período de Teste", status: "aprovado" as const, comment: "Teste concluído" },
      { stepNumber: 4, roleName: "Presidência", status: "negado" as const, comment: "Parecer executivo" },
      { stepNumber: 5, roleName: "Direção Financeira", status: "aguardando" as const, comment: "Análise financeira" },
    ];

    assert.deepEqual(obterEtapasWorkflowPorNumero(steps, 3), [steps[0]]);
    assert.deepEqual(obterEtapasWorkflowPorNumero(steps, 4), [steps[1]]);
    assert.deepEqual(obterEtapasWorkflowPorNumero(steps, 5), [steps[2]]);
  });

  it("mapeia as cinco etapas oficiais aprovadas com todos os dados persistidos", () => {
    const workflow = normalizarWorkflowAprovacao({
      ia_record_id: "IA-00000083",
      current_step: 5,
      final_status: "aprovado",
      completed_at: "2026-09-23T18:00:00Z",
      steps: [1, 2, 3, 4, 5].map((stepNumber) => ({
        step_number: stepNumber,
        role_name: `Etapa ${stepNumber}`,
        assigned_user_name: `Responsável ${stepNumber}`,
        status: "aprovado",
        comment: `Parecer ${stepNumber}`,
        decided_at: `2026-09-23T1${stepNumber}:00:00Z`,
        is_opinion_only: false,
      })),
    });

    assert.ok(workflow);
    assert.equal(workflow.steps.length, 5);
    for (let stepNumber = 1; stepNumber <= 5; stepNumber += 1) {
      const [step] = obterEtapasWorkflowPorNumero(workflow.steps, stepNumber);
      assert.ok(step);
      assert.equal(step.status, "aprovado");
      assert.equal(step.assignedUserName, `Responsável ${stepNumber}`);
      assert.equal(step.comment, `Parecer ${stepNumber}`);
      assert.ok(step.decidedAt);
      assert.equal(
        obterDetalhesStatusEtapaRelatorio(step, workflow.currentStep, true).badgeText,
        "APROVADA",
      );
    }
  });

  it("retorna lista vazia quando os dados opcionais do workflow não existem", () => {
    assert.deepEqual(obterEtapasWorkflowPorNumero(undefined, 3), []);
    assert.deepEqual(obterEtapasWorkflowPorNumero(null, 4), []);
    assert.deepEqual(obterEtapasWorkflowPorNumero([], 5), []);
  });

  it("troca e renderiza todas as abas, preservando o painel do relatório", () => {
    assert.match(visualizacao, /setActiveTab\(tab\.id\)/);
    for (const aba of ABAS_RELATORIO_IA) {
      assert.match(visualizacao, new RegExp(`activeTab === "${aba.id}"`));
    }
    assert.match(visualizacao, /renderEtapaWorkflow\(3, "Período de Teste"/);
    assert.match(visualizacao, /renderEtapaWorkflow\(4, "Presidência"/);
    assert.match(visualizacao, /renderEtapaWorkflow\(5, "Financeiro"/);
    assert.match(visualizacao, /montarDadosRelatorioPdf\(record, workflow, approvalConfig\)/);
    assert.match(visualizacao, /handleDownloadPDF/);
  });

  it("exibe os dados da etapa e mantém perguntas e respostas da TI", () => {
    assert.match(visualizacao, /obterWorkflowRelatorio\(record\.id\)/);
    assert.match(visualizacao, /step\.assignedUserName/);
    assert.match(visualizacao, /formatarDataHora\(step\.decidedAt\)/);
    assert.match(visualizacao, /formatComment\(step\.comment, step\.stepNumber\)/);
    assert.match(visualizacao, /interacao\.perguntas\.map/);
    assert.match(visualizacao, /pergunta\.pergunta/);
    assert.match(visualizacao, /pergunta\.resposta/);
    assert.match(visualizacao, /etapas\.length > 0/);
    assert.doesNotMatch(visualizacao, /comentariosPorEtapa/);
  });

  it("formata data civil sem aplicar deslocamento de timezone", () => {
    assert.equal(formatarDataRelatorio("2026-09-23"), "23/09/2026");
  });

  it("expõe as 5 etapas oficiais em ordem numérica", () => {
    assert.deepEqual(obterNumerosEtapasOficiaisOrdenados(), [1, 2, 3, 4, 5]);
  });

  it("usa os rótulos de exibição oficiais de cada etapa no fluxo", () => {
    for (const etapa of ETAPAS_APROVACAO_OFICIAIS) {
      assert.equal(obterRotuloEtapaFluxo(etapa.stepNumber), etapa.displayName);
    }
  });

  it("omite metadados da etapa 3 e exibe só o texto do parecer", () => {
    assert.equal(
      extrairTextoParecerPeriodoTeste(
        "Etapa: Período de Teste\nRelatório do Período de Testes: Texto do parecer...",
      ),
      "Texto do parecer...",
    );
    assert.equal(
      extrairTextoParecerPeriodoTeste(
        "Etapa: Período de Teste\nRelatório do Período de Testes:\nPrimeiro parágrafo\n\nSegundo parágrafo",
      ),
      "Primeiro parágrafo\n\nSegundo parágrafo",
    );
    assert.equal(extrairTextoParecerPeriodoTeste("Etapa: Período de Teste"), "");
    assert.match(visualizacao, /stepNumber === 3/);
    assert.match(visualizacao, /extrairTextoParecerPeriodoTeste\(commentRaw\)/);
    assert.match(visualizacao, /renderEtapaWorkflow\(3, "Período de Teste"/);
  });
});
