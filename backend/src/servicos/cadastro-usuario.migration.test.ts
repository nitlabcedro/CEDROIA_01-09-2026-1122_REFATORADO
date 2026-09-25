import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const CAMINHO_MIGRATION = resolve(
  process.cwd(),
  "documentacao",
  "SUPABASE_CORRECAO_CADASTRO_USUARIO.sql",
);

function lerMigration(): string {
  return readFileSync(CAMINHO_MIGRATION, "utf8");
}

describe("migration do trigger de cadastro de usuário", () => {
  it("persiste full_name e a lista atribuicoes serializada com '; '", () => {
    const sql = lerMigration();

    assert.match(sql, /new\.raw_user_meta_data\s*->>\s*'full_name'/i);
    assert.match(sql, /new\.raw_user_meta_data\s*->\s*'atribuicoes'/i);
    assert.match(sql, /jsonb_typeof\s*\(\s*v_atribuicoes\s*\)\s*<>\s*'array'/i);
    assert.match(
      sql,
      /jsonb_array_elements\s*\(\s*v_atribuicoes\s*\)\s+with ordinality as t\(elem,\s*ord\)/i,
    );
    assert.match(sql, /order by t\.ord/i);
    assert.match(sql, /jsonb_typeof\s*\(\s*v_item\s*\)\s*<>\s*'object'/i);
    assert.match(sql, /array_to_string\s*\(\s*v_setores\s*,\s*'; '\s*\)/i);
    assert.match(sql, /array_to_string\s*\(\s*v_cargos\s*,\s*'; '\s*\)/i);
    assert.match(sql, /insert\s+into\s+public\.perfis\s*\(\s*id\s*,\s*full_name\s*,\s*setor\s*,\s*cargo\s*\)/i);
    assert.doesNotMatch(sql, /insert\s+into\s+public\.perfis[\s\S]*\brole\b/i);
    assert.doesNotMatch(sql, /insert\s+into\s+public\.perfis[\s\S]*sector_locked/i);
  });

  it("mantém fallback legado para setor e cargo quando atribuicoes não existe", () => {
    const sql = lerMigration();

    assert.match(sql, /if v_atribuicoes is not null then/i);
    assert.match(sql, /new\.raw_user_meta_data\s*->>\s*'setor'/i);
    assert.match(sql, /new\.raw_user_meta_data\s*->>\s*'cargo'/i);
    assert.match(sql, /setor\.cargos\s*\?\s*v_cargo\b/i);
  });

  it("reproduz a duplicidade do frontend: setor único, cargo repetível em setores diferentes", () => {
    const sql = lerMigration();

    assert.match(sql, /O setor informado não existe ou não está ativo\./);
    assert.match(sql, /O cargo informado não pertence ao setor selecionado\./);
    assert.match(sql, /Não é permitido selecionar o mesmo setor mais de uma vez\./);
    assert.match(sql, /v_setor_item = any \(v_setores\)/);
    assert.match(sql, /v_cargos := array_append\(v_cargos, v_cargo_item\)/);
    assert.match(sql, /setor\.cargos\s*\?\s*v_cargo_item/);
    assert.doesNotMatch(sql, /v_cargo_item = any \(v_cargos\)/);
    assert.doesNotMatch(sql, /mesmo cargo mais de uma vez/);
    assert.doesNotMatch(sql, /from\s+public\.perfis[\s\S]{0,200}setor[\s\S]{0,80}cargo/i);
    assert.doesNotMatch(sql, /cargo já ocupado/i);
  });

  it("não contém os fallbacks Geral ou Colaborador", () => {
    const sql = lerMigration();

    assert.doesNotMatch(sql, /'Geral'/);
    assert.doesNotMatch(sql, /'Colaborador'/);
  });

  it("rejeita nome, setor e cargo vazios", () => {
    const sql = lerMigration();

    assert.match(sql, /nullif\s*\(\s*btrim\s*\([^)]*full_name[^)]*\)\s*,\s*''\s*\)/i);
    assert.match(sql, /nullif\s*\(\s*btrim\s*\([^)]*setor[^)]*\)\s*,\s*''\s*\)/i);
    assert.match(sql, /nullif\s*\(\s*btrim\s*\([^)]*cargo[^)]*\)\s*,\s*''\s*\)/i);
    assert.match(sql, /raise\s+exception/gi);
  });

  it("valida setor ativo e cargo no JSONB de public.sectors", () => {
    const sql = lerMigration();

    assert.match(sql, /from\s+public\.sectors/i);
    assert.match(sql, /status\s*=\s*'Ativo'/i);
    assert.match(sql, /jsonb_typeof\s*\([^)]*cargos[^)]*\)\s*=\s*'array'/i);
    assert.match(sql, /cargos\s*\?\s*v_cargo(?:_item)?/i);
  });

  it("preserva security definer com search_path seguro e sem metadata de autorização", () => {
    const sql = lerMigration();

    assert.match(sql, /security\s+definer/i);
    assert.match(sql, /set\s+search_path\s*=\s*pg_catalog/i);
    assert.doesNotMatch(sql, /raw_user_meta_data\s*->>\s*'(role|admin|permissions)'/i);
    assert.doesNotMatch(sql, /grant\s+execute[\s\S]*\b(public|anon|authenticated)\b/i);
  });
});
