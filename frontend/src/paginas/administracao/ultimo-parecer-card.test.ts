import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { LIMITE_TEXTO_FLUXO_APROVACAO } from "../../constantes/fluxo-aprovacao";
import { obterUltimoParecerLimpo } from "../../utilitarios/pareceres";

const caminhoPainel = fileURLToPath(new URL("./PainelAdministrativo.tsx", import.meta.url));
const caminhoCssAprovacoes = fileURLToPath(
  new URL("../../estilos/paginas/aprovacoes.css", import.meta.url),
);
const caminhoCssAdministracao = fileURLToPath(
  new URL("../../estilos/paginas/administracao.css", import.meta.url),
);

function ler(caminho: string) {
  return readFileSync(caminho, "utf8");
}

function blocoUltimoParecer(fonte: string) {
  const inicio = fonte.indexOf("administracao__descricao-ultimo-parecer");
  assert.ok(inicio >= 0, "bloco Último Parecer não encontrado");
  return fonte.slice(inicio, inicio + 900);
}

describe("último parecer nos cards da Administração IA", () => {
  it("reutiliza TextoExibicaoFluxoAprovacao no texto do parecer", () => {
    const bloco = blocoUltimoParecer(ler(caminhoPainel));
    assert.match(bloco, /TextoExibicaoFluxoAprovacao/);
    assert.match(bloco, /getCleanLastOpinion|obterUltimoParecerLimpo/);
  });

  it("não trunca o parecer com ellipsis, overflow hidden ou line-clamp", () => {
    const bloco = blocoUltimoParecer(ler(caminhoPainel));
    assert.doesNotMatch(bloco, /line-clamp|text-overflow:\s*ellipsis|truncate/);
  });

  it("exibe integralmente texto comum, multilinha, palavra gigante e legado acima do limite", () => {
    const comum = "Aprovado com restrições de acesso.";
    const multilinha = "Primeira linha.\n\nSegunda linha do parecer.";
    const gigante = "a".repeat(180);
    const legado = `Parecer: ${"b".repeat(LIMITE_TEXTO_FLUXO_APROVACAO + 500)}`;

    assert.equal(obterUltimoParecerLimpo(comum), comum);
    assert.equal(obterUltimoParecerLimpo(multilinha), multilinha);
    assert.equal(obterUltimoParecerLimpo(gigante), gigante);
    assert.equal(obterUltimoParecerLimpo(legado).length, LIMITE_TEXTO_FLUXO_APROVACAO + 500);
    assert.equal(obterUltimoParecerLimpo(legado).includes("b".repeat(80)), true);
  });

  it("mantém a classe oficial de quebra segura sem truncar", () => {
    const css = ler(caminhoCssAprovacoes);
    const regra = css.match(/\.texto-fluxo-aprovacao\s*\{[^}]+\}/)?.[0] || "";
    assert.match(regra, /overflow-wrap:\s*anywhere/);
    assert.match(regra, /word-break:\s*break-word/);
    assert.match(regra, /white-space:\s*pre-wrap/);
    assert.match(regra, /max-width:\s*100%/);
    assert.match(regra, /min-width:\s*0/);
    assert.doesNotMatch(regra, /ellipsis|line-clamp/);
  });

  it("permite o container flex do parecer encolher e o texto ocupar a largura do card", () => {
    const css = ler(caminhoCssAdministracao);
    const grupo = css.match(/\.administracao__grupo-ultimo-parecer\s*\{[^}]+\}/)?.[0] || "";
    const texto = css.match(/\.administracao__texto-7\s*\{[^}]+\}/)?.[0] || "";
    assert.match(grupo, /min-width:\s*0/);
    assert.match(texto, /min-width:\s*0/);
    assert.match(texto, /max-width:\s*100%/);
    assert.doesNotMatch(texto, /ellipsis|line-clamp/);
  });
});
