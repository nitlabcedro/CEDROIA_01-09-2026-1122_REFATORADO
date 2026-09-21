import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ler = (relativo: string) => readFileSync(
  fileURLToPath(new URL(relativo, import.meta.url)),
  "utf8",
);

describe("cedro-segment-nav — páginas consumidoras", () => {
  const aprovacoes = ler("../../paginas/aprovacoes/PaginaAprovacao.tsx");
  const administracao = ler("../../paginas/administracao/PainelAdministrativo.tsx");
  const relatorios = ler("../../paginas/relatorios/VisualizacaoRelatorio.tsx");
  const estilos = ler("./cedro-segment-nav.css");
  const indice = ler("../index.css");

  it("expõe o CSS compartilhado no bundle global", () => {
    assert.match(indice, /cedro-segment-nav\.css/);
    assert.match(estilos, /\.cedro-segment-nav__item--ativo/);
    assert.match(estilos, /cedro-segment-nav__grupo--rolagem/);
  });

  it("Aprovações mantém abas e navegação por estado local", () => {
    assert.match(aprovacoes, /Fila de aprovação/);
    assert.match(aprovacoes, /Configurar fluxo/);
    assert.match(aprovacoes, /setActiveTab\("queue"\)/);
    assert.match(aprovacoes, /setActiveTab\("config"\)/);
    assert.match(aprovacoes, /cedro-segment-nav__grupo--dupla/);
    assert.match(aprovacoes, /hidden=\{activeTab !== "config"\}/);
  });

  it("Administração IA mantém Cadastro de IAs, Usuários e handlers de aba", () => {
    assert.match(administracao, /Cadastro de IAs/);
    assert.match(administracao, /Usuários/);
    assert.match(administracao, /setActiveTab\(tab\.id as AdminTab\)/);
    assert.match(administracao, /data-aba=\{tab\.id\}/);
    assert.match(administracao, /cedro-segment-nav__item--ativo/);
    assert.doesNotMatch(administracao, /administracao__botao-2/);
  });

  it("Relatórios mantém as cinco abas oficiais e setActiveTab por id", () => {
    assert.match(relatorios, /ABAS_RELATORIO_IA\.map/);
    assert.match(relatorios, /cedro-segment-nav__grupo--rolagem/);
    assert.match(relatorios, /setActiveTab\(tab\.id\)/);
    assert.match(relatorios, /activeTab === "visao-geral"/);
    assert.match(relatorios, /activeTab === "finalidade-uso"/);
    assert.match(relatorios, /activeTab === "nit"/);
    assert.match(relatorios, /activeTab === "ti"/);
    assert.match(relatorios, /activeTab === "relatorio"/);
  });
});
