import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { StatusUso, type ApprovalStep, type ApprovalWorkflow, type IARecord } from "@/tipos";
import { montarDadosRelatorioPdf } from "./dadosRelatorioPdf";

const record = {
  id: "IA-TESTE",
  nomeFerramenta: "Teste",
  statusUso: "Em avaliação",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  dataRegistro: "2026-01-01",
  responsavelPreenchimento: "Solicitante",
  unidadeSetor: "TI",
  descricaoAtividade: "Teste",
  objetivos: [],
  beneficiosEsperados: "Teste",
} as IARecord;

const step = (stepNumber: number, status: ApprovalStep["status"]): ApprovalStep => ({
  stepNumber,
  roleName: `Etapa ${stepNumber}`,
  status,
});

const statuses = (workflow: ApprovalWorkflow) =>
  montarDadosRelatorioPdf(record, workflow).assinaturas.map(({ stepNumber, status }) => ({
    stepNumber,
    status,
  }));

describe("dadosRelatorioPdf", () => {
  it("associa etapas por stepNumber mesmo quando o backend retorna fora de ordem", () => {
    const workflow: ApprovalWorkflow = {
      iaRecordId: record.id,
      currentStep: 5,
      finalStatus: "aprovado",
      steps: [step(5, "opiniao"), step(3, "aprovado"), step(1, "aprovado"), step(4, "aprovado"), step(2, "aprovado")],
    };

    assert.deepEqual(statuses(workflow), [1, 2, 3, 4, 5].map((stepNumber) => ({
      stepNumber,
      status: "Aprovado",
    })));
    assert.equal(montarDadosRelatorioPdf(record, workflow).status, "Aprovada");
  });

  it("preserva reprovação na etapa 1 sem inventar decisões posteriores", () => {
    const workflow: ApprovalWorkflow = {
      iaRecordId: record.id,
      currentStep: 1,
      finalStatus: "negado",
      steps: [step(1, "negado")],
    };

    assert.deepEqual(statuses(workflow), [
      { stepNumber: 1, status: "Negado" },
      ...[2, 3, 4, 5].map((stepNumber) => ({ stepNumber, status: "Não iniciada" })),
    ]);
    assert.equal(montarDadosRelatorioPdf(record, workflow).status, "Não aprovada");
  });

  it("preserva reprovação em etapa intermediária", () => {
    const workflow: ApprovalWorkflow = {
      iaRecordId: record.id,
      currentStep: 3,
      finalStatus: "negado",
      steps: [step(3, "negado"), step(1, "aprovado"), step(2, "aprovado")],
    };

    assert.deepEqual(statuses(workflow), [
      { stepNumber: 1, status: "Aprovado" },
      { stepNumber: 2, status: "Aprovado" },
      { stepNumber: 3, status: "Negado" },
      { stepNumber: 4, status: "Não iniciada" },
      { stepNumber: 5, status: "Não iniciada" },
    ]);
  });

  it("marca cancelamento na etapa 1", () => {
    const workflow: ApprovalWorkflow = {
      iaRecordId: record.id,
      currentStep: 1,
      finalStatus: "cancelado",
      steps: [step(1, "aguardando")],
    };

    assert.deepEqual(statuses(workflow), [
      { stepNumber: 1, status: "Cancelada" },
      ...[2, 3, 4, 5].map((stepNumber) => ({ stepNumber, status: "Não iniciada" })),
    ]);
    assert.equal(montarDadosRelatorioPdf(record, workflow).status, "Cancelada");
  });

  it("marca cancelamento na etapa 3 e mantém decisões anteriores reais", () => {
    const workflow: ApprovalWorkflow = {
      iaRecordId: record.id,
      currentStep: 3,
      finalStatus: "cancelado",
      steps: [step(3, "aguardando"), step(2, "aprovado"), step(1, "aprovado")],
    };

    assert.deepEqual(statuses(workflow), [
      { stepNumber: 1, status: "Aprovado" },
      { stepNumber: 2, status: "Aprovado" },
      { stepNumber: 3, status: "Cancelada" },
      { stepNumber: 4, status: "Não iniciada" },
      { stepNumber: 5, status: "Não iniciada" },
    ]);
  });

  it("usa o status geral cancelado como fallback para workflow legado pendente", () => {
    const registroCancelado = { ...record, statusUso: StatusUso.CANCELADA } as IARecord;
    const workflow: ApprovalWorkflow = {
      iaRecordId: record.id,
      currentStep: 3,
      finalStatus: "pendente",
      steps: [step(3, "aguardando"), step(1, "aprovado"), step(2, "aprovado")],
    };

    const dados = montarDadosRelatorioPdf(registroCancelado, workflow);
    assert.deepEqual(
      dados.assinaturas.map(({ stepNumber, status }) => ({ stepNumber, status })),
      [
        { stepNumber: 1, status: "Aprovado" },
        { stepNumber: 2, status: "Aprovado" },
        { stepNumber: 3, status: "Cancelada" },
        { stepNumber: 4, status: "Não iniciada" },
        { stepNumber: 5, status: "Não iniciada" },
      ],
    );
    assert.equal(dados.assinaturas.some(({ status }) => status === "Em andamento"), false);
  });
});
