import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { NOMES_ETAPAS_CURTOS } from "@/constantes/fluxo-aprovacao";
import { fluxoEstaCancelado, obterEstadoVisualEtapaFluxo } from "@/utilitarios/etapa-atual-workflow";
import {
  decidirAtualizacaoWorkflows,
  encontrarWorkflowDoRegistro,
  normalizarListaWorkflows,
} from "@/utilitarios/workflows-aprovacao";

function ler(relativo: string): string {
  return readFileSync(resolve(process.cwd(), relativo), "utf8");
}

const hook = ler("frontend/src/hooks/useAplicacao.ts");
const handleSave = hook.slice(
  hook.indexOf("const handleSave"),
  hook.indexOf("const handleSaveApprovalConfig"),
);
const handleDelete = hook.slice(
  hook.indexOf("const handleDelete"),
  hook.indexOf("const handleCancelRequest"),
);
const handleCancelRequest = hook.slice(
  hook.indexOf("const handleCancelRequest"),
  hook.indexOf("const handleSave"),
);
const handleUpdateStatus = hook.slice(
  hook.indexOf("const handleUpdateStatus"),
  hook.indexOf("const handleResetStatus"),
);
const tryUpdateStatus = handleUpdateStatus.slice(
  0,
  handleUpdateStatus.lastIndexOf("} catch (error"),
);
const catchUpdateStatus = handleUpdateStatus.slice(
  handleUpdateStatus.lastIndexOf("} catch (error"),
);
const atualizacaoCompleta = hook.slice(
  hook.indexOf("const executarAtualizacaoCompleta"),
  hook.indexOf("const atualizarDadosDaAplicacao"),
);

/** Resposta de /api/workflow/summary logo após o init do fluxo da nova solicitação. */
const respostaApiWorkflowSummary = [
  {
    id: "wf-1",
    ia_record_id: "IA-00000042",
    current_step: 1,
    final_status: "pendente",
    steps: [
      { step_number: 1, role_name: "Coordenador NIT", status: "aguardando" },
      { step_number: 2, role_name: "Gerente TI", status: "aguardando" },
    ],
  },
];

