import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { statusCor, statusCorEtapa } from "./gerarRelatorioPdf";

describe("cores de status do PDF", () => {
  it("mantém somente aprovações efetivas na identidade positiva", () => {
    assert.equal(statusCor("Aprovada").texto, "#075618");
    assert.equal(statusCorEtapa("Aprovado").linha, "#075618");
  });

  it("prioriza status negativos que contêm a palavra aprovado", () => {
    for (const status of ["Não aprovada", "Não aprovado", "Negado", "Indeferido"]) {
      assert.equal(statusCor(status).texto, "#DC2626");
      assert.equal(statusCorEtapa(status).linha, "#DC2626");
    }
  });
});
