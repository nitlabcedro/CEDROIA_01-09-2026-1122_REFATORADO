import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const formulario = readFileSync(
  resolve(process.cwd(), "frontend/src/paginas/inventario/FormularioCadastro.tsx"),
  "utf8",
);

describe("identidade das IAs na nova solicitação", () => {
  it("renderiza o registry central nos seis cards da Escolha da IA", () => {
    assert.match(
      formulario,
      /\["ChatGPT", "Google Gemini", "Microsoft Copilot", "Claude", "Grok", "Outro"\]/,
    );
    assert.match(formulario, /<IconeIA\s+nome=\{name\}\s+tamanho=\{48\}/);
    assert.doesNotMatch(formulario, /const simbolos:/);
  });

  it("preserva o comportamento de seleção dos cards oficiais e Outro", () => {
    assert.match(formulario, /if \(name === "Outro"\)/);
    assert.match(formulario, /setOutroActive\(true\)/);
    assert.match(formulario, /updateField\("nomeFerramenta", ""\)/);
    assert.match(formulario, /setOutroActive\(false\)/);
    assert.match(formulario, /updateField\("nomeFerramenta", name\)/);
  });
});
