import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

function ler(relativo: string): string {
  return readFileSync(resolve(process.cwd(), relativo), "utf8");
}

describe("Etapa 3A — METADATA, ID e owner_id", () => {
  it("A/B/C) nenhum fluxo lê ou grava METADATA-SECTORS; setores usam public.sectors", () => {
    const armazenamento = ler("frontend/src/servicos/armazenamento.ts");
    const gestao = ler("frontend/src/servicos/setores-gestao.ts");

    assert.doesNotMatch(armazenamento, /SECTORS_METADATA_ID/);
    assert.doesNotMatch(armazenamento, /eq\("id",\s*["']METADATA-SECTORS["']\)/);
    assert.doesNotMatch(armazenamento, /id:\s*["']METADATA-SECTORS["']/);
    assert.doesNotMatch(armazenamento, /unidade_setor:\s*["']METADATA["']/);
    assert.match(armazenamento, /carregarSetoresGestaoDoSupabase/);
    assert.match(armazenamento, /persistirSetoresGestaoNoSupabase/);
    assert.match(armazenamento, /Não foi possível carregar os setores oficiais/);
    assert.match(gestao, /"sectors"/);
  });

  it("D/H) geração de ID não usa getGlobalRecords nem MAX no frontend", () => {
    const formulario = ler("frontend/src/paginas/inventario/FormularioCadastro.tsx");
    const armazenamento = ler("frontend/src/servicos/armazenamento.ts");
    const servicoId = ler("frontend/src/servicos/registros-ia-id.ts");

    assert.doesNotMatch(formulario, /getGlobalRecords/);
    assert.doesNotMatch(formulario, /generateId/);
    assert.doesNotMatch(armazenamento, /export const generateId/);
    assert.doesNotMatch(armazenamento, /Math\.max/);
    assert.match(formulario, /solicitarProximoIdRegistro/);
    assert.match(servicoId, /ROTAS_API\.REGISTROS_PROXIMO_ID/);
    assert.match(servicoId, /method:\s*"POST"/);
  });

  it("E) IDs novos usam IA-NNNNNNNN", () => {
    const sql = ler("documentacao/SUPABASE_REGISTROS_IA_ID_SEQUENCE.sql");
    const servicoId = ler("frontend/src/servicos/registros-ia-id.ts");
    assert.match(sql, /'IA-' \|\| lpad\(n::text, 8, '0'\)/);
    assert.match(servicoId, /\^IA-\\d\{8\}\$/);
    assert.doesNotMatch(sql, /IA-CEDRO-/);
    assert.doesNotMatch(servicoId, /IA-CEDRO-/);
  });

  it("I/J) init/decide/reset não escrevem no Supabase quando a API falha", () => {
    const hook = ler("frontend/src/hooks/useAplicacao.ts");
    assert.match(hook, /ROTAS_API\.WORKFLOW_INIT/);
    assert.match(hook, /ROTAS_API\.WORKFLOW_DECIDE/);
    assert.match(hook, /ROTAS_API\.WORKFLOW_RESET_STATUS/);
    assert.doesNotMatch(hook, /Usando fallback direto/);
    assert.doesNotMatch(hook, /fallback local no Supabase/);
    assert.doesNotMatch(hook, /Não foi possível inicializar o fluxo de aprovação local/);

    const handleSave = hook.slice(hook.indexOf("const handleSave"));
    const ateConfig = handleSave.slice(0, handleSave.indexOf("const handleSaveApprovalConfig"));
    assert.doesNotMatch(ateConfig, /TABELAS_SUPABASE\.FLUXOS_APROVACAO/);
    assert.doesNotMatch(ateConfig, /TABELAS_SUPABASE\.ETAPAS_APROVACAO/);

    const handleDecide = hook.slice(hook.indexOf("const handleUpdateStatus"));
    const ateReset = handleDecide.slice(0, handleDecide.indexOf("const handleResetStatus"));
    assert.doesNotMatch(ateReset, /TABELAS_SUPABASE\.REGISTROS_IA/);
    assert.doesNotMatch(ateReset, /TABELAS_SUPABASE\.FLUXOS_APROVACAO/);

    const handleReset = hook.slice(hook.indexOf("const handleResetStatus"));
    const ateAssign = handleReset.slice(0, handleReset.indexOf("const handleUpdateUserAssignments"));
    assert.doesNotMatch(ateAssign, /TABELAS_SUPABASE\.REGISTROS_IA/);
    assert.doesNotMatch(ateAssign, /TABELAS_SUPABASE\.FLUXOS_APROVACAO/);
    assert.doesNotMatch(ateAssign, /TABELAS_SUPABASE\.ETAPAS_APROVACAO/);
  });

  it("K/L/M) criar usa auth uid; editar preserva owner_id existente", () => {
    const armazenamento = ler("frontend/src/servicos/armazenamento.ts");
    assert.match(armazenamento, /modo === "criar"/);
    assert.match(armazenamento, /modo: "criar" \| "atualizar"/);
    assert.match(
      armazenamento,
      /export const addRecord[\s\S]*persistirRegistroIa\(record,\s*userId,\s*isAdmin,\s*"criar"\)/,
    );
    assert.match(
      armazenamento,
      /export const updateRecord[\s\S]*persistirRegistroIa\(record,\s*userId,\s*isAdmin,\s*"atualizar"\)/,
    );

    const persistir = armazenamento.slice(armazenamento.indexOf("async function persistirRegistroIa"));
    const criarBloco = persistir.match(/if \(modo === "criar"\) \{[\s\S]*?\} else \{/);
    assert.ok(criarBloco);
    assert.match(criarBloco[0], /resolvedOwnerId = userId/);
    assert.doesNotMatch(criarBloco[0], /record\.ownerId/);

    const atualizarBloco = persistir.match(/\} else \{\s*const \{ data: registroExistente[\s\S]*?\n    \}/);
    assert.ok(atualizarBloco);
    assert.match(atualizarBloco[0], /\.select\("owner_id"\)/);
    assert.match(atualizarBloco[0], /resolvedOwnerId = registroExistente\.owner_id/);
    assert.doesNotMatch(atualizarBloco[0], /resolvedOwnerId = userId/);
  });
});
