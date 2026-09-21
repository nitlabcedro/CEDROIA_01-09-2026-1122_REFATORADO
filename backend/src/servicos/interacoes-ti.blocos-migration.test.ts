import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const caminhoMigration = fileURLToPath(
  new URL("../../../documentacao/SUPABASE_TI_BLOCOS_PERGUNTAS.sql", import.meta.url),
);

function lerMigration() {
  return readFileSync(caminhoMigration, "utf8").toLowerCase();
}

function corpoFuncao(sql: string, nome: string) {
  const inicio = sql.indexOf(`function public.${nome}`);
  assert.ok(inicio >= 0, `função ${nome} ausente`);
  const fim = sql.indexOf("\n$$;", inicio);
  assert.ok(fim > inicio, `fim da função ${nome} ausente`);
  return sql.slice(inicio, fim);
}

describe("migration dos blocos estruturados TI", () => {
  it("é aditiva e não altera tabelas ou a migration de chat existente", () => {
    const sql = lerMigration();
    assert.doesNotMatch(sql, /\bcreate table\b|\balter table\b|\bdrop table\b/);
    assert.match(sql, /public\.solicitacoes_ti/);
    assert.match(sql, /public\.perguntas_ti/);
    assert.match(sql, /public\.mensagens_ti/);
  });

  it("cria as RPCs de bloco e redefine o envio de chat simples", () => {
    const sql = lerMigration();
    for (const nome of [
      "criar_bloco_perguntas_ti",
      "salvar_resposta_bloco_ti",
      "finalizar_respostas_bloco_ti",
      "enviar_mensagem_comunicacao_ti",
    ]) {
      assert.match(sql, new RegExp(`function public\\.${nome}`));
    }
    assert.equal((sql.match(/security definer/g) || []).length, 4);
    assert.equal((sql.match(/set search_path = pg_catalog/g) || []).length, 4);
    assert.equal((sql.match(/grant execute on function/g) || []).length, 4);
    assert.equal((sql.match(/revoke execute on function/g) || []).length, 4);
  });

  it("valida no backend entre 1 e 10 perguntas e até 1000 caracteres", () => {
    const corpo = corpoFuncao(lerMigration(), "criar_bloco_perguntas_ti");
    assert.match(corpo, /jsonb_typeof\(p_questions\)[\s\S]*'array'/);
    assert.match(corpo, /jsonb_array_length\(p_questions\)[\s\S]*between 1 and 10/);
    assert.match(corpo, /char_length[\s\S]*between 1 and 1000/);
    assert.match(corpo, /pergunta_invalida/);
  });

  it("cria cada bloco como nova rodada e não duplica perguntas em mensagens", () => {
    const corpo = corpoFuncao(lerMigration(), "criar_bloco_perguntas_ti");
    assert.match(corpo, /max\(round_number\)[\s\S]*\+ 1/);
    assert.match(corpo, /insert into public\.solicitacoes_ti/);
    assert.match(corpo, /insert into public\.perguntas_ti/);
    assert.doesNotMatch(corpo, /insert into public\.mensagens_ti/);
  });

  it("só permite novo bloco no turno da TI e fecha a rodada anterior atomicamente", () => {
    const corpo = corpoFuncao(lerMigration(), "criar_bloco_perguntas_ti");
    assert.match(corpo, /for update/);
    assert.match(corpo, /current_turn[\s\S]*<> 'ti'[\s\S]*turno_invalido/);
    assert.match(corpo, /set closed_at = v_now/);
    assert.match(corpo, /current_turn[\s\S]*'solicitante'/);
  });

  it("autoriza somente responsável TI ou admin na criação", () => {
    const corpo = corpoFuncao(lerMigration(), "criar_bloco_perguntas_ti");
    assert.match(corpo, /assigned_user_id[\s\S]*p_user_id/);
    assert.match(corpo, /v_is_admin/);
    assert.match(corpo, /nao_autorizado/);
  });

  it("salva uma resposta individual sem devolver o turno para TI", () => {
    const corpo = corpoFuncao(lerMigration(), "salvar_resposta_bloco_ti");
    assert.match(corpo, /p_question_id/);
    assert.match(corpo, /request_id = p_request_id/);
    assert.match(corpo, /requester_id[\s\S]*p_user_id/);
    assert.match(corpo, /current_turn[\s\S]*'solicitante'/);
    assert.match(corpo, /char_length\(p_answer\)[\s\S]*between 1 and 1000/);
    assert.match(corpo, /set[\s\S]*answer = p_answer/);
    assert.doesNotMatch(corpo, /current_turn = 'ti'|status = 'respondida'/);
  });

  it("mantém respostas editáveis antes da finalização e não altera perguntas", () => {
    const corpo = corpoFuncao(lerMigration(), "salvar_resposta_bloco_ti");
    assert.match(corpo, /update public\.perguntas_ti/);
    assert.doesNotMatch(corpo, /question\s*=/);
    assert.doesNotMatch(corpo, /answered_at\s*=/);
  });

  it("finaliza somente bloco completo e muda o turno uma única vez", () => {
    const corpo = corpoFuncao(lerMigration(), "finalizar_respostas_bloco_ti");
    assert.match(corpo, /for update/);
    assert.match(corpo, /answer is null[\s\S]*trim\(answer\)/);
    assert.match(corpo, /bloco_incompleto/);
    assert.match(corpo, /answered_at = v_now/);
    assert.match(corpo, /current_turn = 'ti'/);
    assert.match(corpo, /status = 'respondida'/);
    assert.match(corpo, /responded_at = v_now/);
    assert.equal((corpo.match(/current_turn = 'ti'/g) || []).length, 1);
  });

  it("isola bloco estruturado de chat simples e legado", () => {
    const sql = lerMigration();
    const salvar = corpoFuncao(sql, "salvar_resposta_bloco_ti");
    const finalizar = corpoFuncao(sql, "finalizar_respostas_bloco_ti");
    for (const corpo of [salvar, finalizar]) {
      assert.match(corpo, /current_turn is null[\s\S]*modo_legado/);
      assert.match(corpo, /public\.mensagens_ti[\s\S]*modo_chat_simples/);
      assert.match(corpo, /public\.perguntas_ti/);
    }
  });

  it("executa pre-check de modo misto antes de qualquer RPC", () => {
    const sql = lerMigration();
    const begin = sql.indexOf("begin;");
    const primeiraRpc = sql.search(/create or replace function/);
    const preCheck = sql.slice(begin, primeiraRpc);

    assert.ok(begin >= 0);
    assert.ok(primeiraRpc > begin);
    assert.match(preCheck, /exists[\s\S]*public\.perguntas_ti[\s\S]*exists[\s\S]*public\.mensagens_ti/);
    assert.match(preCheck, /dados_ti_modo_misto/);
    assert.match(preCheck, /raise exception/);
    assert.match(preCheck, /errcode = 'p0001'/);
    assert.doesNotMatch(preCheck, /delete |update |insert /);
  });

  it("redefine enviar_mensagem_comunicacao_ti com guard de bloco antes do insert", () => {
    const corpo = corpoFuncao(lerMigration(), "enviar_mensagem_comunicacao_ti");
    const legado = corpo.search(/current_turn is null[\s\S]*modo_legado/);
    const guard = corpo.search(/public\.perguntas_ti[\s\S]*modo_bloco_perguntas/);
    const insert = corpo.search(/insert into public\.mensagens_ti/);

    assert.ok(legado >= 0);
    assert.ok(guard > legado);
    assert.ok(insert > guard);
    assert.match(corpo, /detail = 'modo_bloco_perguntas'/);
    assert.match(corpo, /char_length\(p_content\)[\s\S]*between 1 and 1000/);
    assert.match(corpo, /for update/);
  });

  it("mantém chat simples permitido quando não há perguntas_ti", () => {
    const corpo = corpoFuncao(lerMigration(), "enviar_mensagem_comunicacao_ti");
    assert.match(corpo, /insert into public\.mensagens_ti/);
    assert.match(corpo, /current_turn = 'ti'/);
    assert.match(corpo, /current_turn = 'solicitante'/);
    assert.doesNotMatch(corpo, /insert into public\.perguntas_ti/);
  });

  it("mantém execute apenas para service_role nas RPCs desta migration", () => {
    const sql = lerMigration();
    assert.match(
      sql,
      /revoke execute on function public\.enviar_mensagem_comunicacao_ti\(uuid, uuid, text\)[\s\S]*from public, anon, authenticated/,
    );
    assert.match(
      sql,
      /grant execute on function public\.enviar_mensagem_comunicacao_ti\(uuid, uuid, text\)[\s\S]*to service_role/,
    );
    assert.equal((sql.match(/grant execute on function[\s\S]*?to service_role/g) || []).length, 4);
    assert.doesNotMatch(
      sql,
      /grant execute on function[^\n]+\n\s*to (public|anon|authenticated)/,
    );
  });
});
