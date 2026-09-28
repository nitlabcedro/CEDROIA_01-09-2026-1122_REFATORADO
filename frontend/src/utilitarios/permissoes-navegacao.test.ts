import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { abaPermitida } from "@/utilitarios/permissoes-navegacao";

describe("abaPermitida", () => {
  it("libera as abas comuns para qualquer papel", () => {
    for (const aba of ["dashboard", "inventory", "new", "chat", "profile"] as const) {
      assert.equal(abaPermitida(aba, false, false), true);
    }
  });

  it("restringe Mapa de IAs e Setores ao administrador", () => {
    assert.equal(abaPermitida("sectors", false, false), false);
    assert.equal(abaPermitida("sectors_mgr", false, true), false);
    assert.equal(abaPermitida("sectors", true, true), true);
    assert.equal(abaPermitida("sectors_mgr", true, true), true);
  });

  it("restringe Aprovação e Administração ao usuário privilegiado", () => {
    assert.equal(abaPermitida("approval_queue", false, false), false);
    assert.equal(abaPermitida("admin", false, false), false);
    assert.equal(abaPermitida("approval_queue", false, true), true);
    assert.equal(abaPermitida("admin", false, true), true);
    assert.equal(abaPermitida("approval_queue", true, true), true);
    assert.equal(abaPermitida("admin", true, true), true);
  });
});
