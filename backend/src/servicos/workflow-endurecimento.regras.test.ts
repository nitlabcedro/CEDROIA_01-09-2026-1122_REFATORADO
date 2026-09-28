import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { ETAPAS_PADRAO_APROVACAO } from "../configuracoes/fluxo-aprovacao";
import {
  calcularResultadoDecisaoWorkflow,
  filtrarWorkflowsVisiveis,
  papelPodeRedefinirWorkflow,
  usuarioPodeInicializarWorkflow,
  validarAutorizacaoDecisao,
} from "./aprovacao.servico";

const fonte = readFileSync(
  fileURLToPath(new URL("./aprovacao.servico.ts", import.meta.url)),
  "utf8",
);

const workflows = [
  ...[1, 2, 3, 4, 5].map((current_step) => ({
    id: `pendente-${current_step}`,
    current_step,
    final_status: "pendente",
  })),
  { id: "aprovado-4", current_step: 4, final_status: "aprovado" },
  { id: "negado-4", current_step: 4, final_status: "negado" },
  { id: "cancelado-5", current_step: 5, final_status: "cancelado" },
];

describe("Etapa 5B — visibilidade institucional da fila", () => {
  it("NIT (etapa 1) acompanha todos os workflows ativos das etapas 1 a 5", () => {
    assert.deepEqual(
      filtrarWorkflowsVisiveis(workflows, [1]).map((workflow) => workflow.current_step),
      [1, 2, 3, 4, 5],
    );
  });

  it("TI (etapa 2) acompanha todos os workflows ativos, inclusive Presidência e Financeiro", () => {
    assert.deepEqual(
      filtrarWorkflowsVisiveis(workflows, [2]).map((workflow) => workflow.current_step),
      [1, 2, 3, 4, 5],
    );
  });

  it("Presidência acompanha todos os workflows ativos das etapas 1 a 5", () => {
    assert.deepEqual(
      filtrarWorkflowsVisiveis(workflows, [4]).map((workflow) => workflow.current_step),
      [1, 2, 3, 4, 5],
    );
  });

  it("Financeiro acompanha todos os workflows ativos das etapas 1 a 5", () => {
    assert.deepEqual(
      filtrarWorkflowsVisiveis(workflows, [5]).map((workflow) => workflow.current_step),
      [1, 2, 3, 4, 5],
    );
  });

  it("etapa 3 conserva escopo apenas na própria etapa e usuário sem atribuição não vê fila", () => {
    assert.deepEqual(filtrarWorkflowsVisiveis(workflows, [3]).map((workflow) => workflow.id), ["pendente-3"]);
    assert.deepEqual(filtrarWorkflowsVisiveis(workflows, []), []);
  });
});

