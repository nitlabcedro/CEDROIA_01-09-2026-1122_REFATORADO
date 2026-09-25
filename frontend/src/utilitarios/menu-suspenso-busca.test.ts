import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import {
  filtrarOpcoesMenuSuspenso,
  gestoEhToqueDeSelecao,
  normalizarTextoBusca,
} from "./menu-suspenso-busca";

const opcoes = [
  { value: "Anatomia Patológica", label: "Anatomia Patológica" },
  { value: "Assessoria", label: "Assessoria" },
  { value: "Assessoria Médica", label: "Assessoria Médica" },
  { value: "Citologia", label: "Citologia" },
];

describe("busca do menu suspenso", () => {
  it("ignora acentos e caixa ao filtrar", () => {
    assert.deepEqual(
      filtrarOpcoesMenuSuspenso(opcoes, "patologica").map((o) => o.value),
      ["Anatomia Patológica"],
    );
    assert.deepEqual(
      filtrarOpcoesMenuSuspenso(opcoes, "MEDICA").map((o) => o.value),
      ["Assessoria Médica"],
    );
  });

  it("combina termos soltos em qualquer ordem", () => {
    assert.deepEqual(
      filtrarOpcoesMenuSuspenso(opcoes, "medica assessoria").map((o) => o.value),
      ["Assessoria Médica"],
    );
  });

  it("devolve todas as opções com termo vazio ou só espaços", () => {
    assert.equal(filtrarOpcoesMenuSuspenso(opcoes, "").length, 4);
    assert.equal(filtrarOpcoesMenuSuspenso(opcoes, "   ").length, 4);
  });

  it("devolve lista vazia quando nada corresponde", () => {
    assert.deepEqual(filtrarOpcoesMenuSuspenso(opcoes, "juridico"), []);
  });

  it("trata valores nulos sem quebrar", () => {
    assert.equal(normalizarTextoBusca(null), "");
    assert.equal(normalizarTextoBusca(undefined), "");
  });
});

describe("gesto de seleção por toque", () => {
  it("aceita toque parado como seleção", () => {
    assert.equal(gestoEhToqueDeSelecao({ x: 100, y: 200 }, { x: 102, y: 204 }), true);
  });

  it("recusa arrasto vertical, que é rolagem da lista", () => {
    assert.equal(gestoEhToqueDeSelecao({ x: 100, y: 200 }, { x: 100, y: 260 }), false);
  });

  it("recusa gesto sem início registrado", () => {
    assert.equal(gestoEhToqueDeSelecao(null, { x: 10, y: 10 }), false);
  });
});

describe("MenuSuspenso — seleção e busca", () => {
  const fonte = readFileSync(
    resolve(process.cwd(), "frontend/src/componentes/comuns/MenuSuspenso.tsx"),
    "utf8",
  );

  it("não seleciona a opção no pointerdown", () => {
    assert.doesNotMatch(fonte, /onPointerDown[\s\S]{0,200}?onChange\(option\.value\)/);
    assert.match(fonte, /onPointerUp=\{\(event\) => \{/);
    assert.match(fonte, /gestoEhToqueDeSelecao\(/);
  });

  it("mantém ativação por teclado sem duplicar a seleção do toque", () => {
    assert.match(fonte, /event\.detail === 0/);
  });

  it("filtra as opções pelo termo digitado", () => {
    assert.match(fonte, /filtrarOpcoesMenuSuspenso\(/);
    assert.match(fonte, /menu-suspenso__busca-campo/);
  });
});
