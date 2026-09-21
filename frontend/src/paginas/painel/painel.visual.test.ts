import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const painel = readFileSync(resolve(process.cwd(), "frontend/src/paginas/painel/Painel.tsx"), "utf8");
const estilos = readFileSync(resolve(process.cwd(), "frontend/src/estilos/paginas/dashboard.css"), "utf8");

describe("refino visual do dashboard", () => {
  it("remove comparações vagas e ações fictícias", () => {
    assert.doesNotMatch(painel, /vs\.\s*30 dias/i);
    assert.doesNotMatch(painel, /Mapear nova ferramenta integrada/i);
    assert.doesNotMatch(painel, /Revisar uso de cookies/i);
  });

  it("mantém títulos objetivos e estados vazios claros", () => {
    assert.match(painel, /Evolução do catálogo/);
    assert.match(painel, /Status das aprovações/);
    assert.match(painel, /Ainda não há dados para exibir/);
    assert.match(painel, /Nenhuma IA cadastrada/);
    assert.match(painel, /Catálogo de IAs/);
  });

  it("preserva gráficos responsivos em telas menores", () => {
    assert.match(estilos, /@media \(max-width: 1023px\)[\s\S]*?\.pagina-dashboard \.painel__painel-cartao-estrutura[\s\S]*?display: flex !important/);
    assert.match(estilos, /\.pagina-dashboard \.painel__estado-vazio-grafico/);
    assert.match(estilos, /\.pagina-dashboard \.cartao-kpi__valor/);
  });

  it("substitui Próximas ações por Acesso rápido", () => {
    assert.doesNotMatch(painel, /Próximas ações/);
    assert.doesNotMatch(painel, /<ActionCard/);
    assert.match(painel, /<AcessoRapido/);
  });

  it("aplica IconeIA ao catálogo sem remover seus dados", () => {
    const catalogo = readFileSync(
      resolve(process.cwd(), "frontend/src/componentes/comuns/CartaoTabela.tsx"),
      "utf8",
    );

    assert.match(catalogo, /<IconeIA\s+nome=\{record\.nomeFerramenta\}/);
    assert.match(catalogo, /record\.id/);
    assert.match(catalogo, /record\.unidadeSetor/);
    assert.match(catalogo, /StatusBadge/);
  });
});
