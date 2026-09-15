import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resetCacheLogoRelatorioPdf } from "./gerarRelatorioPdf";

describe("gerarRelatorioPdf logo cache", () => {
  it("resetCacheLogoRelatorioPdf limpa estado sem lançar", () => {
    resetCacheLogoRelatorioPdf();
    resetCacheLogoRelatorioPdf();
    assert.ok(true);
  });
});
