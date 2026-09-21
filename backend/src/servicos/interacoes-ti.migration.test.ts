import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const caminhoMigration = fileURLToPath(
  new URL("../../../documentacao/SUPABASE_TI_CHAT.sql", import.meta.url),
);

function lerMigration(): string {
  return readFileSync(caminhoMigration, "utf8").toLowerCase();
}

function removerComentariosSql(sql: string): string {
  return sql
    .split(/\r?\n/)
    .filter((linha) => !linha.trimStart().startsWith("--"))
    .join("\n");
}

describe("migration do chat TI", () => {
  it("executa pre-check legado antes de adicionar as colunas novas", () => {
    const sql = removerComentariosSql(lerMigration());
    const preCheck = sql.indexOf("having count(*) > 1");
    const interrupcao = sql.indexOf("raise exception", preCheck);
    const alteracao = sql.indexOf("alter table public.solicitacoes_ti");

    assert.ok(preCheck >= 0);
    assert.ok(interrupcao > preCheck);
    assert.ok(alteracao > interrupcao);
    assert.doesNotMatch(sql.slice(0, alteracao), /current_turn|closed_at/);
    assert.match(sql.slice(0, alteracao), /where status = 'aguardando_resposta'/);
  });

  it("cria índice parcial somente após as novas colunas", () => {
    const sql = removerComentariosSql(lerMigration());
    const alteracao = sql.indexOf("alter table public.solicitacoes_ti");
    const indice = sql.indexOf("create unique index");

    assert.ok(indice > alteracao);
    assert.match(sql.slice(indice), /closed_at is null[\s\S]*current_turn is not null[\s\S]*status = 'aguardando_resposta'/);
  });

  it("cria mensagens com FKs, limites e segurança exigidos", () => {
    const sql = lerMigration();

    assert.match(sql, /create table[\s\S]*public\.mensagens_ti/);
    assert.match(sql, /references public\.solicitacoes_ti\(id\) on delete cascade/);
    assert.match(sql, /references public\.perfis\(id\) on delete restrict/);
    assert.match(sql, /author_role in \('ti', 'solicitante'\)/);
    assert.match(sql, /char_length\(trim\(content\)\) between 1 and 1000/);
    assert.match(sql, /unique \(request_id, sequence_number\)/);
    assert.match(sql, /enable row level security/);
    assert.match(sql, /revoke all on table public\.mensagens_ti from public, anon, authenticated/);
    assert.match(sql, /grant select on table public\.mensagens_ti to service_role/);
    assert.doesNotMatch(sql, /grant (insert|update|delete)[\s\S]*mensagens_ti/);
    assert.doesNotMatch(sql, /timezone\('utc'::text, now\(\)\)/);
  });

  it("endurece todas as RPCs SECURITY DEFINER", () => {
    const sql = lerMigration();
    const funcoes = [
      "criar_conversa_comunicacao_ti",
      "enviar_mensagem_comunicacao_ti",
      "encerrar_conversa_comunicacao_ti",
      "decidir_etapa_ti_comunicacao_segura",
    ];

    for (const funcao of funcoes) {
      assert.match(sql, new RegExp(`function public\\.${funcao}`));
    }
    assert.equal((sql.match(/security definer/g) || []).length, 4);
    assert.equal((sql.match(/set search_path = pg_catalog\s*$/gm) || []).length, 4);
    assert.equal((sql.match(/set search_path = pg_catalog, public/g) || []).length, 0);
    assert.equal((sql.match(/from public\./g) || []).length >= 8, true);
    assert.equal((sql.match(/for update/g) || []).length >= 4, true);
    assert.equal((sql.match(/revoke execute on function/g) || []).length, 4);
    assert.equal((sql.match(/grant execute on function/g) || []).length, 4);
  });

  it("rejeita p_decision nulo e valores fora de aprovado/negado", () => {
    const sql = lerMigration();
    const inicio = sql.indexOf("function public.decidir_etapa_ti_comunicacao_segura");
    const corpo = sql.slice(inicio, sql.indexOf("end;", inicio) + 4);

    assert.match(
      corpo,
      /if p_decision is null[\s\S]*or p_decision not in \('aprovado', 'negado'\) then/,
    );
    assert.match(corpo, /detail = 'decisao_invalida'/);

    const rejeita = (valor: string | null) => valor == null || !["aprovado", "negado"].includes(valor);
    assert.equal(rejeita("aprovado"), false);
    assert.equal(rejeita("negado"), false);
    assert.equal(rejeita(null), true);
    assert.equal(rejeita("pendente"), true);
  });

  it("mantém transições e responded_at coerentes dentro das RPCs", () => {
    const sql = lerMigration();

    assert.match(sql, /current_turn = 'solicitante'[\s\S]*responded_at = null/);
    assert.match(sql, /current_turn = 'ti'[\s\S]*responded_at = v_now/);
    assert.match(sql, /sequence_number[\s\S]*coalesce\(max\(sequence_number\), 0\) \+ 1/);
    assert.match(sql, /current_turn is null[\s\S]*modo_legado/);
  });
});
