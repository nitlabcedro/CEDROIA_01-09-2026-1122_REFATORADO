import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  interpretarComentarioAprovacao,
  montarComentarioParecerJustificativo,
  MENSAGEM_PARECER_JUSTIFICATIVO_OBRIGATORIO,
  placeholderParecerJustificativo,
  validarEnvioParecerJustificativo,
} from "./aprovacoes.utilitarios";

const pagina = readFileSync(
  fileURLToPath(new URL("./PaginaAprovacao.tsx", import.meta.url)),
  "utf8",
);
const hook = readFileSync(
  fileURLToPath(new URL("../../hooks/useAplicacao.ts", import.meta.url)),
  "utf8",
);

describe("Parecer justificativo — Presidência e Financeiro", () => {
  it("Presidência aprova com parecer e o texto é persistido no comment da etapa", () => {
    const comment = montarComentarioParecerJustificativo(
      4,
      "Aprovo a continuidade institucional da ferramenta.",
    );
    assert.match(comment, /Etapa: Presidência/);
    assert.match(comment, /Parecer justificativo: Aprovo a continuidade institucional da ferramenta\./);
    assert.equal(
      interpretarComentarioAprovacao(comment).parecer,
      "Aprovo a continuidade institucional da ferramenta.",
    );
    assert.equal(validarEnvioParecerJustificativo(4, false, comment), null);
  });

  it("Presidência nega com parecer persistido e a decisão segue como negativa", () => {
    const comment = montarComentarioParecerJustificativo(
      4,
      "A solicitação não atende à diretriz institucional.",
    );
    assert.equal(validarEnvioParecerJustificativo(4, true, "A solicitação não atende à diretriz institucional."), null);
    assert.equal(
      interpretarComentarioAprovacao(comment).parecer,
      "A solicitação não atende à diretriz institucional.",
    );
    assert.match(pagina, /status === StatusAuditoria\.NEGADO/);
    assert.match(pagina, /onUpdateStatus\(record\.id, status, finalComment/);
  });

  it("Presidência nega sem parecer é bloqueada no frontend", () => {
    assert.equal(
      validarEnvioParecerJustificativo(4, true, "   "),
      MENSAGEM_PARECER_JUSTIFICATIVO_OBRIGATORIO,
    );
    assert.match(pagina, /validarEnvioParecerJustificativo/);
    assert.match(
      pagina,
      /if \(erroParecerJustificativo\) \{\s*setErroInteracoesTi\(erroParecerJustificativo\);\s*return;/,
    );
  });

  it("Financeiro aprova com parecer persistido e o workflow permanece decisório", () => {
    const comment = montarComentarioParecerJustificativo(
      5,
      "Há cobertura orçamentária para o ciclo vigente.",
    );
    assert.match(comment, /Etapa: Direção Financeira/);
    assert.equal(
      interpretarComentarioAprovacao(comment).parecer,
      "Há cobertura orçamentária para o ciclo vigente.",
    );
    assert.equal(validarEnvioParecerJustificativo(5, false, "Há cobertura orçamentária para o ciclo vigente."), null);
    assert.match(pagina, /Decisão Executiva/);
    assert.doesNotMatch(pagina, /consultivo|Consultivo|etapa consultiva/i);
  });

  it("Financeiro nega com parecer persistido", () => {
    const comment = montarComentarioParecerJustificativo(
      5,
      "Não há disponibilidade financeira neste exercício.",
    );
    assert.equal(
      validarEnvioParecerJustificativo(5, true, "Não há disponibilidade financeira neste exercício."),
      null,
    );
    assert.equal(
      interpretarComentarioAprovacao(comment).parecer,
      "Não há disponibilidade financeira neste exercício.",
    );
  });

  it("Financeiro nega sem parecer é bloqueado", () => {
    assert.equal(
      validarEnvioParecerJustificativo(5, true, ""),
      "Informe o parecer justificativo para negar esta etapa.",
    );
  });

  it("histórico da ficha/modal exibe o parecer da Presidência", () => {
    const persistido = montarComentarioParecerJustificativo(4, "Deliberação da Presidência registrada.");
    assert.equal(
      interpretarComentarioAprovacao(persistido).parecer,
      "Deliberação da Presidência registrada.",
    );
    assert.match(pagina, /parsedOpinion\?\.parecer/);
    assert.match(pagina, /Parecer justificativo/);
    assert.match(pagina, /campoParecerJustificativo/);
    assert.match(pagina, /placeholderParecerJustificativo\(currentStepNum\)/);
  });

  it("histórico exibe o parecer Financeiro", () => {
    const persistido = montarComentarioParecerJustificativo(5, "Deliberação financeira registrada.");
    assert.equal(
      interpretarComentarioAprovacao(persistido).parecer,
      "Deliberação financeira registrada.",
    );
    assert.equal(
      placeholderParecerJustificativo(5),
      "Descreva a justificativa da decisão da Direção Financeira...",
    );
    assert.match(pagina, /parsed\.parecer \|\| s\.comment/);
  });

  it("etapas 1–3 preservam o formato e a validação anteriores", () => {
    assert.match(
      pagina,
      /`Etapa: NIT\\n` \+\s*`Parecer Técnico Justificado: \$\{/,
    );
    assert.match(
      pagina,
      /`Etapa: TI\\n` \+\s*`Parecer Técnico Justificado: \$\{/,
    );
    assert.match(
      pagina,
      /`Etapa: Período de Teste\\n` \+\s*`Relatório do Período de Testes: \$\{/,
    );
    assert.equal(validarEnvioParecerJustificativo(1, true, ""), null);
    assert.equal(validarEnvioParecerJustificativo(2, true, ""), null);
    assert.equal(validarEnvioParecerJustificativo(3, true, ""), null);
  });

  it("não altera SQL/migration e continua persistindo no comment existente", () => {
    assert.match(hook, /JSON\.stringify\(\{ recordId, stepNumber: currentStepNum, decision, comment \}\)/);
    assert.match(pagina, /montarComentarioParecerJustificativo\(currentStepNum, auditComment\)/);
    assert.doesNotMatch(pagina, /ALTER TABLE|CREATE TABLE|parecer_justificativo/);
    assert.doesNotMatch(hook, /ALTER TABLE|CREATE TABLE|parecer_justificativo/);
  });
});
