import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const fonte = readFileSync(
  fileURLToPath(new URL("./Inventario.tsx", import.meta.url)),
  "utf8",
);

const canCancel = fonte.slice(fonte.indexOf("const canCancel"));

describe("Inventario canCancel", () => {
  it("autoriza só por owner_id/ownerId ou admin, sem nome/e-mail", () => {
    assert.match(canCancel, /record\.ownerId/);
    assert.match(canCancel, /owner_id/);
    assert.match(canCancel, /isAdmin/);
    assert.doesNotMatch(canCancel, /emailSolicitante|responsavelPreenchimento|contato/);
    assert.match(canCancel, /Aprovada/);
    assert.match(canCancel, /Não aprovada/);
    assert.match(canCancel, /Cancelada/);
  });
});
