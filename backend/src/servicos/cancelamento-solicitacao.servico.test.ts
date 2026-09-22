import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const servico = readFileSync(
  fileURLToPath(new URL("./aprovacao.servico.ts", import.meta.url)),
  "utf8",
);
const rotas = readFileSync(
  fileURLToPath(new URL("../rotas/aprovacoes.rotas.ts", import.meta.url)),
  "utf8",
);
const regras = readFileSync(
  fileURLToPath(new URL("./cancelamento-solicitacao.regras.ts", import.meta.url)),
  "utf8",
);

const cancelar = servico.slice(servico.indexOf("export async function cancelarSolicitacao"));

describe("POST /api/workflow/cancel", () => {
  it("exige JWT via middleware autenticar", () => {
    assert.match(rotas, /aprovacoesRotas\.use\(autenticar\)/);
    assert.match(rotas, /aprovacoesRotas\.post\("\/cancel", cancelar\)/);
  });

  it("carrega o registro por id e autoriza só por owner_id ou admin", () => {
    assert.match(cancelar, /select\("id, owner_id, status_uso, data"\)/);
    assert.match(cancelar, /autorizarCancelamento\(\{/);
    assert.match(cancelar, /ownerId: registro\.owner_id/);
    assert.doesNotMatch(cancelar, /emailSolicitante|nome_solicitante|responsavelPreenchimento/);
  });

  it("A/B — cancelamento não referencia registros_ia.status e usa status_uso", () => {
    assert.doesNotMatch(cancelar, /\bregistro\.status\b/);
    assert.doesNotMatch(cancelar, /owner_id, status,/);
    assert.doesNotMatch(cancelar, /\.select\("[^"]*(?:^|,\s*)status(?:\s*,|")/);
    assert.match(cancelar, /statusUso: registro\.status_uso/);
    assert.match(cancelar, /status_uso: STATUS_USO_CANCELADA/);
  });

  it("não inventa fluxo quando o workflow não existe", () => {
    assert.match(cancelar, /Workflow correspondente não encontrado/);
    assert.doesNotMatch(cancelar, /\.insert\(/);
  });

  it("rejeita estados finais e restaura o fluxo se o registro falhar", () => {
    assert.match(cancelar, /estadoFinalImpedeCancelamento/);
    assert.match(cancelar, /final_status: workflow\.final_status/);
    assert.match(cancelar, /completed_at: workflow\.completed_at/);
  });

  it("J — não inclui owner_id no UPDATE do registro", () => {
    const atualizacoes = [...cancelar.matchAll(/\.update\(\{([\s\S]*?)\}\)/g)].map((m) => m[1]);
    const updateRegistro = atualizacoes.find((bloco) => bloco.includes("STATUS_USO_CANCELADA"));
    assert.ok(updateRegistro);
    assert.match(updateRegistro, /data: dadosCancelados/);
    assert.doesNotMatch(updateRegistro, /owner_id/);
    assert.match(cancelar, /Cancelamento alterou owner_id indevidamente/);
  });

  it("autorização não usa nome/e-mail", () => {
    assert.doesNotMatch(regras, /email|full_name|contato/);
  });
});
