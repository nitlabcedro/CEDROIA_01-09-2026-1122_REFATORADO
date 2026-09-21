import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ler = () => readFileSync(
  fileURLToPath(new URL("./PaginaAprovacao.tsx", import.meta.url)),
  "utf8",
);

describe("PaginaAprovacao — configurar fluxo", () => {
  const fonte = ler();

  it("evita reset indevido com flag de edição local e util de sincronização", () => {
    assert.match(fonte, /workflowEditandoRef/);
    assert.match(fonte, /deveAplicarEtapasDoServidor/);
    assert.match(fonte, /impressaoDigitalEtapasFluxo/);
  });

  it("mantém painel de configuração montado ao alternar abas", () => {
    assert.match(fonte, /hidden=\{activeTab !== "config"\}/);
    assert.doesNotMatch(fonte, /activeTab === "config" && isAdmin &&\s*\n\s*<div className="aprovacoes__grupo-40/);
  });

  it("salvar com loading, bloqueio e feedback de sucesso", () => {
    assert.match(fonte, /salvandoConfiguracaoFluxo/);
    assert.match(fonte, /Salvando configurações/);
    assert.match(fonte, /disabled=\{salvandoConfiguracaoFluxo\}/);
    assert.match(fonte, /Configuração das etapas salva com sucesso/);
  });

  it("usa o segment control compartilhado Cedro nas abas principais", () => {
    assert.match(fonte, /cedro-segment-nav/);
    assert.match(fonte, /cedro-segment-nav__item--ativo/);
    assert.doesNotMatch(fonte, /aprovacao-abas-barra/);
  });
});
