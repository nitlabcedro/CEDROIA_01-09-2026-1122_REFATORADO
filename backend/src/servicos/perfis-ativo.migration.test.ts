import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const caminho = resolve(process.cwd(), "documentacao", "SUPABASE_PERFIS_ATIVO.sql");
const sql = readFileSync(caminho, "utf8");
const operacional = sql.replace(/--[^\n]*/g, " ");

describe("Etapa 6B — migration de public.perfis.ativo", () => {
  it("adiciona a coluna idempotente, booleana, obrigatória e ativa por padrão", () => {
    assert.match(
      operacional,
      /alter\s+table\s+public\.perfis\s+add\s+column\s+if\s+not\s+exists\s+ativo\s+boolean\s+not\s+null\s+default\s+true\s*;/i,
    );
  });

  it("não concede ativo a authenticated nem altera service_role", () => {
    assert.doesNotMatch(operacional, /grant[\s\S]*\bativo\b[\s\S]*authenticated/i);
    assert.doesNotMatch(operacional, /\bservice_role\b/i);
  });

  it("não cria policy nem toca outras tabelas", () => {
    assert.doesNotMatch(operacional, /\b(create|alter|drop)\s+policy\b/i);

    const tabelas = [...operacional.matchAll(/\b(?:alter|update|insert\s+into|delete\s+from)\s+(?:table\s+)?public\.([a-z_]+)/gi)]
      .map((match) => match[1]);
    assert.deepEqual([...new Set(tabelas)], ["perfis"]);
  });
});
