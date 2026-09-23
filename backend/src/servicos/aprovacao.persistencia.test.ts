import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { garantirGravacaoSupabase } from "./aprovacao.servico";

const fonte = readFileSync(
  fileURLToPath(new URL("./aprovacao.servico.ts", import.meta.url)),
  "utf8",
);

describe("persistência das decisões de aprovação", () => {
  it("lança quando o Supabase devolve error em gravação crítica", () => {
    assert.doesNotThrow(() => garantirGravacaoSupabase({ error: null }, "etapa"));
    assert.throws(
      () => garantirGravacaoSupabase({ error: { message: "timeout" } }, "Não foi possível atualizar o fluxo de aprovação"),
      /Não foi possível atualizar o fluxo de aprovação: timeout/,
    );
  });

  it("confere error das gravações de etapa, fluxo e registro na decisão", () => {
    assert.match(fonte, /garantirGravacaoSupabase\(\s*\{ error: stepDecisionError, data: etapaPersistida \}/);
    assert.match(fonte, /garantirGravacaoSupabase\(\s*\{ error: workflowDecisionError, data: workflowPersistido \}/);
    assert.match(fonte, /garantirGravacaoSupabase\(\s*\{ error: recordDecisionError, data: registroPersistido \}/);
    assert.match(fonte, /updatePayload\.status_uso = "Não aprovado"/);
    assert.doesNotMatch(fonte, /updatePayload\.status\s*=/);
    assert.doesNotMatch(fonte, /\.select\("id, status, status_uso"\)/);
    assert.match(fonte, /statusUso: nextStep >= 3 \? "Em teste\/piloto" : "Em avaliação"/);
  });

  it("exige linha atualizada quando gravação crítica não afeta registros", () => {
    assert.throws(
      () => garantirGravacaoSupabase({ error: null, data: [] }, "fluxo", true),
      /nenhuma linha foi atualizada/,
    );
  });
});
