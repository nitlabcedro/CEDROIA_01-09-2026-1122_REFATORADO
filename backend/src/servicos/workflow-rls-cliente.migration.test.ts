import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const caminho = resolve(process.cwd(), "documentacao", "SUPABASE_WORKFLOW_RLS_CLIENTE.sql");
const tabelas = ["configuracao_aprovacao", "fluxos_aprovacao", "etapas_aprovacao"] as const;
const papeisCliente = ["public", "anon", "authenticated"] as const;

function migration() {
  return readFileSync(caminho, "utf8");
}

function operacional(sql: string) {
  return sql.replace(/--[^\n]*/g, " ");
}

describe("Etapa 5B — bloqueio PostgREST das tabelas do workflow", () => {
  it("é transacional, habilita RLS e limita-se às três tabelas autorizadas", () => {
    const sql = operacional(migration());
    assert.match(sql, /^\s*begin;/i);
    assert.match(sql, /\bcommit;\s*$/i);

    for (const tabela of tabelas) {
      assert.match(sql, new RegExp(`alter\\s+table\\s+public\\.${tabela}\\s+enable\\s+row\\s+level\\s+security`, "i"));
    }

    for (const tabelaProibida of [
      "mensagens", "mensagens_ti", "perguntas_ti", "solicitacoes_ti",
      "registros_ia", "perfis", "sectors", "storage",
    ]) {
      assert.doesNotMatch(sql, new RegExp(`(?:alter|revoke|grant|create\\s+policy)[\\s\\S]{0,80}${tabelaProibida}`, "i"));
    }
  });

  it("remove idempotentemente todas as policies atuais das três tabelas", () => {
    const sql = migration();
    assert.match(sql, /from\s+pg_catalog\.pg_policies/i);
    assert.match(sql, /drop policy if exists %I on public\.%I/i);
    for (const tabela of tabelas) {
      assert.match(sql, new RegExp(`'${tabela}'`, "i"));
    }
    assert.doesNotMatch(operacional(sql), /create\s+policy/i);
  });

  it("remove todo privilégio de public, anon e authenticated", () => {
    const sql = operacional(migration());
    for (const tabela of tabelas) {
      for (const papel of papeisCliente) {
        assert.match(
          sql,
          new RegExp(`revoke\\s+all\\s+on\\s+table\\s+public\\.${tabela}\\s+from\\s+${papel}\\b`, "i"),
        );
      }
    }
    assert.doesNotMatch(sql, /\bgrant\b/i);
  });

  it("não altera privilégios do service_role", () => {
    const sql = operacional(migration());
    assert.doesNotMatch(sql, /\bservice_role\b/i);
  });
});
