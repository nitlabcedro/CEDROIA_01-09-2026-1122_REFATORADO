import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const hook = readFileSync(
  fileURLToPath(new URL("./useAplicacao.ts", import.meta.url)),
  "utf8",
);
const pagina = readFileSync(
  fileURLToPath(new URL("../paginas/aprovacoes/PaginaAprovacao.tsx", import.meta.url)),
  "utf8",
);

describe("Etapa 5B — frontend usa exclusivamente a API do workflow", () => {
  it("não consulta diretamente as três tabelas de aprovação", () => {
    for (const tabela of [
      "CONFIGURACAO_APROVACAO",
      "FLUXOS_APROVACAO",
      "ETAPAS_APROVACAO",
      '"configuracao_aprovacao"',
      '"fluxos_aprovacao"',
      '"etapas_aprovacao"',
    ]) {
      assert.doesNotMatch(hook, new RegExp(`\\.from\\([^\\n]*${tabela}`));
    }
    assert.match(hook, /requisicaoApi\(ROTAS_API\.WORKFLOW_CONFIG\)/);
    assert.match(hook, /requisicaoApi\(ROTAS_API\.WORKFLOW_LIST\)/);
    assert.match(hook, /mantendo o cache seguro/);
  });

  it("envia a etapa atual e não envia coordinatorData para decide", () => {
    const atualizar = hook.slice(
      hook.indexOf("const handleUpdateStatus"),
      hook.indexOf("const handleResetStatus"),
    );
    assert.match(atualizar, /JSON\.stringify\(\{ recordId, stepNumber: currentStepNum, decision, comment \}\)/);
    assert.match(atualizar, /const assignedUserId = wfStep\?\.assignedUserId;/);
    assert.doesNotMatch(atualizar, /coordinatorData/);
  });

  it("Minha vez exige assigned_user_id e não concede override a admin/moderator", () => {
    const filtros = pagina.slice(
      pagina.indexOf("const filteredRecords"),
      pagina.indexOf("const stats"),
    );
    assert.match(filtros, /const isAssignedToMe = stepUserId === currentUserId;/);
    assert.match(filtros, /return isAssignedToMe;/);
    assert.doesNotMatch(filtros, /isStepUnassigned\s*&&\s*isUserPrivileged/);
  });

  it("mantém os três filtros também para Presidência e Financeiro", () => {
    assert.doesNotMatch(pagina, /setQueueFilter\("my_turn"\)/);
    assert.match(pagina, /\{ label: "Minha vez", value: "my_turn" \}/);
    assert.match(pagina, /\{ label: "Pendentes", value: "pending" \}/);
    assert.match(pagina, /\{ label: "Todos", value: "all" \}/);
  });

  it("a tela só exibe registros que pertencem ao conjunto seguro retornado pela API", () => {
    assert.match(pagina, /if \(!workflow \|\| workflow\.finalStatus !== "pendente"\) return false;/);
    assert.match(pagina, /const isMyTurn = !isWfFinished && isAssignedToMe && recordEstaPendente\(record\);/);
  });

  it("etapa financeira usa Aprovar/Negar sem tratamento consultivo", () => {
    assert.match(pagina, /rotuloStatusEtapa/);
    assert.match(pagina, /Decisão Executiva/);
    assert.doesNotMatch(pagina, /consultivo|Consultivo|opinion only|etapa consultiva|não decisória|Opinativo/i);
    assert.doesNotMatch(pagina, /Parecer favorável|Parecer desfavorável/);
    assert.match(pagina, /> Negar Etapa/);
    assert.match(pagina, /> Aprovar Etapa/);
  });
});
