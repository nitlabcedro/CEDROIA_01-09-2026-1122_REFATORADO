import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { ASSET_IA_GENERICA } from "../../utilitarios/identidade-ia";
import { obterProximoAssetAposFalha } from "./IconeIA";

const componente = readFileSync(
  resolve(process.cwd(), "frontend/src/componentes/comuns/IconeIA.tsx"),
  "utf8",
);

describe("componente IconeIA", () => {
  it("resolve a identidade sem expor caminhos aos consumidores", () => {
    assert.match(componente, /obterIdentidadeIA\(nome,\s*\{\s*personalizada\s*\}\)/);
    assert.match(componente, /identidade\.asset/);
  });

  it("troca uma imagem com erro pelo SVG institucional", () => {
    assert.equal(obterProximoAssetAposFalha("/ias/chatgpt.svg"), ASSET_IA_GENERICA);
  });

  it("encerra no fallback interno se o SVG institucional também falhar", () => {
    assert.equal(obterProximoAssetAposFalha(ASSET_IA_GENERICA), null);
    assert.match(componente, /Sparkles/);
  });

  it("permite uso decorativo ou isolado com nome acessível", () => {
    assert.match(componente, /decorativo/);
    assert.match(componente, /aria-label/);
    assert.match(componente, /alt=\{decorativo\s*\?\s*""/);
  });
});
