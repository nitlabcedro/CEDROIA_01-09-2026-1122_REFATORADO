import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const COLUNAS_UPDATE_AUTHENTICATED = [
  "id",
  "full_name",
  "setor",
  "cargo",
  "contato",
  "avatar_url",
  "updated_at",
  "last_seen",
] as const;

const COLUNAS_UPDATE_BLOQUEADAS = ["role", "sector_locked"] as const;

const CAMINHO_MIGRATION = resolve(
  process.cwd(),
  "documentacao",
  "SUPABASE_PERFIS_UPDATE_COLUNAS.sql",
);

function lerMigration(): string {
  return readFileSync(CAMINHO_MIGRATION, "utf8");
}

function colunasGrantUpdateAuthenticated(sql: string): string[] {
  const match = sql.match(
    /grant\s+update\s*\(([^)]+)\)\s+on\s+table\s+public\.perfis\s+to\s+authenticated/i,
  );
  assert.ok(match, "GRANT UPDATE em colunas para authenticated ausente");
  return match[1]
    .split(",")
    .map((coluna) => coluna.trim().toLowerCase())
    .filter(Boolean);
}

describe("migration de UPDATE column-level em public.perfis", () => {
  it("não altera policies RLS nem registros existentes", () => {
    const sql = lerMigration();

    assert.doesNotMatch(sql, /\bcreate\s+policy\b/i);
    assert.doesNotMatch(sql, /\balter\s+policy\b/i);
    assert.doesNotMatch(sql, /\bdrop\s+policy\b/i);
    assert.doesNotMatch(sql, /\benable\s+row\s+level\s+security\b/i);
    assert.doesNotMatch(sql, /\bdisable\s+row\s+level\s+security\b/i);
    assert.doesNotMatch(sql, /\balter\s+table\b/i);
    assert.doesNotMatch(sql, /\binsert\s+into\b/i);
    assert.doesNotMatch(sql, /\bupdate\s+public\.perfis\s+set\b/i);
    assert.doesNotMatch(sql, /\bdelete\s+from\b/i);
  });

  it("revoga UPDATE geral de anon e authenticated e não concede nada a anon", () => {
    const sql = lerMigration();

    assert.match(sql, /revoke\s+update\s+on\s+table\s+public\.perfis\s+from\s+anon/i);
    assert.match(sql, /revoke\s+update\s+on\s+table\s+public\.perfis\s+from\s+authenticated/i);
    assert.doesNotMatch(sql, /grant\s+[^\n]*\bto\s+anon\b/i);
  });

  it("A) authenticated possui UPDATE somente nas colunas permitidas", () => {
    const concedidas = colunasGrantUpdateAuthenticated(lerMigration());

    assert.deepEqual(concedidas, [...COLUNAS_UPDATE_AUTHENTICATED]);
    assert.equal(concedidas.length, COLUNAS_UPDATE_AUTHENTICATED.length);
  });

  it("B) authenticated não possui UPDATE em role", () => {
    const concedidas = colunasGrantUpdateAuthenticated(lerMigration());
    assert.equal(concedidas.includes("role"), false);
  });

  it("C) authenticated não possui UPDATE em sector_locked", () => {
    const concedidas = colunasGrantUpdateAuthenticated(lerMigration());
    assert.equal(concedidas.includes("sector_locked"), false);
  });

  it("D) authenticated possui UPDATE em id por compatibilidade com UPSERT", () => {
    const concedidas = colunasGrantUpdateAuthenticated(lerMigration());
    assert.equal(concedidas.includes("id"), true);
    for (const coluna of COLUNAS_UPDATE_BLOQUEADAS) {
      assert.equal(concedidas.includes(coluna), false, `coluna bloqueada ainda concedida: ${coluna}`);
    }
  });

  it("não altera privilégios de service_role", () => {
    const sql = lerMigration();

    assert.doesNotMatch(sql, /revoke\s+[^\n]*\bfrom\s+service_role\b/i);
    assert.doesNotMatch(sql, /grant\s+[^\n]*\bto\s+service_role\b/i);
  });
});
