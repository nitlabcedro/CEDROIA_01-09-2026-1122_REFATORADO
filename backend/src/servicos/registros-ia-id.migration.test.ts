import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

function ler(relativo: string): string {
  return readFileSync(resolve(process.cwd(), relativo), "utf8");
}

function sqlOperacional(sql: string): string {
  return sql.replace(/--[^\n]*/g, " ");
}

describe("formato de IDs novos — IA-NNNNNNNN", () => {
  it("A/B/C/D) função gera IA- + 8 dígitos via sequence, sem MAX+1", () => {
    for (const arquivo of [
      "documentacao/SUPABASE_REGISTROS_IA_ID_SEQUENCE.sql",
      "documentacao/SUPABASE_REGISTROS_IA_ID_FORMATO.sql",
    ]) {
      const operacional = sqlOperacional(ler(arquivo));
      assert.match(operacional, /create\s+or\s+replace\s+function\s+public\.next_registros_ia_id\(\)/i);
      assert.match(operacional, /security\s+definer/i);
      assert.match(operacional, /set\s+search_path\s*=\s*pg_catalog/i);
      assert.match(operacional, /nextval\s*\(\s*'public\.registros_ia_id_seq'/i);
      assert.match(operacional, /'IA-'\s*\|\|\s*lpad\s*\(\s*n::text\s*,\s*8\s*,\s*'0'\s*\)/i);
      assert.doesNotMatch(operacional, /'IA-CEDRO-'/);
      assert.doesNotMatch(operacional, /lpad\s*\(\s*n::text\s*,\s*4\s*,/i);
      assert.doesNotMatch(operacional, /max\s*\(/i);
    }

    const formato = sqlOperacional(ler("documentacao/SUPABASE_REGISTROS_IA_ID_FORMATO.sql"));
    assert.match(formato, /^\s*begin;/im);
    assert.match(formato, /\bcommit;\s*$/im);
    assert.doesNotMatch(formato, /create\s+sequence/i);
    assert.doesNotMatch(formato, /alter\s+sequence/i);
    assert.doesNotMatch(formato, /restart/i);
    assert.doesNotMatch(formato, /setval/i);
    assert.doesNotMatch(formato, /\bupdate\s+public\.registros_ia\b/i);
  });

  it("E) IDs existentes não são alterados", () => {
    const formato = sqlOperacional(ler("documentacao/SUPABASE_REGISTROS_IA_ID_FORMATO.sql"));
    const sequence = sqlOperacional(ler("documentacao/SUPABASE_REGISTROS_IA_ID_SEQUENCE.sql"));
    for (const sql of [formato, sequence]) {
      assert.doesNotMatch(sql, /\bupdate\s+public\.registros_ia\b/i);
      assert.doesNotMatch(sql, /\bset\s+id\s*=/i);
    }
  });

  it("F/G) workflow e cancelamento tratam recordId como string, sem prefixo antigo", () => {
    const servico = ler("backend/src/servicos/aprovacao.servico.ts");
    const inicializar = servico.slice(servico.indexOf("export async function inicializarWorkflow"));
    const cancelar = servico.slice(servico.indexOf("export async function cancelarSolicitacao"));
    assert.match(inicializar, /const \{ recordId \} = req\.body/);
    assert.match(cancelar, /typeof req\.body\?\.recordId === "string"/);
    assert.doesNotMatch(cancelar, /IA-CEDRO-/);
    assert.doesNotMatch(cancelar, /PADRAO_ID_REGISTRO/);
  });

  it("H) nenhuma validação de geração exige IA-CEDRO-", () => {
    const frontend = ler("frontend/src/servicos/registros-ia-id.ts");
    const backend = ler("backend/src/servicos/registros-ia-id.servico.ts");
    assert.match(frontend, /\^IA-\\d\{8\}\$/);
    assert.match(backend, /\^IA-\\d\{8\}\$/);
    assert.doesNotMatch(frontend, /IA-CEDRO-/);
    assert.doesNotMatch(backend, /IA-CEDRO-/);
  });
});

describe("Etapa 3A — sequence de IDs de public.registros_ia", () => {
  it("cria sequence e função nextval no formato IA-NNNNNNNN", () => {
    const sql = ler("documentacao/SUPABASE_REGISTROS_IA_ID_SEQUENCE.sql");
    const operacional = sqlOperacional(sql);

    assert.match(sql, /^\s*begin;/im);
    assert.match(sql, /\bcommit;\s*$/im);
    assert.match(operacional, /create\s+sequence\s+if\s+not\s+exists\s+public\.registros_ia_id_seq/i);
    assert.match(operacional, /create\s+or\s+replace\s+function\s+public\.next_registros_ia_id\(\)/i);
    assert.match(operacional, /nextval\s*\(\s*'public\.registros_ia_id_seq'/i);
    assert.match(operacional, /'IA-'\s*\|\|\s*lpad\s*\(\s*n::text\s*,\s*8\s*,\s*'0'\s*\)/i);
    assert.doesNotMatch(operacional, /max\s*\(/i);
    assert.doesNotMatch(operacional, /enable\s+row\s+level\s+security/i);
    assert.doesNotMatch(operacional, /create\s+policy/i);
    assert.doesNotMatch(operacional, /METADATA-SECTORS/);
  });

  it("não concede EXECUTE da função para anon ou authenticated", () => {
    const operacional = sqlOperacional(ler("documentacao/SUPABASE_REGISTROS_IA_ID_SEQUENCE.sql"));
    assert.match(operacional, /revoke\s+all\s+on\s+function\s+public\.next_registros_ia_id\(\)\s+from\s+anon/i);
    assert.match(operacional, /revoke\s+all\s+on\s+function\s+public\.next_registros_ia_id\(\)\s+from\s+authenticated/i);
    assert.match(operacional, /grant\s+execute\s+on\s+function\s+public\.next_registros_ia_id\(\)\s+to\s+service_role/i);
    assert.doesNotMatch(operacional, /grant\s+execute[\s\S]*to\s+anon/i);
    assert.doesNotMatch(operacional, /grant\s+execute[\s\S]*to\s+authenticated/i);
    assert.doesNotMatch(operacional, /grant\s+execute[\s\S]*to\s+public\b/i);
  });
});

describe("Etapa 3A — endpoint autenticado de próximo ID", () => {
  it("G) POST /api/registros/next-id exige autenticar e usa RPC service_role", () => {
    const rotas = ler("backend/src/rotas/registros.rotas.ts");
    const servico = ler("backend/src/servicos/registros-ia-id.servico.ts");
    const app = ler("backend/src/aplicacao.ts");

    assert.match(rotas, /registrosRotas\.use\(autenticar\)/);
    assert.match(rotas, /registrosRotas\.post\("\/next-id",\s*gerarProximoIdRegistro\)/);
    assert.match(app, /rotasApi\.use\("\/registros",\s*registrosRotas\)/);
    assert.match(servico, /\.rpc\("next_registros_ia_id"\)/);
    assert.match(servico, /\^IA-\\d\{8\}\$/);
  });
});
