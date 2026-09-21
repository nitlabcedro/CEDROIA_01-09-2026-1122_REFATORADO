import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { describe, it } from "node:test";

const raizFrontend = resolve(process.cwd(), "frontend/src");
const ler = (caminho: string) => readFileSync(resolve(raizFrontend, caminho), "utf8");
const contarIcones = (fonte: string) => fonte.match(/<IconeIA\b/g)?.length ?? 0;

const inventario = ler("paginas/inventario/Inventario.tsx");
const aprovacoes = ler("paginas/aprovacoes/PaginaAprovacao.tsx");
const administracao = ler("paginas/administracao/PainelAdministrativo.tsx");
const mapa = ler("paginas/relatorios/MapaSetores.tsx");
const detalhes = ler("paginas/relatorios/VisualizacaoRelatorio.tsx");
const comunicacaoTi = ler("componentes/aprovacoes/ModalComunicacaoTI.tsx");
const catalogoPainel = ler("componentes/comuns/CartaoTabela.tsx");

describe("propagação central da identidade visual das IAs", () => {
  it("renderiza IconeIA nas listagens desktop e mobile do Inventário", () => {
    assert.match(inventario, /import\s+\{\s*IconeIA\s*\}/);
    assert.ok(contarIcones(inventario) >= 2);
    assert.match(inventario, /record\.nomeFerramenta/);
    assert.match(inventario, /record\.id/);
    assert.match(inventario, /getStatusBadge\(record\)/);
  });

  it("renderiza IconeIA na fila, detalhes e modais desktop/mobile de Aprovações", () => {
    assert.match(aprovacoes, /import\s+\{\s*IconeIA\s*\}/);
    assert.ok(contarIcones(aprovacoes) >= 5);
    assert.match(aprovacoes, /record\.nomeFerramenta/);
    assert.match(aprovacoes, /record\.id/);
    assert.match(aprovacoes, /statusGeral/);
  });

  it("renderiza IconeIA nos cards, listas, histórico e modal da Administração", () => {
    assert.match(administracao, /import\s+\{\s*IconeIA\s*\}/);
    assert.ok(contarIcones(administracao) >= 4);
    assert.doesNotMatch(administracao, /IconeIAHistoricoUsuario|identificarMarcaIA/);
    assert.match(administracao, /record\.id/);
    assert.match(administracao, /obterStatusDoRegistro/);
  });

  it("renderiza IconeIA nos itens e no modal do Mapa de IAs", () => {
    assert.match(mapa, /import\s+\{\s*IconeIA\s*\}/);
    assert.ok(contarIcones(mapa) >= 2);
    assert.doesNotMatch(mapa, /IconeInteligenciaArtificial|identificarMarcaIA/);
    assert.match(mapa, /r\.nomeFerramenta/);
    assert.match(mapa, /obterStatus\(r\)/);
  });

  it("renderiza IconeIA no cabeçalho dos detalhes e da Comunicação TI", () => {
    assert.match(detalhes, /<IconeIA\s+nome=\{record\.nomeFerramenta\}/);
    assert.match(detalhes, /record\.nomeFerramenta/);
    assert.match(detalhes, /statusGeral/);
    assert.match(comunicacaoTi, /<IconeIA\s+nome=\{nomeFerramenta\s*\|\|\s*recordId\}/);
  });

  it("mantém IconeIA no catálogo do Painel em desktop e mobile", () => {
    assert.ok(contarIcones(catalogoPainel) >= 2);
    assert.match(catalogoPainel, /record\.nomeFerramenta/);
    assert.match(catalogoPainel, /record\.id/);
    assert.match(catalogoPainel, /StatusBadge/);
  });

  it("não duplica registry nem hardcode de assets nas telas", () => {
    const visitar = (diretorio: string): string[] =>
      readdirSync(diretorio, { withFileTypes: true }).flatMap((item) => {
        const caminho = join(diretorio, item.name);
        if (item.isDirectory()) return visitar(caminho);
        if (![".ts", ".tsx"].includes(extname(item.name))) return [];
        if (item.name.endsWith(".test.ts") || item.name === "identidade-ia.ts") return [];
        return [caminho];
      });

    for (const arquivo of visitar(raizFrontend)) {
      const fonte = readFileSync(arquivo, "utf8");
      assert.doesNotMatch(fonte, /\/ias\/[^"'`]+\.svg/);
    }
  });
});
