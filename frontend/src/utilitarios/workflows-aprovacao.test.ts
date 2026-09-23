import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";
import type { ApprovalWorkflow } from "@/tipos";
import { obterEstadoVisualEtapaFluxo } from "./etapa-atual-workflow";
import {
  decidirAtualizacaoWorkflows,
  encontrarWorkflowDoRegistro,
  mesclarEtapasEmFluxos,
  normalizarListaWorkflows,
} from "./workflows-aprovacao";

/** Resposta real de GET /api/workflow/list (linhas de fluxos_aprovacao com embed steps). */
const RESPOSTA_API_LISTA = [
  {
    id: "ace48cff-3204-40f0-a707-d95a20ca3109",
    ia_record_id: "IA-00000023",
    current_step: 1,
    final_status: "pendente",
    completed_at: null,
    steps: [
      { id: "s1", step_number: 1, role_name: "Coordenador NIT", status: "aguardando", workflow_id: "ace48cff-3204-40f0-a707-d95a20ca3109", ia_record_id: "IA-00000023", is_opinion_only: false },
      { id: "s2", step_number: 2, role_name: "Gerente TI", status: "aguardando", workflow_id: "ace48cff-3204-40f0-a707-d95a20ca3109", ia_record_id: "IA-00000023", is_opinion_only: false },
      { id: "s3", step_number: 3, role_name: "Período de Teste", status: "aguardando", workflow_id: "ace48cff-3204-40f0-a707-d95a20ca3109", ia_record_id: "IA-00000023", is_opinion_only: false },
      { id: "s4", step_number: 4, role_name: "Presidência", status: "aguardando", workflow_id: "ace48cff-3204-40f0-a707-d95a20ca3109", ia_record_id: "IA-00000023", is_opinion_only: false },
      { id: "s5", step_number: 5, role_name: "Direção Financeira", status: "aguardando", workflow_id: "ace48cff-3204-40f0-a707-d95a20ca3109", ia_record_id: "IA-00000023", is_opinion_only: false },
    ],
  },
  {
    id: "e00fb4f2-4745-407c-a22e-471fdab60a2d",
    ia_record_id: "IA-00000021",
    current_step: 1,
    final_status: "cancelado",
    completed_at: "2026-09-22T23:10:31.175+00:00",
    steps: [
      { id: "c1", step_number: 1, role_name: "Coordenador NIT", status: "aguardando", workflow_id: "e00fb4f2-4745-407c-a22e-471fdab60a2d", ia_record_id: "IA-00000021", is_opinion_only: false },
    ],
  },
];

