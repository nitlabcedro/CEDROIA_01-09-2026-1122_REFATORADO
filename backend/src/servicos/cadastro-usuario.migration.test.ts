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
  it("persiste full_name, setor e cargo vindos do metadata", () => {
    const sql = lerMigration();

    assert.match(sql, /new\.raw_user_meta_data\s*->>\s*'full_name'/i);
    assert.match(sql, /new\.raw_user_meta_data\s*->>\s*'setor'/i);
    assert.match(sql, /new\.raw_user_meta_data\s*->>\s*'cargo'/i);
    assert.match(sql, /insert\s+into\s+public\.perfis\s*\(\s*id\s*,\s*full_name\s*,\s*setor\s*,\s*cargo\s*\)/i);
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
    assert.match(sql, /cargos\s*\?\s*v_cargo/i);
  });

  it("preserva security definer com search_path seguro e sem metadata de autorização", () => {
    const sql = lerMigration();

    assert.match(sql, /security\s+definer/i);
    assert.match(sql, /set\s+search_path\s*=\s*pg_catalog/i);
    assert.doesNotMatch(sql, /raw_user_meta_data\s*->>\s*'(role|admin|permissions)'/i);
    assert.doesNotMatch(sql, /grant\s+execute[\s\S]*\b(public|anon|authenticated)\b/i);
  });
});
