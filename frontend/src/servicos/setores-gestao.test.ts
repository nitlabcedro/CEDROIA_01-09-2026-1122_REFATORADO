import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import {
  montarLinhasPersistenciaSetores,
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
        description: "Infraestrutura atualizada",
        responsible: "Nova Responsável",
        status: "Ativo" as const,
        cargos: ["Analista de Suporte", "Dev"],
      },
    };

    const linhas = montarLinhasPersistenciaSetores(["TI"], detalhes);
    assert.equal(linhas.length, 1);
    assert.equal(linhas[0].name, "TI");
    assert.equal(linhas[0].description, "Infraestrutura atualizada");
    assert.equal(linhas[0].responsible, "Nova Responsável");
    assert.deepEqual(linhas[0].cargos, ["Analista de Suporte", "Dev"]);
  });

  it("planeja remoção do nome antigo e upsert do novo ao renomear setor", () => {
    const detalhes = {
      "TI Corporativa": {
        description: "Setor renomeado",
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
    assert.equal(renomeado?.description, "Setor renomeado");
  });

  it("saveSectors delega persistência à tabela oficial public.sectors/setores", () => {
    assert.match(armazenamentoFonte, /persistirSetoresGestaoNoSupabase/);
    assert.match(armazenamentoFonte, /carregarSetoresGestaoDoSupabase/);
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
