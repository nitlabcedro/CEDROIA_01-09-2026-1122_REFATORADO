import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ETAPAS_APROVACAO_OFICIAIS } from "@/constantes/fluxo-aprovacao";

import {
  ABAS_RELATORIO_IA,
  ESTRUTURA_ABAS_RELATORIO_SEGMENTADO,
  ESTRUTURA_FLUXO_APROVACAO_CARD,
  ESTRUTURA_FLUXO_APROVACAO_HORIZONTAL,
  obterNumerosEtapasOficiaisOrdenados,
  obterRotuloEtapaFluxo,
} from "./relatorioVisao.util";

describe("relatorioVisao.util — estrutura da página de detalhes", () => {
  it("define marcadores de estrutura para card do fluxo, lista horizontal e abas segmentadas", () => {
    assert.equal(ESTRUTURA_FLUXO_APROVACAO_CARD, "fluxo-aprovacao-card");
    assert.equal(ESTRUTURA_FLUXO_APROVACAO_HORIZONTAL, "fluxo-aprovacao-horizontal");
    assert.equal(ESTRUTURA_ABAS_RELATORIO_SEGMENTADO, "abas-relatorio-segmentado");
  });

  it("mantém as 5 abas oficiais na ordem esperada", () => {
    assert.deepEqual(
      ABAS_RELATORIO_IA.map((aba) => aba.id),
      ["visao-geral", "finalidade-uso", "nit", "ti", "relatorio"]
    );
    assert.deepEqual(
      ABAS_RELATORIO_IA.map((aba) => aba.label),
      ["Resumo", "Uso da IA", "NIT", "TI", "Relatório"]
    );
  });

  it("expõe as 5 etapas oficiais em ordem numérica", () => {
    assert.deepEqual(obterNumerosEtapasOficiaisOrdenados(), [1, 2, 3, 4, 5]);
  });

  it("usa os rótulos de exibição oficiais de cada etapa no fluxo", () => {
    for (const etapa of ETAPAS_APROVACAO_OFICIAIS) {
      assert.equal(obterRotuloEtapaFluxo(etapa.stepNumber), etapa.displayName);
    }
  });
});
