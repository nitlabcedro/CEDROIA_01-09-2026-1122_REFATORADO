import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

function ler(relativo: string): string {
  return readFileSync(resolve(process.cwd(), relativo), "utf8");
}

describe("Etapa 3B.1 — preparação de registros_ia", () => {
  const armazenamento = ler("frontend/src/servicos/armazenamento.ts");
  const hook = ler("frontend/src/hooks/useAplicacao.ts");
  const inventario = ler("frontend/src/paginas/inventario/Inventario.tsx");
  const administracao = ler("frontend/src/paginas/administracao/PainelAdministrativo.tsx");
  const dropdown = ler("frontend/src/paginas/administracao/AdminDropdownPortal.tsx");
  const controles = ler("frontend/src/paginas/administracao/ControlesSistema.tsx");

  const persistir = armazenamento.slice(
    armazenamento.indexOf("async function persistirRegistroIa"),
    armazenamento.indexOf("export const updateRecord"),
  );

  it("A/B — criação usa insert, nunca upsert, e exige owner autenticado", () => {
    assert.match(persistir, /modo === "criar"[\s\S]*await tabela\.insert\(currentPayload\)/);
    assert.doesNotMatch(persistir, /\.upsert\(/);
    assert.match(
      persistir,
      /if \(!userId \|\| !isValidUUID\(userId\)\)[\s\S]*owner_id autenticado é obrigatório/,
    );
    assert.match(persistir, /resolvedOwnerId = userId/);
  });

  it("C/D — edição usa update por id e preserva owner_id persistido", () => {
    assert.match(persistir, /await tabela\.update\(currentPayload\)\.eq\("id", record\.id\)/);
    assert.match(persistir, /\.select\("owner_id"\)[\s\S]*\.eq\("id", record\.id\)/);
    assert.match(persistir, /resolvedOwnerId = registroExistente\.owner_id/);
    assert.match(
      armazenamento,
      /export const updateRecord[\s\S]*if \(!isAdmin\)[\s\S]*Somente administradores podem editar cadastros/,
    );
    const payload = persistir.match(/const payload: Record<string, unknown> = \{([\s\S]*?)\n    \};/)?.[1] || "";
    assert.doesNotMatch(payload, /owner_id/);
  });

  it("E/F/G — Editar cadastro e Editar registro são ações somente de admin", () => {
    assert.match(inventario, /\{isAdmin && \([\s\S]*Editar cadastro[\s\S]*\)\}/);
    assert.match(administracao, /\{isCurrentUserAdmin && \([\s\S]*administracao__botao-editar[\s\S]*Editar[\s\S]*\)\}/);
    assert.match(dropdown, /\{isAdmin && \([\s\S]*Editar registro[\s\S]*\)\}/);
    assert.match(hook, /const handleEdit[\s\S]*if \(!isCurrentUserAdmin\) return/);
    assert.match(hook, /if \(!isAdmin\)[\s\S]*Somente administradores podem editar cadastros/);
  });

  it("H/I/J — Excluir aparece e executa somente para admin", () => {
    assert.match(
      administracao,
      /\{isCurrentUserAdmin && \([\s\S]*data-delete-record-menu[\s\S]*Excluir[\s\S]*\)\}/,
    );
    const handleDelete = hook.slice(
      hook.indexOf("const handleDelete"),
      hook.indexOf("const handleCancelRequest"),
    );
    assert.match(handleDelete, /if \(!isCurrentUserAdmin\)/);
    assert.match(handleDelete, /requisicaoApi\(rotaExcluirRegistro\(id\), \{ method: "DELETE" \}\)/);
    assert.doesNotMatch(handleDelete, /supabase/);
  });

  it("O/P — não há SELECT global nem fallback sem owner_id", () => {
    assert.doesNotMatch(armazenamento, /getGlobalRecords/);
    assert.doesNotMatch(armazenamento, /Buscando todos os registros públicos/);
    assert.doesNotMatch(armazenamento, /fallbackResult/);
  });

  it("Q — sincronização em massa e sua ação visual foram removidas", () => {
    assert.doesNotMatch(armazenamento, /saveRecordsToSupabase|addOrUpdateRecord/);
    assert.doesNotMatch(hook, /handleSync|saveRecordsToSupabase/);
    assert.doesNotMatch(controles, /onSync|Sincronizar Banco de Dados/);
  });

  it("METADATA-SECTORS permanece apenas como filtro defensivo de leitura", () => {
    const ocorrencias = armazenamento.match(/METADATA-SECTORS/g) || [];
    assert.equal(ocorrencias.length, 1);
    assert.match(armazenamento, /filter\(item => item\.id !== 'METADATA-SECTORS'\)/);
  });
});
