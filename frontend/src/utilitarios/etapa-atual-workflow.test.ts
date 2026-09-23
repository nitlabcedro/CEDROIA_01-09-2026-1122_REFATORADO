import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";
import type { ApprovalWorkflow } from "@/tipos";
import {
  obterEstadoVisualEtapaFluxo,
} from "./etapa-atual-workflow";

function workflow(parcial: Partial<ApprovalWorkflow>): ApprovalWorkflow {
  return {
    iaRecordId: "IA-00000001",
    currentStep: 1,
    finalStatus: "pendente",
    steps: [
      { stepNumber: 1, roleName: "NIT", status: "aguardando" },
      { stepNumber: 2, roleName: "TI", status: "aguardando" },
      { stepNumber: 3, roleName: "Período de Teste", status: "aguardando" },
      { stepNumber: 4, roleName: "Presidência", status: "aguardando" },
      { stepNumber: 5, roleName: "Financeiro", status: "aguardando" },
    ],
    ...parcial,
  };
}

describe("Etapa atual do workflow — representação visual", () => {
  it("A. current_step 1 + pendente → etapa 1 ativa", () => {
    const fluxo = workflow({ currentStep: 1, finalStatus: "pendente" });
    assert.equal(obterEstadoVisualEtapaFluxo(1, fluxo), "atual");
    assert.equal(obterEstadoVisualEtapaFluxo("1", fluxo), "atual");
    assert.equal(obterEstadoVisualEtapaFluxo(1, workflow({
      currentStep: "1" as unknown as number,
      finalStatus: "pendente",
    })), "atual");
  });

  it("B. current_step 2 + pendente → etapa 2 ativa", () => {
    const fluxo = workflow({
      currentStep: 2,
      finalStatus: "pendente",
      steps: [
        { stepNumber: 1, roleName: "NIT", status: "aprovado" },
        { stepNumber: 2, roleName: "TI", status: "aguardando" },
        { stepNumber: 3, roleName: "Período de Teste", status: "aguardando" },
        { stepNumber: 4, roleName: "Presidência", status: "aguardando" },
        { stepNumber: 5, roleName: "Financeiro", status: "aguardando" },
      ],
    });
    assert.equal(obterEstadoVisualEtapaFluxo(2, fluxo), "atual");
  });

  it("C. etapa aprovada → concluída", () => {
    const fluxo = workflow({
      currentStep: 2,
      finalStatus: "pendente",
      steps: [
        { stepNumber: 1, roleName: "NIT", status: "aprovado" },
        { stepNumber: 2, roleName: "TI", status: "aguardando" },
        { stepNumber: 3, roleName: "Período de Teste", status: "aguardando" },
        { stepNumber: 4, roleName: "Presidência", status: "aguardando" },
        { stepNumber: 5, roleName: "Financeiro", status: "aguardando" },
      ],
    });
    assert.equal(obterEstadoVisualEtapaFluxo(1, fluxo), "aprovado");
  });

  it("D. etapas futuras → neutras", () => {
    const fluxo = workflow({ currentStep: 1, finalStatus: "pendente" });
    assert.equal(obterEstadoVisualEtapaFluxo(2, fluxo), "neutro");
    assert.equal(obterEstadoVisualEtapaFluxo(3, fluxo), "neutro");
    assert.equal(obterEstadoVisualEtapaFluxo(4, fluxo), "neutro");
    assert.equal(obterEstadoVisualEtapaFluxo(5, fluxo), "neutro");
  });

  it("E. cancelado → nenhuma etapa ativa", () => {
    const fluxo = workflow({ currentStep: 1, finalStatus: "cancelado" });
    assert.equal(obterEstadoVisualEtapaFluxo(1, fluxo), "neutro");
    assert.equal(obterEstadoVisualEtapaFluxo(2, fluxo), "neutro");
    assert.equal(obterEstadoVisualEtapaFluxo(3, fluxo), "neutro");
    assert.equal(obterEstadoVisualEtapaFluxo(4, fluxo), "neutro");
    assert.equal(obterEstadoVisualEtapaFluxo(5, fluxo), "neutro");
  });

  it("F. não altera schema nem status permitidos de etapas_aprovacao", () => {
    const inventario = readFileSync(
      resolve(process.cwd(), "frontend/src/paginas/inventario/Inventario.tsx"),
      "utf8",
    );
    const helper = readFileSync(
      resolve(process.cwd(), "frontend/src/utilitarios/etapa-atual-workflow.ts"),
      "utf8",
    );
    const aprovacao = readFileSync(
      resolve(process.cwd(), "backend/src/servicos/aprovacao.servico.ts"),
      "utf8",
    );

    assert.doesNotMatch(helper, /em_andamento|"ativo"/);
    assert.doesNotMatch(inventario, /status:\s*["']ativo["']|status:\s*["']em_andamento["']/);
    assert.doesNotMatch(aprovacao, /ALTER TABLE[\s\S]*etapas_aprovacao/);
    assert.doesNotMatch(aprovacao, /CREATE POLICY|ENABLE ROW LEVEL SECURITY/);
  });

  it("G. inventário usa a regra visual e o cancelamento permanece por API", () => {
    const inventario = readFileSync(
      resolve(process.cwd(), "frontend/src/paginas/inventario/Inventario.tsx"),
      "utf8",
    );
    const hook = readFileSync(
      resolve(process.cwd(), "frontend/src/hooks/useAplicacao.ts"),
      "utf8",
    );

    assert.match(inventario, /obterEstadoVisualEtapaFluxo/);
    assert.match(inventario, /fluxoEstaCancelado/);
    assert.doesNotMatch(inventario, /inventario__texto-analise-inicial[\s\S]*Cancelad/);
    assert.match(hook, /ROTAS_API\.WORKFLOW_CANCEL/);
    const handleCancel = hook.slice(
      hook.indexOf("const handleCancelRequest"),
      hook.indexOf("const handleSave"),
    );
    assert.doesNotMatch(handleCancel, /TABELAS_SUPABASE\.REGISTROS_IA/);
  });
});
