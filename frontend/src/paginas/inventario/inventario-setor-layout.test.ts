import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const componente = readFileSync(
  resolve(process.cwd(), "frontend/src/paginas/inventario/Inventario.tsx"),
  "utf8",
);
const estilos = readFileSync(
  resolve(process.cwd(), "frontend/src/estilos/paginas/inventario.css"),
  "utf8",
);

describe("layout da coluna Setor no Inventário", () => {
  it("trunca setor longo e mantém o nome completo no title", () => {
    assert.match(componente, /className="inventario__texto-16 inventario__texto-setor"/);
    assert.match(componente, /title=\{record\.unidadeSetor \|\| "Não informado"\}/);

    const regra = estilos.match(/\.inventario__texto-setor\s*\{[^}]+\}/)?.[0] || "";
    assert.match(regra, /overflow:\s*hidden/);
    assert.match(regra, /text-overflow:\s*ellipsis/);
    assert.match(regra, /white-space:\s*nowrap/);

    // text-overflow nao se aplica a flex: o chip precisa continuar como bloco em linha.
    const regraPagina = estilos.match(/\.pagina-inventario \.inventario__texto-setor\s*\{[^}]+\}/)?.[0] || "";
    assert.match(regraPagina, /display:\s*inline-block/);
    assert.match(regraPagina, /text-overflow:\s*ellipsis/);
  });

  it("dá a maior fatia proporcional ao Setor e mantém o Status compacto", () => {
    const setor = estilos.match(/\.inventario__celula-setor\s*\{[^}]+\}/)?.[0] || "";
    const status = estilos.match(/\.inventario__celula-status\s*\{[^}]+\}/)?.[0] || "";

    assert.doesNotMatch(setor, /width:\s*\d+px/);
    assert.match(setor, /overflow:\s*hidden/);
    assert.match(status, /white-space:\s*nowrap/);

    const colunas = [...estilos.matchAll(/td:nth-child\((\d)\)\s*\{\s*width:\s*(\d+)%/g)].
      map(([, indice, largura]) => ({ indice: Number(indice), largura: Number(largura) }));
    const larguraSetor = colunas.find((coluna) => coluna.indice === 3)?.largura ?? 0;

    assert.equal(colunas.length, 7);
    assert.equal(colunas.reduce((total, coluna) => total + coluna.largura, 0), 100);
    assert.ok(colunas.every((coluna) => coluna.indice === 3 || coluna.largura < larguraSetor));
  });
});
