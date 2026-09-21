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
    assert.match(fonte, /garantirGravacaoSupabase\(\{ error: stepDecisionError \}/);
    assert.match(fonte, /garantirGravacaoSupabase\(\{ error: workflowDecisionError \}/);
    assert.match(fonte, /garantirGravacaoSupabase\(\{ error: recordDecisionError \}/);
    assert.match(fonte, /if \(nextStep >= 3\) \{\s*newStatusUso = "Em teste\/piloto";/);
  });
});
