import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const fonte = readFileSync(
  fileURLToPath(new URL("./useAplicacao.ts", import.meta.url)),
  "utf8",
);

describe("useAplicacao — persistência da decisão", () => {
  it("propaga erro da decisão para o chamador em vez de engolir a falha", () => {
    assert.match(fonte, /throw new Error\(errRes\.error/);
    assert.match(fonte, /await refreshRecords\(\);\s*throw error;/);
  });

  it("não executa fallback de escrita no Supabase para decidir etapa", () => {
    const handle = fonte.slice(fonte.indexOf("const handleUpdateStatus"));
    const corpo = handle.slice(0, handle.indexOf("const handleResetStatus"));
    assert.match(corpo, /ROTAS_API\.WORKFLOW_DECIDE/);
    assert.doesNotMatch(corpo, /TABELAS_SUPABASE\.REGISTROS_IA/);
    assert.doesNotMatch(corpo, /fallback local/);
  });
});
