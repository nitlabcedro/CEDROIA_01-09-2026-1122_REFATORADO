import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deveAplicarEtapasDoServidor,
  impressaoDigitalEtapasFluxo,
  normalizarEtapasFluxoLocal,
} from "./configuracao-fluxo.util";

describe("configuracao-fluxo.util", () => {
  it("normaliza nomes fixos por número de etapa", () => {
    const nomes = { 1: "Etapa A", 2: "Etapa B" };
    const result = normalizarEtapasFluxoLocal(
      [
        { stepNumber: 1, roleName: "legado", userId: "u1", isOpinionOnly: false },
        { stepNumber: 2, roleName: "outro", isOpinionOnly: true },
      ],
      nomes,
    );
    assert.equal(result[0].roleName, "Etapa A");
    assert.equal(result[1].roleName, "Etapa B");
    assert.equal(result[0].userId, "u1");
  });

  it("gera impressão digital estável independente da ordem no array", () => {
    const a = [
      { stepNumber: 2, roleName: "B", userId: "x", isOpinionOnly: false },
      { stepNumber: 1, roleName: "A", userId: "y", isOpinionOnly: false },
    ];
    const b = [
      { stepNumber: 1, roleName: "A longo", userId: "y", isOpinionOnly: false },
      { stepNumber: 2, roleName: "B", userId: "x", isOpinionOnly: false },
    ];
    assert.equal(impressaoDigitalEtapasFluxo(a), impressaoDigitalEtapasFluxo(b));
  });

  it("não aplica servidor enquanto há edição local", () => {
    assert.equal(deveAplicarEtapasDoServidor(false), true);
    assert.equal(deveAplicarEtapasDoServidor(true), false);
  });
});