describe("sincronização da etapa atual após criar uma solicitação", () => {
  it("A) a criação grava o registro e inicializa o fluxo pela API", () => {
    const posicaoRegistro = handleSave.indexOf("addRecord(record");
    const posicaoInit = handleSave.indexOf("ROTAS_API.WORKFLOW_INIT");

    assert.ok(posicaoRegistro >= 0, "criação do registro ausente");
    assert.ok(posicaoInit > posicaoRegistro, "o fluxo deve ser inicializado depois do registro");
    assert.match(
      handleSave,
      /if \(!initRes\.ok\)[\s\S]*throw new Error\([\s\S]*inicializar o fluxo de aprovação/,
    );
  });

  it("B/C/D) registros e fluxos são recarregados juntos, depois da inicialização", () => {
    const posicaoInit = handleSave.indexOf("ROTAS_API.WORKFLOW_INIT");
    const posicaoAtualizacao = handleSave.indexOf("await atualizarDadosDaAplicacao()");
    const posicaoNavegacao = handleSave.indexOf('navegarPara("inventory")');

    assert.ok(posicaoAtualizacao > posicaoInit, "a atualização precisa ocorrer após o init");
    assert.ok(posicaoNavegacao > posicaoAtualizacao, "o Inventário só abre com os dados já atualizados");
    assert.doesNotMatch(handleSave, /await refreshRecords\(\)/);

    assert.match(atualizacaoCompleta, /const data = await getRecords\(/);
    assert.match(atualizacaoCompleta, /setRecords\(data\)/);
    assert.match(atualizacaoCompleta, /await loadApprovalData\(\)/);

    assert.match(hook, /const atualizarDadosDaAplicacao = \(\) => atualizacaoCoordenada\.forcar\(\)/);
    assert.match(hook, /const refreshRecords = \(\) => atualizacaoCoordenada\.reaproveitar\(\)/);
  });

  it("E/F) o Inventário associa o fluxo novo pelo ID e mostra Etapa 1: NIT", () => {
    const workflows = normalizarListaWorkflows(respostaApiWorkflowSummary);
    const workflow = encontrarWorkflowDoRegistro(workflows, "ia-00000042");

    assert.ok(workflow, "fluxo recém-criado não foi associado ao registro");
    assert.equal(workflow.currentStep, 1);
    assert.equal(
      `Etapa ${workflow.currentStep}: ${NOMES_ETAPAS_CURTOS[workflow.currentStep]}`,
      "Etapa 1: NIT",
    );
    assert.equal(obterEstadoVisualEtapaFluxo(1, workflow), "atual");
    assert.equal(obterEstadoVisualEtapaFluxo(2, workflow), "neutro");
  });

  it("G/H) a correção não usa recarregamento de página nem espera artificial", () => {
    assert.doesNotMatch(hook, /window\.location\.reload/);
    assert.doesNotMatch(handleSave, /setTimeout/);
    assert.doesNotMatch(atualizacaoCompleta, /setTimeout/);
  });

  it("I) fluxo cancelado continua cancelado após a atualização", () => {
    const [cancelado] = normalizarListaWorkflows([
      {
        ia_record_id: "IA-00000042",
        current_step: 2,
        final_status: "cancelado",
        steps: [
          { step_number: 1, role_name: "Coordenador NIT", status: "aprovado" },
          { step_number: 2, role_name: "Gerente TI", status: "aguardando" },
        ],
      },
    ]);

    assert.equal(fluxoEstaCancelado(cancelado), true);
    assert.equal(obterEstadoVisualEtapaFluxo(1, cancelado), "aprovado");
    assert.equal(obterEstadoVisualEtapaFluxo(2, cancelado), "neutro");
  });

  it("J) fallback vazio não apaga os fluxos já carregados; a API segue sendo a fonte", () => {
    const atuais = normalizarListaWorkflows(respostaApiWorkflowSummary);

    assert.deepEqual(decidirAtualizacaoWorkflows(atuais, [], false), atuais);
    assert.deepEqual(decidirAtualizacaoWorkflows(atuais, [], true), []);

    assert.match(hook, /ROTAS_API\.WORKFLOW_SUMMARY/);
    assert.match(hook, /origemResumosConfiavel = true/);
    assert.match(hook, /decidirAtualizacaoWorkflows\(atuais, resumosCarregados, origemResumosConfiavel\)/);
  });

  it("respostas fora de ordem não sobrescrevem a leitura mais recente", () => {
    assert.match(hook, /const requisicao = controleAprovacoes\.iniciar\(\)/);
    assert.match(hook, /if \(!controleAprovacoes\.estaAtual\(requisicao\)\) return;\s*\n\s*setWorkflows/);
    assert.match(hook, /setWorkflowSummaries/);
    assert.match(atualizacaoCompleta, /if \(!controleRegistros\.estaAtual\(requisicao\)\) return;\s*\n\s*setRecords/);
  });

  it("cancelamento força releitura só depois do sucesso da API", () => {
    const posicaoCancel = handleCancelRequest.indexOf("ROTAS_API.WORKFLOW_CANCEL");
    const posicaoThrow = handleCancelRequest.indexOf("if (!response.ok)");
    const posicaoAtualizacao = handleCancelRequest.indexOf("await atualizarDadosDaAplicacao()");

    assert.ok(posicaoCancel >= 0);
    assert.ok(posicaoThrow > posicaoCancel);
    assert.ok(posicaoAtualizacao > posicaoThrow);
    assert.doesNotMatch(handleCancelRequest, /await refreshRecords\(\)/);
    assert.doesNotMatch(handleCancelRequest, /navegarPara\(/);
  });

  it("exclusão força releitura só depois do DELETE bem-sucedido", () => {
    const posicaoDelete = handleDelete.indexOf("method: \"DELETE\"");
    const posicaoThrow = handleDelete.indexOf("if (!response.ok)");
    const posicaoAtualizacao = handleDelete.indexOf("await atualizarDadosDaAplicacao()");

    assert.ok(posicaoDelete >= 0);
    assert.ok(posicaoThrow > posicaoDelete);
    assert.ok(posicaoAtualizacao > posicaoThrow);
    assert.doesNotMatch(handleDelete, /await refreshRecords\(\)/);
    assert.doesNotMatch(handleDelete, /navegarPara\(/);
  });

  it("alteração de status força releitura só depois da decisão gravada", () => {
    const posicaoDecide = tryUpdateStatus.indexOf("ROTAS_API.WORKFLOW_DECIDE");
    const posicaoOk = tryUpdateStatus.indexOf("if (!response.ok)");
    const posicaoAtualizacao = tryUpdateStatus.indexOf("await atualizarDadosDaAplicacao()");

    assert.ok(posicaoDecide >= 0);
    assert.ok(posicaoOk > posicaoDecide);
    assert.ok(posicaoAtualizacao > posicaoOk);
    assert.doesNotMatch(tryUpdateStatus, /await refreshRecords\(\)/);
    assert.doesNotMatch(tryUpdateStatus, /navegarPara\(/);
    assert.match(catchUpdateStatus, /await refreshRecords\(\);\s*throw error;/);
  });

  it("leituras normais continuam reaproveitando a atualização em voo", () => {
    assert.match(hook, /const refreshRecords = \(\) => atualizacaoCoordenada\.reaproveitar\(\)/);
    assert.match(
      hook,
      /if \(user\?\.id && profile\) \{\s*setRecordsCarregados\(false\);\s*refreshRecords\(\);/,
    );
  });

  it("criação, cancelamento, exclusão e status não usam reload nem espera artificial", () => {
    assert.doesNotMatch(hook, /window\.location\.reload/);
    assert.doesNotMatch(handleSave, /setTimeout/);
    assert.doesNotMatch(handleDelete, /setTimeout/);
    assert.doesNotMatch(handleCancelRequest, /setTimeout/);
    assert.doesNotMatch(handleUpdateStatus, /setTimeout/);
    assert.doesNotMatch(atualizacaoCompleta, /setTimeout/);
  });
});