describe("Etapa 5B — autorização de init, decide e reset", () => {
  const decisao = (
    userId: string,
    requestedStep: number,
    currentStep = 2,
    status = "aguardando",
    assignedUserId: string | null = "user-a",
    finalStatus = "pendente",
  ) => validarAutorizacaoDecisao({
    userId,
    requestedStep,
    workflow: { current_step: currentStep, final_status: finalStatus },
    step: { status, assigned_user_id: assignedUserId },
  });

  it("somente owner_id inicializa o próprio workflow", () => {
    assert.equal(usuarioPodeInicializarWorkflow("user-a", "user-a"), true);
    assert.equal(usuarioPodeInicializarWorkflow("user-a", "user-b"), false);
    assert.equal(usuarioPodeInicializarWorkflow("admin", "user-b"), false);
  });

  it("assigned decide a etapa atual; não assigned, admin e moderator sem atribuição não decidem", () => {
    assert.equal(decisao("user-a", 2).permitido, true);
    assert.equal(decisao("user-b", 2).status, 403);
    assert.equal(decisao("admin", 2).status, 403);
    assert.equal(decisao("moderator", 2).status, 403);
  });

  it("assigned não decide etapa futura nem anterior", () => {
    assert.equal(decisao("user-a", 3).status, 409);
    assert.equal(decisao("user-a", 1).status, 409);
  });

  it("etapa sem assigned ou sem status aguardando não aceita decisão", () => {
    assert.equal(decisao("user-a", 2, 2, "aguardando", null).status, 409);
    assert.equal(decisao("user-a", 2, 2, "aprovado").status, 409);
  });

  it("workflow aprovado, negado ou cancelado não aceita nova decisão", () => {
    for (const status of ["aprovado", "negado", "cancelado"]) {
      assert.equal(decisao("user-a", 2, 2, "aguardando", "user-a", status).status, 409);
    }
  });

  it("reset aceita exatamente admin", () => {
    assert.equal(papelPodeRedefinirWorkflow("admin"), true);
    assert.equal(papelPodeRedefinirWorkflow(" ADMIN "), true);
    assert.equal(papelPodeRedefinirWorkflow("user"), false);
    assert.equal(papelPodeRedefinirWorkflow("moderator"), false);
    assert.equal(papelPodeRedefinirWorkflow("administrador"), false);
    assert.equal(papelPodeRedefinirWorkflow("admin_nit"), false);
  });

  it("decide não aceita coordinatorData nem inicializa workflow implicitamente", () => {
    const decidir = fonte.slice(
      fonte.indexOf("export async function decidirWorkflow"),
      fonte.indexOf("export async function redefinirStatusWorkflow"),
    );
    assert.doesNotMatch(decidir, /coordinatorData/);
    assert.doesNotMatch(decidir, /Inicializando on-the-fly/);
    assert.doesNotMatch(decidir, /papelEhAdmin|papelEhCoordenadorNit/);
  });

  it("GET config é somente leitura", () => {
    const obterConfig = fonte.slice(
      fonte.indexOf("export async function obterConfiguracaoWorkflow"),
      fonte.indexOf("export async function salvarConfiguracaoWorkflow"),
    );
    assert.doesNotMatch(obterConfig, /\.(insert|update|upsert|delete)\s*\(/);
    assert.match(obterConfig, /X-Workflow-Config-Inconsistent/);
  });

  it("PUT config atualiza responsáveis apenas em etapas ainda aguardando", () => {
    const salvarConfig = fonte.slice(
      fonte.indexOf("export async function salvarConfiguracaoWorkflow"),
      fonte.indexOf("export async function listarWorkflows"),
    );
    assert.match(
      salvarConfig,
      /\.eq\("step_number", step\.step_number\)\s*\.eq\("status", "aguardando"\)/,
    );
  });
});

describe("Etapa 5B — Direção Financeira decisória", () => {
  const decidir = (
    currentStep: number,
    decision: "aprovado" | "negado",
    isOpinionOnly: boolean | null = currentStep === 5,
  ) => calcularResultadoDecisaoWorkflow({
    decision,
    currentStep,
    maxStep: 5,
    isOpinionOnly,
  });

  it("NIT nega e encerra o workflow como negado", () => {
    const resultado = decidir(1, "negado", false);
    assert.equal(resultado.stepStatus, "negado");
    assert.equal(resultado.finalStatus, "negado");
    assert.equal(resultado.statusUso, "Não aprovado");
    assert.equal(resultado.completed, true);
  });

  it("TI nega e encerra o workflow como negado", () => {
    const resultado = decidir(2, "negado", false);
    assert.equal(resultado.stepStatus, "negado");
    assert.equal(resultado.finalStatus, "negado");
    assert.equal(resultado.completed, true);
  });

  it("Período de Teste nega e encerra o workflow como negado", () => {
    const resultado = decidir(3, "negado", false);
    assert.equal(resultado.stepStatus, "negado");
    assert.equal(resultado.finalStatus, "negado");
    assert.equal(resultado.completed, true);
  });

  it("Presidência nega e encerra o workflow como negado", () => {
    const resultado = decidir(4, "negado", false);
    assert.equal(resultado.stepStatus, "negado");
    assert.equal(resultado.finalStatus, "negado");
    assert.equal(resultado.completed, true);
  });

  it("Financeiro aprova: etapa 5 aprovada, workflow e solicitação aprovados", () => {
    const resultado = decidir(5, "aprovado", false);
    assert.equal(resultado.stepStatus, "aprovado");
    assert.equal(resultado.finalStatus, "aprovado");
    assert.equal(resultado.statusAuditoria, "Aprovado");
    assert.equal(resultado.statusUso, "Aprovado");
    assert.equal(resultado.completed, true);
    assert.equal(resultado.nextStep, null);
  });

  it("Financeiro nega: etapa 5 negada, workflow e solicitação negados", () => {
    const resultado = decidir(5, "negado", false);
    assert.equal(resultado.stepStatus, "negado");
    assert.equal(resultado.finalStatus, "negado");
    assert.equal(resultado.statusAuditoria, "Negado");
    assert.equal(resultado.statusUso, "Não aprovado");
    assert.equal(resultado.completed, true);
    assert.equal(resultado.nextStep, null);
  });

  it("Financeiro nega preenche completed_at no fluxo", () => {
    const decidirFonte = fonte.slice(
      fonte.indexOf("export async function decidirWorkflow"),
      fonte.indexOf("export async function redefinirStatusWorkflow"),
    );
    assert.match(decidirFonte, /completed_at: new Date\(\)\.toISOString\(\)/);
    assert.equal(decidir(5, "negado", true).completed, true);
  });

  it("Financeiro nega e some da fila ativa", () => {
    const aposNegar = [
      { id: "fin-pendente", current_step: 5, final_status: "pendente" },
      { id: "fin-aprovado", current_step: 5, final_status: "aprovado" },
      { id: "fin-negado", current_step: 5, final_status: "negado" },
    ];
    assert.deepEqual(
      filtrarWorkflowsVisiveis(aposNegar, [5]).map((workflow) => workflow.id),
      ["fin-pendente"],
    );
  });

  it("histórico preserva decisão, status da etapa e final_status", () => {
    const decidirFonte = fonte.slice(
      fonte.indexOf("export async function decidirWorkflow"),
      fonte.indexOf("export async function redefinirStatusWorkflow"),
    );
    assert.match(decidirFonte, /stepStatus: resultado\.stepStatus/);
    assert.match(decidirFonte, /isOpinionOnly: Boolean\(currentStepData\.is_opinion_only\)/);
    assert.match(decidirFonte, /status: resultado\.stepStatus/);
    assert.match(decidirFonte, /finalStatus,/);
    assert.doesNotMatch(decidirFonte, /isFinancialStep/);
    assert.doesNotMatch(decidirFonte, /permanece aprovada/);
    assert.doesNotMatch(decidirFonte, /parecer desfavorável registrado por/);
    assert.doesNotMatch(decidirFonte, /etapaEhOpinativa/);
  });

  it("is_opinion_only legado não transforma negativa financeira em aprovação global", () => {
    assert.equal(decidir(5, "negado", true).finalStatus, "negado");
    assert.equal(decidir(5, "negado", false).finalStatus, "negado");
    assert.equal(decidir(5, "aprovado", true).finalStatus, "aprovado");
    assert.notEqual(decidir(5, "negado", true).finalStatus, "aprovado");
  });

  it("as 5 etapas oficiais são decisórias (is_opinion_only = false)", () => {
    assert.deepEqual(
      ETAPAS_PADRAO_APROVACAO.map((etapa) => etapa.is_opinion_only),
      [false, false, false, false, false],
    );
  });
});
