import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const fonte = readFileSync(
  fileURLToPath(new URL("./useAplicacao.ts", import.meta.url)),
  "utf8",
);

describe("useAplicacao — persistência da decisão", () => {
  it("alinha o fallback de status_uso com o backend ao avançar para a etapa 3", () => {
    assert.match(fonte, /if \(nextStep >= 3\) \{\s*newStatusUso = "Em teste\/piloto";/);
    assert.doesNotMatch(fonte, /if \(nextStep >= 4\) \{\s*newStatusUso = "Em teste\/piloto";/);
  });

  it("propaga erro da decisão para o chamador em vez de engolir a falha", () => {
    assert.match(fonte, /throw new Error\(errRes\.error\);/);
    assert.match(fonte, /await refreshRecords\(\);\s*throw error;/);
  });
});
