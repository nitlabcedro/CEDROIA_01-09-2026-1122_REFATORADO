import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const fonte = readFileSync(
  fileURLToPath(new URL("./useAplicacao.ts", import.meta.url)),
  "utf8",
);
const constantes = readFileSync(
  fileURLToPath(new URL("../constantes/api.ts", import.meta.url)),
  "utf8",
);
const inventario = readFileSync(
  fileURLToPath(new URL("../paginas/inventario/Inventario.tsx", import.meta.url)),
  "utf8",
);

const handle = fonte.slice(fonte.indexOf("const handleCancelRequest"));
const corpo = handle.slice(0, handle.indexOf("const handleSave"));

describe("handleCancelRequest — cancelamento via backend", () => {
  it("G/H — chama só /api/workflow/cancel e não escreve em registros_ia nem fluxos_aprovacao", () => {
    assert.match(constantes, /WORKFLOW_CANCEL: "\/api\/workflow\/cancel"/);
    assert.match(corpo, /ROTAS_API\.WORKFLOW_CANCEL/);
    assert.doesNotMatch(corpo, /TABELAS_SUPABASE\.REGISTROS_IA/);
    assert.doesNotMatch(corpo, /TABELAS_SUPABASE\.FLUXOS_APROVACAO/);
    assert.doesNotMatch(corpo, /\.from\(/);
    assert.doesNotMatch(corpo, /\.update\(/);
    assert.doesNotMatch(corpo, /persistirCancelamentoCoerente/);
  });

  it("I — falha da API não executa fallback e não atualiza estado local antes do sucesso", () => {
    assert.match(corpo, /if \(!response\.ok\) \{\s*throw new Error/);
    const indiceThrow = corpo.indexOf("if (!response.ok)");
    const indiceSetRecords = corpo.indexOf("setRecords");
    const indiceCatch = corpo.lastIndexOf("} catch (error)");
    assert.ok(indiceThrow > 0 && indiceSetRecords > indiceThrow);
    assert.match(corpo.slice(indiceCatch), /Não foi possível cancelar/);
    assert.doesNotMatch(corpo.slice(indiceCatch), /setRecords|setWorkflows|supabase/);
  });

  it("envia a justificativa normalizada junto com o recordId", () => {
    assert.match(corpo, /handleCancelRequest = async \(recordId: string, justificativa: string\)/);
    assert.match(corpo, /JSON\.stringify\(\{ recordId, justificativa: justificativa\.trim\(\) \}\)/);
  });

  it("modal exige motivo, bloqueia envio vazio e limpa ao fechar", () => {
    assert.match(inventario, /Motivo do cancelamento/);
    assert.match(inventario, /value=\{cancelJustificativa\}/);
    assert.match(inventario, /disabled=\{isCancelling \|\| !cancelJustificativa\.trim\(\)\}/);
    assert.match(inventario, /onCancelRequest\(cancelTargetRecord\.id, justificativa\)/);
    assert.match(inventario, /setCancelJustificativa\(""\)/);
  });
});
