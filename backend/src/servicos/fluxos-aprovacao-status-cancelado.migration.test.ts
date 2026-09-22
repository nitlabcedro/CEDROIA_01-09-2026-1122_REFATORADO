import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const CAMINHO = resolve(
  process.cwd(),
  "documentacao",
  "SUPABASE_FLUXOS_APROVACAO_STATUS_CANCELADO.sql",
);

function ler(relativo: string): string {
  return readFileSync(resolve(process.cwd(), relativo), "utf8");
}

function sqlOperacional(sql: string): string {
  return sql.replace(/--[^\n]*/g, " ");
}

function extrairListaCheck(sql: string): string[] {
  const match = sqlOperacional(sql).match(
    /add\s+constraint\s+approval_workflows_final_status_check\s+check\s*\(\s*final_status\s+in\s*\(([\s\S]*?)\)\s*\)/i,
  );
  assert.ok(match, "CHECK de final_status ausente");
  return match[1]
    .split(",")
    .map((item) => item.replace(/['\s]/g, ""))
    .filter(Boolean);
}

describe("migration — fluxos_aprovacao.final_status aceita cancelado", () => {
  const sql = readFileSync(CAMINHO, "utf8");
  const operacional = sqlOperacional(sql);
  const valores = extrairListaCheck(sql);

  it("é transacional, idempotente e só altera public.fluxos_aprovacao", () => {
    assert.match(sql, /^\s*(?:--|begin;)/im);
    assert.match(operacional, /^\s*begin;/im);
    assert.match(operacional, /\bcommit;\s*$/im);
    assert.match(
      operacional,
      /alter\s+table\s+public\.fluxos_aprovacao\s+drop\s+constraint\s+if\s+exists\s+approval_workflows_final_status_check/i,
    );
    assert.match(
      operacional,
      /alter\s+table\s+public\.fluxos_aprovacao\s+add\s+constraint\s+approval_workflows_final_status_check/i,
    );
    assert.doesNotMatch(operacional, /\balter\s+table\s+public\.(?!fluxos_aprovacao\b)/i);
    assert.doesNotMatch(operacional, /\bcreate\s+table\b/i);
    assert.doesNotMatch(operacional, /\bdrop\s+table\b/i);
    assert.doesNotMatch(operacional, /\benable\s+row\s+level\s+security\b/i);
    assert.doesNotMatch(operacional, /\bupdate\s+public\./i);
    assert.doesNotMatch(operacional, /\binsert\s+into\b/i);
  });

  it("A/B/C/D — pendente, aprovado, negado e cancelado são aceitos", () => {
    assert.deepEqual(valores, ["pendente", "aprovado", "negado", "cancelado"]);
  });

  it("E — valor arbitrário continua fora da constraint", () => {
    assert.equal(valores.includes("encerrado"), false);
    assert.equal(valores.includes("canceled"), false);
    assert.equal(valores.includes("Cancelada"), false);
  });

  it("F — POST /api/workflow/cancel grava exatamente cancelado", () => {
    const servico = ler("backend/src/servicos/aprovacao.servico.ts");
    const cancelar = servico.slice(servico.indexOf("export async function cancelarSolicitacao"));
    assert.match(cancelar, /final_status:\s*"cancelado"/);
    assert.doesNotMatch(cancelar, /final_status:\s*"(?:canceled|Cancelada|encerrado)"/);
  });

  it("G — nenhuma outra tabela/schema é alterada", () => {
    const tabelas = [...operacional.matchAll(/\b(?:alter|drop|create)\s+table\s+([a-z0-9_.]+)/gi)]
      .map((match) => match[1].toLowerCase());
    assert.deepEqual([...new Set(tabelas)], ["public.fluxos_aprovacao"]);
    assert.doesNotMatch(operacional, /\bset\s+search_path\b/i);
    assert.doesNotMatch(operacional, /\bpublic\.registros_ia\b/i);
  });
});
