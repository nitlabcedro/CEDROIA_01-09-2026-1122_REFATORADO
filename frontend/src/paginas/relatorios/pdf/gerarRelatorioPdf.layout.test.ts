import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ETAPAS_FLUXO_PDF,
  GRID_RELATORIO_PDF,
  LAYOUT_PAGINA_1_PDF,
  OVERLAYS_RELATORIO_PDF,
  OVERLAY_LAYOUT_PDF,
  RODAPE_PDF,
  TITULO_RELATORIO_PDF,
  FLUXO_LAYOUT_PDF,
  calcularCamadasVerticaisFluxoPdf,
  calcularCentrosEtapasFluxoPdf,
  calcularTrilhaHorizontalFluxoPdf,
  calcularLayoutOverlayRodapePdf,
  calcularLayoutOverlayTopoDireitoPdf,
  calcularSequenciaVerticalPagina1Pdf,
  formatarStatusBadgeFluxoPdf,
  textoExibicaoNomeEtapaFluxoPdf,
} from "./gerarRelatorioPdf";

describe("gerarRelatorioPdf — estrutura de layout", () => {
  it("usa o título executivo único do relatório", () => {
    assert.equal(TITULO_RELATORIO_PDF, "RELATÓRIO DE AVALIAÇÃO DE IA");
  });

  it("mantém as 5 etapas oficiais do fluxo na ordem e nomenclatura de exibição", () => {
    assert.deepEqual(
      ETAPAS_FLUXO_PDF.map((e) => e.nome),
      ["NIT", "TI", "PERÍODO DE TESTE", "PRESIDÊNCIA", "FINANCEIRO"],
    );
    assert.deepEqual(
      ETAPAS_FLUXO_PDF.map((e) => e.stepNumber),
      [1, 2, 3, 4, 5],
    );
  });

  it("formata badges compactos do fluxo sem alterar o significado do status", () => {
    assert.equal(formatarStatusBadgeFluxoPdf("Aprovado"), "APROV.");
    assert.equal(formatarStatusBadgeFluxoPdf("Negado"), "NEGADO");
    assert.equal(formatarStatusBadgeFluxoPdf("Não iniciada"), "AGUARD.");
    assert.equal(formatarStatusBadgeFluxoPdf("Em andamento"), "EM ANÁL.");
    assert.equal(formatarStatusBadgeFluxoPdf("Cancelada"), "CANC.");
    assert.doesNotMatch(formatarStatusBadgeFluxoPdf("Aprovado"), /[^\x20-\x7EÀ-ÿ]/);
  });

  it("expõe grid mestre com margens laterais simétricas", () => {
    assert.equal(GRID_RELATORIO_PDF.margemEsquerda, GRID_RELATORIO_PDF.margemDireita);
    assert.equal(
      GRID_RELATORIO_PDF.xDireita,
      GRID_RELATORIO_PDF.margemEsquerda + GRID_RELATORIO_PDF.larguraUtil,
    );
  });

  it("distribui centros das etapas de forma equidistante na largura útil", () => {
    const centros = calcularCentrosEtapasFluxoPdf(10, 100, 5);
    assert.deepEqual(centros, [10, 35, 60, 85, 110]);
  });

  it("recua a trilha do fluxo para os círculos não encostarem nas bordas do card", () => {
    const trilha = calcularTrilhaHorizontalFluxoPdf(18, GRID_RELATORIO_PDF.larguraUtil);
    const centros = calcularCentrosEtapasFluxoPdf(trilha.xTrilha, trilha.larguraTrilha);
    assert.equal(centros.length, 5);
    assert.ok(centros[0] > trilha.xArea + 0.5);
    assert.ok(centros[4] < trilha.xArea + trilha.larguraArea - 0.5);
    const passo = centros[1] - centros[0];
    assert.ok(Math.abs(centros[2] - centros[0] - passo * 2) < 0.01);
  });

  it("quebra o nome da etapa 3 em duas linhas planejadas", () => {
    assert.equal(
      textoExibicaoNomeEtapaFluxoPdf("PERÍODO DE TESTE", 3),
      "PERÍODO DE\nTESTE",
    );
    assert.equal(textoExibicaoNomeEtapaFluxoPdf("NIT", 1), "NIT");
  });

  it("referencia os overlays PNG aprovados em /relatorios", () => {
    assert.equal(OVERLAYS_RELATORIO_PDF.topoDireito, "relatorios/overlay-topo-direito.png");
    assert.equal(OVERLAYS_RELATORIO_PDF.rodape, "relatorios/overlay-rodape.png");
  });

  it("preserva proporção ao dimensionar overlays no layout", () => {
    const topo = calcularLayoutOverlayTopoDireitoPdf(1254, 1254);
    assert.equal(topo.larguraMm, OVERLAY_LAYOUT_PDF.topoDireitoLarguraMm);
    assert.equal(topo.alturaMm, OVERLAY_LAYOUT_PDF.topoDireitoLarguraMm);

    const rodape = calcularLayoutOverlayRodapePdf(2172, 724);
    assert.ok(Math.abs(rodape.larguraMm / rodape.alturaMm - 2172 / 724) < 0.001);
    assert.equal(rodape.alturaMm, OVERLAY_LAYOUT_PDF.rodapeAlturaAlvoMm);
    assert.ok(rodape.y >= OVERLAY_LAYOUT_PDF.rodapeYTopoMinimoMm);
    assert.equal(rodape.bordaInferiorMm, rodape.y + rodape.alturaMm);
    assert.equal(rodape.larguraMm, OVERLAY_LAYOUT_PDF.rodapeAlturaAlvoMm * (2172 / 724));
  });

  it("organiza o fluxo em camadas verticais fixas dentro do card", () => {
    const camadas = calcularCamadasVerticaisFluxoPdf(100, LAYOUT_PAGINA_1_PDF.alturaCardFluxo);
    assert.ok(camadas.circuloY > camadas.tituloY);
    assert.ok(camadas.areaNomesTopo > camadas.circuloY);
    assert.ok(camadas.badgeY > camadas.areaNomesBase);
    assert.ok(camadas.badgeY < 100 + LAYOUT_PAGINA_1_PDF.alturaCardFluxo);
    assert.ok(camadas.cabeNoCard);
    assert.equal(camadas.areaNomesBase - camadas.areaNomesTopo, camadas.alturaAreaNomes);
    assert.equal(camadas.alturaAreaNomes, FLUXO_LAYOUT_PDF.alturaFaixaNomes);
    assert.ok(camadas.nomeBaselineUnicaLinhaY <= camadas.areaNomesBase);
    assert.ok(camadas.nomeBaselineUnicaLinhaY > camadas.areaNomesTopo);
    const alturaEsperada = FLUXO_LAYOUT_PDF.paddingSuperiorTitulo
      + FLUXO_LAYOUT_PDF.gapTituloCirculos
      + FLUXO_LAYOUT_PDF.raioCirculo * 2
      + FLUXO_LAYOUT_PDF.gapCirculosNomes
      + FLUXO_LAYOUT_PDF.alturaFaixaNomes
      + FLUXO_LAYOUT_PDF.gapNomesBadges
      + FLUXO_LAYOUT_PDF.alturaBadge
      + FLUXO_LAYOUT_PDF.paddingInferior;
    assert.ok(Math.abs(camadas.alturaMinimaCard - alturaEsperada) < 0.02);
  });

  it("empilha as seções da página 1 em sequência vertical previsível", () => {
    const seq = calcularSequenciaVerticalPagina1Pdf();
    assert.ok(seq.yLinhaVerde > seq.yCabecalho);
    assert.ok(seq.yFaixaNomeIa > seq.yLinhaVerde);
    assert.ok(seq.yFaixaResumo > seq.yFaixaNomeIa);
    assert.ok(seq.yCardFluxo > seq.yFaixaResumo);
    assert.ok(seq.yTituloInformacoes > seq.yCardFluxo);
    assert.ok(seq.yInicioBlocos > seq.yTituloInformacoes);
    assert.ok(seq.yInicioBlocos < RODAPE_PDF.yLinha);
  });
});