describe("Associação entre registro e fluxo de aprovação persistido", () => {
  it("A. workflow existente é associado pelo ia_record_id correto", () => {
    const workflows = normalizarListaWorkflows(RESPOSTA_API_LISTA);

    const encontrado = encontrarWorkflowDoRegistro(workflows, "IA-00000023");
    assert.ok(encontrado, "IA-00000023 precisa encontrar o fluxo persistido");
    assert.equal(encontrado.iaRecordId, "IA-00000023");
    assert.equal(encontrado.currentStep, 1);
    assert.equal(encontrado.finalStatus, "pendente");
    assert.equal(encontrado.steps.length, 5);
    assert.equal(encontrado.steps[0].roleName, "NIT");
  });

  it("B. snake_case, camelCase e espaços não quebram a associação", () => {
    const camel = normalizarListaWorkflows([
      {
        iaRecordId: " ia-00000023 ",
        currentStep: "2",
        finalStatus: "pendente",
        steps: [{ stepNumber: "1", status: "aprovado" }, { stepNumber: "2", status: "aguardando" }],
      },
    ]);

    assert.equal(camel.length, 1);
    assert.equal(camel[0].iaRecordId, "IA-00000023");
    assert.equal(camel[0].currentStep, 2);
    assert.ok(encontrarWorkflowDoRegistro(camel, "IA-00000023"));
    assert.ok(encontrarWorkflowDoRegistro(camel, " IA-00000023 "));

    const semId = normalizarListaWorkflows([{ current_step: 1, final_status: "pendente" }]);
    assert.equal(semId.length, 0);
  });

  it("C. current_step 1 pendente → primeiro ponto ativo", () => {
    const workflows = normalizarListaWorkflows(RESPOSTA_API_LISTA);
    const fluxo = encontrarWorkflowDoRegistro(workflows, "IA-00000023");

    assert.equal(obterEstadoVisualEtapaFluxo(1, fluxo), "atual");
    assert.equal(obterEstadoVisualEtapaFluxo(2, fluxo), "neutro");
  });

  it("D. current_step 2 pendente → segundo ponto ativo", () => {
    const workflows = normalizarListaWorkflows([
      {
        ia_record_id: "IA-00000023",
        current_step: 2,
        final_status: "pendente",
        steps: [
          { step_number: 1, status: "aprovado" },
          { step_number: 2, status: "aguardando" },
        ],
      },
    ]);
    const fluxo = encontrarWorkflowDoRegistro(workflows, "IA-00000023");

    assert.equal(obterEstadoVisualEtapaFluxo(1, fluxo), "aprovado");
    assert.equal(obterEstadoVisualEtapaFluxo(2, fluxo), "atual");
  });

  it("E. workflow cancelado é encontrado e o inventário decide cancelamento antes de 'Análise inicial'", () => {
    const workflows = normalizarListaWorkflows(RESPOSTA_API_LISTA);
    const cancelado = encontrarWorkflowDoRegistro(workflows, "IA-00000021");

    assert.ok(cancelado);
    assert.equal(cancelado.finalStatus, "cancelado");

    const inventario = readFileSync(
      resolve(process.cwd(), "frontend/src/paginas/inventario/Inventario.tsx"),
      "utf8",
    );
    assert.ok(
      inventario.indexOf("if (isCancel)") < inventario.indexOf("if (!recordWorkflow)"),
      "o ramo de cancelamento precisa ser avaliado antes do ramo sem workflow",
    );
  });

  it("F. registro realmente sem workflow continua sem fluxo associado", () => {
    const workflows = normalizarListaWorkflows(RESPOSTA_API_LISTA);

    assert.equal(encontrarWorkflowDoRegistro(workflows, "IA-00000099"), undefined);
    assert.equal(encontrarWorkflowDoRegistro(workflows, ""), undefined);
    assert.equal(encontrarWorkflowDoRegistro([], "IA-00000023"), undefined);
  });

  it("G. refresh após criação carrega o workflow recém-criado e substitui o estado", () => {
    const anteriores: ApprovalWorkflow[] = [];
    const carregados = normalizarListaWorkflows(RESPOSTA_API_LISTA);

    const estado = decidirAtualizacaoWorkflows(anteriores, carregados, true);
    assert.equal(estado.length, 2);
    assert.ok(encontrarWorkflowDoRegistro(estado, "IA-00000023"));
  });

  it("H. leitura bloqueada por RLS não apaga os fluxos já carregados", () => {
    const anteriores = normalizarListaWorkflows(RESPOSTA_API_LISTA);

    const aposFalha = decidirAtualizacaoWorkflows(anteriores, [], false);
    assert.equal(aposFalha.length, 2);
    assert.ok(encontrarWorkflowDoRegistro(aposFalha, "IA-00000023"));

    const aposApiVazia = decidirAtualizacaoWorkflows(anteriores, [], true);
    assert.equal(aposApiVazia.length, 0);
  });

  it("I. leitura sem embed junta etapas por workflow_id e por ia_record_id", () => {
    const fluxos = [{ id: "wf-1", ia_record_id: "IA-00000023", current_step: 1, final_status: "pendente" }];
    const etapas = [
      { step_number: 1, status: "aguardando", workflow_id: "wf-1", ia_record_id: "IA-00000023" },
      { step_number: 2, status: "aguardando", workflow_id: "outro", ia_record_id: "IA-00000099" },
    ];

    const porIdDoFluxo = normalizarListaWorkflows(mesclarEtapasEmFluxos(fluxos, etapas));
    assert.equal(porIdDoFluxo[0].steps.length, 1);

    const semWorkflowId = normalizarListaWorkflows(mesclarEtapasEmFluxos(fluxos, [
      { step_number: 1, status: "aguardando", ia_record_id: "IA-00000023" },
    ]));
    assert.equal(semWorkflowId[0].steps.length, 1);
  });

  it("J. o hook só confia na API e não infere etapa pelo status_uso", () => {
    const hook = readFileSync(
      resolve(process.cwd(), "frontend/src/hooks/useAplicacao.ts"),
      "utf8",
    );
    const carregamento = hook.slice(
      hook.indexOf("const loadApprovalData"),
      hook.indexOf("const refreshRecords = "),
    );

    assert.match(carregamento, /origemWorkflowsConfiavel = true/);
    assert.match(carregamento, /decidirAtualizacaoWorkflows/);
    assert.doesNotMatch(carregamento, /statusUso|status_uso/);
  });
});
