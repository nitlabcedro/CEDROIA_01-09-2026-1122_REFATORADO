import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizarDetalhesSetor } from "./detalhes-setor-gestao";

describe("normalizarDetalhesSetor", () => {
  it("usa preset quando Supabase retorna apenas status", () => {
    const resultado = normalizarDetalhesSetor(
      { status: "Ativo" },
      {
        responsible: "Responsável preset",
        status: "Ativo",
        cargos: ["Analista"],
      },
    );

    assert.equal(resultado.responsible, "Responsável preset");
    assert.equal(resultado.status, "Ativo");
    assert.deepEqual(resultado.cargos, ["Analista"]);
    assert.equal("description" in resultado, false);
  });

  it("não quebra com responsible undefined e aplica defaults sem preset", () => {
    const resultado = normalizarDetalhesSetor(
      { status: "Ativo", responsible: undefined },
      undefined,
    );

    assert.ok(resultado.responsible.length > 0);
    assert.equal(resultado.status, "Ativo");
    assert.deepEqual(resultado.cargos, ["Colaborador"]);
  });

  it("preserva texto salvo pelo usuário mesmo com preset disponível", () => {
    const resultado = normalizarDetalhesSetor(
      {
        responsible: "Maria",
        status: "Inativo",
        cargos: ["Dev"],
      },
      {
        responsible: "Preset",
        status: "Ativo",
        cargos: ["Outro"],
      },
    );

    assert.equal(resultado.responsible, "Maria");
    assert.equal(resultado.status, "Inativo");
    assert.deepEqual(resultado.cargos, ["Dev"]);
  });

  it("trata string vazia como ausente para permitir fallback de responsável e cargos", () => {
    const resultado = normalizarDetalhesSetor(
      { responsible: "", cargos: ["  "] },
      { responsible: "Preset", status: "Ativo", cargos: ["Analista"] },
    );

    assert.equal(resultado.responsible, "Preset");
    assert.deepEqual(resultado.cargos, ["Analista"]);
  });
});
