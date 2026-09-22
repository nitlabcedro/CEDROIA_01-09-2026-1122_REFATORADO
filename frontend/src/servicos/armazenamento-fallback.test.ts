import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  obterColunaInexistente,
  obterColunaLegadaRemovivel,
} from "./compatibilidade-registros";

const armazenamento = readFileSync(
  fileURLToPath(new URL("./armazenamento.ts", import.meta.url)),
  "utf8",
);
const persistir = armazenamento.slice(
  armazenamento.indexOf("async function persistirRegistroIa"),
  armazenamento.indexOf("export const saveRecordsToSupabase"),
);

const payloadMatch = persistir.match(
  /const payload: Record<string, unknown> = \{([\s\S]*?)\n    \};/,
);
assert.ok(payloadMatch, "payload de registros_ia não encontrado");
const payload = payloadMatch[1];

describe("persistência segura de registros_ia", () => {
  it("D/G — criação envia owner_id e não envia a coluna inexistente status", () => {
    assert.match(payload, /owner_id: resolvedOwnerId/);
    assert.match(payload, /status_uso: record\.statusUso/);
    assert.doesNotMatch(payload, /\bstatus\s*:/);
  });

  it("E/F — owner_id e status_uso nunca podem ser removidos pelo fallback", () => {
    const campos = {
      id: "IA-00000002",
      data: {},
      unidade_setor: "NIT",
      owner_id: "c9e95c82-1245-4a58-ba25-0e1ba9901b75",
      status_uso: "Em avaliação",
    };
    assert.equal(obterColunaLegadaRemovivel(
      { message: 'column registros_ia.owner_id does not exist' },
      campos,
    ), null);
    assert.equal(obterColunaLegadaRemovivel(
      { message: 'column registros_ia.status_uso does not exist' },
      campos,
    ), null);
    assert.doesNotMatch(persistir, /delete currentPayload\[['"]owner_id['"]\]/);
    assert.doesNotMatch(persistir, /fallbackRemovals/);
  });

  it("H — erro genérico 400 não remove campos", () => {
    const erro = { message: "Bad Request" };
    assert.equal(obterColunaInexistente(erro), null);
    assert.equal(obterColunaLegadaRemovivel(erro, { nome_ferramenta: "IA" }), null);
  });

  it("I — só mensagem explícita de coluna inexistente ativa compatibilidade legada", () => {
    assert.equal(
      obterColunaLegadaRemovivel(
        { message: "Could not find the 'nome_ferramenta' column of 'registros_ia' in the schema cache" },
        { nome_ferramenta: "IA" },
      ),
      "nome_ferramenta",
    );
    assert.equal(
      obterColunaLegadaRemovivel(
        { message: 'column registros_ia.responsavel_preenchimento does not exist' },
        { responsavel_preenchimento: "Maria" },
      ),
      "responsavel_preenchimento",
    );
    assert.equal(
      obterColunaLegadaRemovivel(
        { message: "erro de validação na coluna nome_ferramenta" },
        { nome_ferramenta: "IA" },
      ),
      null,
    );
  });

  it("J — owner inválido aborta criação e não há fallback para violação de FK", () => {
    assert.match(
      persistir,
      /if \(!userId \|\| !isValidUUID\(userId\)\) \{\s*throw new Error\("Não foi possível criar a solicitação: owner_id autenticado é obrigatório\."\)/,
    );
    assert.doesNotMatch(persistir, /Violação de chave estrangeira em owner_id/);
    assert.doesNotMatch(persistir, /Removendo owner_id/);
  });

  it("K/L — edição preserva owner existente e admin não assume propriedade", () => {
    const blocoEdicao = persistir.match(
      /\} else \{\s*const ownerExistente[\s\S]*?\n    \}/,
    );
    assert.ok(blocoEdicao);
    assert.match(blocoEdicao[0], /record\.ownerId/);
    assert.match(blocoEdicao[0], /resolvedOwnerId = ownerExistente/);
    assert.doesNotMatch(blocoEdicao[0], /resolvedOwnerId = userId/);
    assert.doesNotMatch(blocoEdicao[0], /finalIsAdmin[\s\S]*owner/);
  });
});
