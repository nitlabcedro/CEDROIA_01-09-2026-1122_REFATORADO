import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import {
  montarLinhasPersistenciaSetores,
  planejarEscritaSetores,
  planejarSincronizacaoSetores,
} from "./setores-gestao";

const armazenamentoFonte = readFileSync(
  resolve(process.cwd(), "frontend/src/servicos/armazenamento.ts"),
  "utf8",
);

describe("setores-gestao — atualização de setores", () => {
  it("envia o ID lógico (nome) correto e os novos dados ao editar um setor existente", () => {
    const detalhes = {
      TI: {
        responsible: "Nova Responsável",
        status: "Ativo" as const,
        cargos: ["Analista de Suporte", "Dev"],
      },
    };

    const linhas = montarLinhasPersistenciaSetores(["TI"], detalhes);
    assert.equal(linhas.length, 1);
    assert.equal(linhas[0].name, "TI");
    assert.equal(linhas[0].responsible, "Nova Responsável");
    assert.equal(linhas[0].status, "Ativo");
    assert.deepEqual(linhas[0].cargos, ["Analista de Suporte", "Dev"]);
    assert.equal("description" in linhas[0], false);
  });

  it("planeja remoção do nome antigo e upsert do novo ao renomear setor", () => {
    const detalhes = {
      "TI Corporativa": {
        responsible: "Gestor",
        status: "Ativo" as const,
        cargos: ["Colaborador"],
      },
    };

    const plano = planejarSincronizacaoSetores(
      ["TI Corporativa", "NIT"],
      {
        ...detalhes,
        NIT: { status: "Ativo", cargos: ["Pesquisador"] },
      },
      ["TI", "NIT"],
    );

    assert.deepEqual(plano.nomesRemover, ["TI"]);
    assert.equal(plano.upserts.length, 2);
    const renomeado = plano.upserts.find((l) => l.name === "TI Corporativa");
    assert.ok(renomeado);
    assert.equal(renomeado?.responsible, "Gestor");
    assert.equal("description" in (renomeado ?? {}), false);
  });

  it("saveSectors delega persistência à tabela oficial public.sectors e não grava METADATA-SECTORS", () => {
    assert.match(armazenamentoFonte, /persistirSetoresGestaoNoSupabase/);
    assert.match(armazenamentoFonte, /carregarSetoresGestaoDoSupabase/);
    assert.doesNotMatch(armazenamentoFonte, /eq\("id",\s*["']METADATA-SECTORS["']\)/);
    assert.doesNotMatch(armazenamentoFonte, /id:\s*["']METADATA-SECTORS["']/);
  });

  it("planeja UPDATE do setor existente e INSERT apenas do nome novo", () => {
    const upserts = montarLinhasPersistenciaSetores(
      ["TI", "NIT Novo"],
      {
        TI: { status: "Ativo", cargos: ["Analista"], responsible: "Maria" },
        "NIT Novo": { status: "Ativo", cargos: ["Pesquisador"] },
      },
    );
    const escrita = planejarEscritaSetores(upserts, [
      { id: "uuid-ti", name: "TI" },
    ]);

    assert.equal(escrita.atualizacoes.length, 1);
    assert.equal(escrita.atualizacoes[0].id, "uuid-ti");
    assert.equal(escrita.atualizacoes[0].linha.responsible, "Maria");
    assert.equal("description" in escrita.atualizacoes[0].linha, false);
    assert.equal(escrita.insercoes.length, 1);
    assert.equal(escrita.insercoes[0].name, "NIT Novo");
  });

  it("não usa upsert onConflict name; atualiza pela PK id", () => {
    assert.doesNotMatch(armazenamentoFonte, /onConflict:\s*["']name["']/);
    const gestao = readFileSync(
      resolve(process.cwd(), "frontend/src/servicos/setores-gestao.ts"),
      "utf8",
    );
    assert.doesNotMatch(gestao, /onConflict:\s*["']name["']/);
    assert.match(gestao, /\.update\(payload\)/);
    assert.match(gestao, /consulta\.eq\("id", alvo\.id\)/);
    assert.match(gestao, /\.insert\(payload\)/);
    assert.doesNotMatch(gestao, /description/);
  });

  it("não trata lista vazia de remoções como sucesso de exclusão indevida", () => {
    const plano = planejarSincronizacaoSetores(
      ["NIT", "TI"],
      {
        NIT: { status: "Ativo", cargos: ["A"] },
        TI: { status: "Ativo", cargos: ["B"] },
      },
      ["NIT", "TI"],
    );

    assert.deepEqual(plano.nomesRemover, []);
    assert.equal(plano.upserts.length, 2);
  });
});
