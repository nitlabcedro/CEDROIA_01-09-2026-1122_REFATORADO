import { jsPDF } from "jspdf";
import type { RelatorioPdfDados } from "./dadosRelatorioPdf";

const CORES = {
  verde: "#075618",
  verdeMedio: "#0A7A2D",
  verdeSuave: "#EEF7F0",
  verdeLinha: "#D7E9DA",
  grafite: "#202124",
  cinza: "#6B7280",
  cinzaClaro: "#F7F8F7",
  cinzaLinha: "#E4E7E5",
  laranja: "#F29222",
  vermelho: "#DC2626",
  branco: "#FFFFFF",
};

const PAGINA_LARGURA = 210;
const PAGINA_ALTURA = 297;
const MARGEM_X = 18;
const LARGURA_UTIL = PAGINA_LARGURA - MARGEM_X * 2;

/** Grid mestre — todas as seções usam as mesmas margens laterais. */
export const GRID_RELATORIO_PDF = {
  margemEsquerda: MARGEM_X,
  margemDireita: MARGEM_X,
  larguraUtil: LARGURA_UTIL,
  xDireita: MARGEM_X + LARGURA_UTIL,
} as const;

const FONTE = "helvetica";

/** Rodapé institucional — linha e textos alinhados na mesma baseline. */
export const RODAPE_PDF = {
  yLinha: 281,
  yTexto: 285.6,
  margemConteudoAcima: 11,
} as const;

const LIMITE_CONTEUDO_Y = RODAPE_PDF.yLinha - RODAPE_PDF.margemConteudoAcima;

/** Ritmo vertical da página 1 — posições derivadas sequencialmente a partir de yInicio. */
export const LAYOUT_PAGINA_1_PDF = {
  yInicio: 12,
  alturaCabecalho: 19,
  gapLinhaVerde: 4,
  gapAposLinhaVerde: 5.5,
  alturaFaixaNomeIa: 14,
  gapAposNomeIa: 5,
  alturaFaixaResumo: 15,
  gapAposResumo: 6,
  alturaCardFluxo: 42,
  gapAposFluxo: 7,
  gapAposTituloInformacoes: 6,
} as const;

/** Cabeçalho — logo, divisor e título no mesmo eixo vertical. */
const CABECALHO_PDF = {
  larguraLogo: 46,
  gapLogoDivisor: 4,
  gapDivisorTitulo: 5,
  recuoDivisorVertical: 2.8,
} as const;

/** Reserva à direita para o badge de status geral (evita colisão com o nome da IA). */
const RESERVA_LARGURA_BADGE_STATUS_MM = 56;

/** Dimensões dos overlays decorativos (mm). */
export const OVERLAY_LAYOUT_PDF = {
  topoDireitoLarguraMm: 76,
  topoOverflowDireitaMm: 17,
  topoOverflowTopoMm: 10,
  rodapeAlturaAlvoMm: 28,
  rodapeLarguraMaximaMm: PAGINA_LARGURA,
  rodapeDeslocamentoInferiorMm: 15,
  /** Evita que o overlay do rodapé “suba” e invada a área do protocolo. */
  rodapeYTopoMinimoMm: 278,
} as const;

const TIPOGRAFIA = {
  tituloRelatorio: 10.5,
  nomeIa: 17,
  secao: 7.6,
  label: 6.6,
  valor: 9.2,
  corpo: 9,
  rodape: 6,
  fluxoTitulo: 7,
  fluxoEtapa: 5.6,
  fluxoBadge: 4.8,
  statusGeral: 7.5,
} as const;

const BLOCO_CONTEUDO = {
  faixaVerdeLargura: 1.8,
  faixaVerdeRaio: 0.9,
  paddingEsquerdoConteudo: 7.5,
  paddingSuperior: 3.5,
  paddingInferior: 4.5,
  alturaTitulo: 8.5,
  offsetTituloVertical: 5.2,
  offsetCorpoVertical: 0,
  gapEntreBlocos: 4,
  raioCard: 2,
  recuoFaixaVertical: 1.4,
} as const;

/** Layout do card “ETAPAS DE APROVAÇÃO” — camadas verticais fixas (mm). */
export const FLUXO_LAYOUT_PDF = {
  paddingHorizontal: 6,
  recuoTrilhaHorizontal: 8,
  paddingSuperiorTitulo: 5,
  gapTituloCirculos: 4.5,
  raioCirculo: 3.5,
  gapConector: 0.5,
  gapCirculosNomes: 3,
  alturaFaixaNomes: 10.5,
  gapNomesBadges: 2.2,
  alturaBadge: 4.6,
  paddingBadgeHorizontal: 3.8,
  larguraBadgeMinima: 14.5,
  paddingInferior: 4,
  raioCard: 2.6,
  offsetNomeBaselineInferior: 1.1,
} as const;

const FLUXO_LAYOUT = FLUXO_LAYOUT_PDF;

export function calcularCamadasVerticaisFluxoPdf(caixaY: number, caixaAltura: number) {
  const tituloY = caixaY + FLUXO_LAYOUT.paddingSuperiorTitulo;
  const circuloY = tituloY + FLUXO_LAYOUT.gapTituloCirculos + FLUXO_LAYOUT.raioCirculo;
  const areaNomesTopo = circuloY + FLUXO_LAYOUT.raioCirculo + FLUXO_LAYOUT.gapCirculosNomes;
  const areaNomesBase = areaNomesTopo + FLUXO_LAYOUT.alturaFaixaNomes;
  const badgeY = areaNomesBase + FLUXO_LAYOUT.gapNomesBadges;
  const nomeBaselineUnicaLinhaY = areaNomesBase - FLUXO_LAYOUT.offsetNomeBaselineInferior;
  const alturaMinima = badgeY + FLUXO_LAYOUT.alturaBadge + FLUXO_LAYOUT.paddingInferior - caixaY;
  return {
    tituloY,
    circuloY,
    areaNomesTopo,
    areaNomesBase,
    badgeY,
    nomeBaselineUnicaLinhaY,
    alturaAreaNomes: FLUXO_LAYOUT.alturaFaixaNomes,
    alturaMinimaCard: alturaMinima,
    cabeNoCard: alturaMinima <= caixaAltura + 0.01,
  };
}

export function calcularTrilhaHorizontalFluxoPdf(
  caixaX: number,
  caixaLargura: number,
) {
  const xArea = caixaX + FLUXO_LAYOUT.paddingHorizontal;
  const larguraArea = caixaLargura - FLUXO_LAYOUT.paddingHorizontal * 2;
  const recuo = FLUXO_LAYOUT.recuoTrilhaHorizontal;
  const larguraTrilha = Math.max(0, larguraArea - recuo * 2);
  return {
    xArea,
    larguraArea,
    xTrilha: xArea + recuo,
    larguraTrilha,
  };
}

/** Sequência vertical da página 1 — única fonte de verdade para posicionamento. */
export function calcularSequenciaVerticalPagina1Pdf() {
  const layout = LAYOUT_PAGINA_1_PDF;
  let y = layout.yInicio;
  const yCabecalho = y;
  y += layout.alturaCabecalho + layout.gapLinhaVerde;
  const yLinhaVerde = y;
  y += layout.gapAposLinhaVerde;
  const yFaixaNomeIa = y;
  y += layout.alturaFaixaNomeIa + layout.gapAposNomeIa;
  const yFaixaResumo = y;
  y += layout.alturaFaixaResumo + layout.gapAposResumo;
  const yCardFluxo = y;
  y += layout.alturaCardFluxo + layout.gapAposFluxo;
  const yTituloInformacoes = y;
  const yInicioBlocos = yTituloInformacoes + layout.gapAposTituloInformacoes;
  return {
    yCabecalho,
    yLinhaVerde,
    yFaixaNomeIa,
    yFaixaResumo,
    yCardFluxo,
    yTituloInformacoes,
    yInicioBlocos,
  };
}

/** Título principal exibido no cabeçalho do PDF. */
export const TITULO_RELATORIO_PDF = "RELATÓRIO DE AVALIAÇÃO DE IA";

/** Nomes de exibição das etapas oficiais no fluxo horizontal do PDF. */
export const ETAPAS_FLUXO_PDF = [
  { stepNumber: 1, nome: "NIT" },
  { stepNumber: 2, nome: "TI" },
  { stepNumber: 3, nome: "PERÍODO DE TESTE" },
  { stepNumber: 4, nome: "PRESIDÊNCIA" },
  { stepNumber: 5, nome: "FINANCEIRO" },
] as const;

type Caixa = {
  x: number;
  y: number;
  largura: number;
  altura: number;
};

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const normalized = clean.length === 3
    ? clean.split("").map((char) => char + char).join("")
    : clean;
  const value = parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function setFillHex(doc: jsPDF, hex: string) {
  const { r, g, b } = hexToRgb(hex);
  doc.setFillColor(r, g, b);
}

function setDrawHex(doc: jsPDF, hex: string) {
  const { r, g, b } = hexToRgb(hex);
  doc.setDrawColor(r, g, b);
}

function setTextHex(doc: jsPDF, hex: string) {
  const { r, g, b } = hexToRgb(hex);
  doc.setTextColor(r, g, b);
}

function normalizarStatusParaCor(status: string) {
  return status
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function ehStatusNegativo(normalizado: string) {
  return normalizado.includes("nao aprovad")
    || normalizado.includes("neg")
    || normalizado.includes("indefer");
}

export function statusCor(status: string) {
  const normalizado = normalizarStatusParaCor(status);
  if (ehStatusNegativo(normalizado)) {
    return { fundo: "#FDEBEC", texto: CORES.vermelho };
  }
  if (normalizado.includes("cancel")) {
    return { fundo: "#F3F4F6", texto: "#4B5563" };
  }
  if (normalizado.includes("aprov")) {
    return { fundo: "#E7F5EA", texto: CORES.verde };
  }
  if (normalizado.includes("teste") || normalizado.includes("andamento")) {
    return { fundo: "#FFF1DF", texto: CORES.laranja };
  }
  return { fundo: "#FFF1DF", texto: CORES.laranja };
}

/** Texto curto para badges de etapa no fluxo do PDF. */
export function formatarStatusBadgeFluxoPdf(status: string) {
  const normalizado = normalizarStatusParaCor(status);
  if (ehStatusNegativo(normalizado)) return "NEGADO";
  if (normalizado.includes("cancel")) return "CANC.";
  if (normalizado.includes("aprov")) return "APROV.";
  if (normalizado.includes("andamento")) return "EM ANÁL.";
  if (normalizado.includes("teste")) return "EM TESTE";
  if (
    normalizado.includes("nao inici")
    || normalizado.includes("pend")
    || normalizado.includes("aguard")
  ) {
    return "AGUARD.";
  }
  const bruto = textoSeguro(status, "Pendente").toUpperCase();
  return bruto.length > 14 ? `${bruto.slice(0, 12)}.` : bruto;
}

export function statusCorEtapa(status: string) {
  const normalizado = normalizarStatusParaCor(status);
  if (ehStatusNegativo(normalizado)) {
    return { fundo: "#FDEBEC", texto: CORES.vermelho, linha: CORES.vermelho };
  }
  if (normalizado.includes("cancel")) {
    return { fundo: "#F3F4F6", texto: "#6B7280", linha: "#9CA3AF" };
  }
  if (normalizado.includes("aprov")) {
    return { fundo: "#E7F5EA", texto: CORES.verde, linha: CORES.verde };
  }
  if (normalizado.includes("pend") || normalizado.includes("aguard") || normalizado.includes("nao inici")) {
    return { fundo: "#F3F4F6", texto: "#6B7280", linha: "#CBD5E1" };
  }
  return { fundo: "#FFF1DF", texto: CORES.laranja, linha: CORES.laranja };
}

function etapaConcluidaParaLinha(status: string) {
  const normalizado = normalizarStatusParaCor(status);
  return normalizado.includes("aprov") && !ehStatusNegativo(normalizado);
}

function etapaAtualEmDestaque(status: string) {
  const normalizado = normalizarStatusParaCor(status);
  if (ehStatusNegativo(normalizado) || normalizado.includes("cancel")) return false;
  if (normalizado.includes("aprov")) return false;
  return normalizado.includes("andamento") || normalizado.includes("teste");
}

/**
 * Centros horizontais equidistantes na trilha do fluxo.
 * Com `recuoLaterais`, o primeiro e o último círculo não encostam nas bordas da área.
 */
export function calcularCentrosEtapasFluxoPdf(
  xInicio: number,
  largura: number,
  quantidadeEtapas: number = ETAPAS_FLUXO_PDF.length,
  recuoLaterais = 0,
): number[] {
  if (quantidadeEtapas <= 0) return [];
  const xPrimeiro = xInicio + recuoLaterais;
  const xUltimo = xInicio + largura - recuoLaterais;
  const larguraUtil = Math.max(0, xUltimo - xPrimeiro);
  if (quantidadeEtapas === 1) return [xPrimeiro + larguraUtil / 2];
  const passo = larguraUtil / (quantidadeEtapas - 1);
  return Array.from({ length: quantidadeEtapas }, (_, indice) => xPrimeiro + indice * passo);
}

/** Quebra planejada para etapas com nome longo no fluxo. */
export function textoExibicaoNomeEtapaFluxoPdf(nome: string, stepNumber: number) {
  if (stepNumber === 3) return "PERÍODO DE\nTESTE";
  return nome;
}

type IconeBadgeFluxo = "aprovado" | "relogio" | "aguardando" | "negado" | "cancelado" | null;

function classificarIconeBadgeFluxo(status: string): IconeBadgeFluxo {
  const normalizado = normalizarStatusParaCor(status);
  if (ehStatusNegativo(normalizado)) return "negado";
  if (normalizado.includes("cancel")) return "cancelado";
  if (normalizado.includes("aprov")) return "aprovado";
  if (normalizado.includes("andamento") || normalizado.includes("teste")) return "relogio";
  if (
    normalizado.includes("nao inici")
    || normalizado.includes("pend")
    || normalizado.includes("aguard")
  ) {
    return "aguardando";
  }
  return null;
}

const LARGURA_ICONE_BADGE_FLUXO = 3.2;

function desenharIconeBadgeFluxo(
  doc: jsPDF,
  tipo: IconeBadgeFluxo,
  centroX: number,
  centroY: number,
  cor: string,
) {
  if (!tipo) return;
  setDrawHex(doc, cor);
  setFillHex(doc, cor);
  doc.setLineWidth(0.22);

  switch (tipo) {
    case "aprovado":
      doc.line(centroX - 1.1, centroY + 0.1, centroX - 0.35, centroY + 0.85);
      doc.line(centroX - 0.35, centroY + 0.85, centroX + 1.15, centroY - 0.75);
      break;
    case "relogio":
      doc.circle(centroX, centroY, 0.85, "D");
      doc.line(centroX, centroY, centroX, centroY - 0.55);
      doc.line(centroX, centroY, centroX + 0.45, centroY + 0.15);
      break;
    case "aguardando":
      [-1.05, 0, 1.05].forEach((deslocamento) => {
        doc.circle(centroX + deslocamento, centroY, 0.28, "F");
      });
      break;
    case "negado":
      doc.line(centroX - 0.75, centroY - 0.75, centroX + 0.75, centroY + 0.75);
      doc.line(centroX + 0.75, centroY - 0.75, centroX - 0.75, centroY + 0.75);
      break;
    case "cancelado":
      doc.circle(centroX, centroY, 0.85, "D");
      doc.line(centroX - 0.6, centroY - 0.6, centroX + 0.6, centroY + 0.6);
      break;
    default:
      break;
  }
}

/** Caminhos públicos dos overlays aprovados (servidos em /relatorios/...). */
export const OVERLAYS_RELATORIO_PDF = {
  topoDireito: "relatorios/overlay-topo-direito.png",
  rodape: "relatorios/overlay-rodape.png",
} as const;

export interface RelatorioPdfImagemAsset {
  dataUrl: string;
  larguraPx: number;
  alturaPx: number;
}

export interface RelatorioPdfOverlays {
  topoDireito?: RelatorioPdfImagemAsset;
  rodape?: RelatorioPdfImagemAsset;
}

export function calcularLayoutOverlayTopoDireitoPdf(
  larguraPx: number,
  alturaPx: number,
  paginaLargura = PAGINA_LARGURA,
) {
  const proporcao = larguraPx / alturaPx;
  const larguraMm = OVERLAY_LAYOUT_PDF.topoDireitoLarguraMm;
  const alturaMm = larguraMm / proporcao;
  return {
    x: paginaLargura - larguraMm + OVERLAY_LAYOUT_PDF.topoOverflowDireitaMm,
    y: -OVERLAY_LAYOUT_PDF.topoOverflowTopoMm,
    larguraMm,
    alturaMm,
  };
}

export function calcularLayoutOverlayRodapePdf(
  larguraPx: number,
  alturaPx: number,
  paginaLargura = PAGINA_LARGURA,
  paginaAltura = PAGINA_ALTURA,
) {
  const proporcao = larguraPx / alturaPx;
  const alturaAlvoMm = OVERLAY_LAYOUT_PDF.rodapeAlturaAlvoMm;
  const larguraMm = Math.min(
    OVERLAY_LAYOUT_PDF.rodapeLarguraMaximaMm,
    alturaAlvoMm * proporcao,
  );
  const alturaMm = larguraMm / proporcao;
  const deslocamentoInferior = OVERLAY_LAYOUT_PDF.rodapeDeslocamentoInferiorMm;
  const yNatural = paginaAltura - alturaMm + deslocamentoInferior;
  const y = Math.max(yNatural, OVERLAY_LAYOUT_PDF.rodapeYTopoMinimoMm);
  return {
    x: (paginaLargura - larguraMm) / 2,
    y,
    larguraMm,
    alturaMm,
    bordaInferiorMm: y + alturaMm,
  };
}

function desenharFundoDecorativoPagina(doc: jsPDF, overlays?: RelatorioPdfOverlays) {
  if (overlays?.rodape) {
    const { x, y, larguraMm, alturaMm } = calcularLayoutOverlayRodapePdf(
      overlays.rodape.larguraPx,
      overlays.rodape.alturaPx,
    );
    try {
      doc.addImage(overlays.rodape.dataUrl, "PNG", x, y, larguraMm, alturaMm);
    } catch (erro) {
      console.warn("Não foi possível inserir o overlay de rodapé no PDF.", erro);
    }
  }

  if (overlays?.topoDireito) {
    const { x, y, larguraMm, alturaMm } = calcularLayoutOverlayTopoDireitoPdf(
      overlays.topoDireito.larguraPx,
      overlays.topoDireito.alturaPx,
    );
    try {
      doc.addImage(overlays.topoDireito.dataUrl, "PNG", x, y, larguraMm, alturaMm);
    } catch (erro) {
      console.warn("Não foi possível inserir o overlay superior no PDF.", erro);
    }
  }
}

function formatarNomeArquivo(valor: string) {
  return valor.replace(/[^a-z0-9_-]+/gi, "_");
}

function textoSeguro(valor?: string, fallback = "Não informado") {
  const normalizado = (valor || "").trim();
  return normalizado || fallback;
}

/**
 * Cria uma caixa filha sempre contida dentro da caixa pai.
 * Essa função é a proteção de aninhamento do layout: nenhum elemento filho
 * pode ultrapassar a área reservada pelo seu bloco principal.
 */
function caixaFilha(
  pai: Caixa,
  deslocamentoX: number,
  deslocamentoY: number,
  largura: number,
  altura: number,
): Caixa {
  const x = Math.max(pai.x, Math.min(pai.x + deslocamentoX, pai.x + pai.largura));
  const y = Math.max(pai.y, Math.min(pai.y + deslocamentoY, pai.y + pai.altura));
  const larguraMaxima = Math.max(0, pai.x + pai.largura - x);
  const alturaMaxima = Math.max(0, pai.y + pai.altura - y);

  return {
    x,
    y,
    largura: Math.max(0, Math.min(largura, larguraMaxima)),
    altura: Math.max(0, Math.min(altura, alturaMaxima)),
  };
}

/**
 * Divide uma caixa pai em colunas perfeitamente alinhadas e com o mesmo tamanho.
 * O cálculo é único para a linha inteira, evitando diferenças acumuladas de posição.
 */
function gradeHorizontal(pai: Caixa, quantidade: number, gap: number): Caixa[] {
  const larguraColuna = (pai.largura - gap * (quantidade - 1)) / quantidade;

  return Array.from({ length: quantidade }, (_, indice) => ({
    x: pai.x + indice * (larguraColuna + gap),
    y: pai.y,
    largura: larguraColuna,
    altura: pai.altura,
  }));
}

async function converterBlobParaPngTransparente(blob: Blob): Promise<RelatorioPdfImagemAsset> {
  return await new Promise<RelatorioPdfImagemAsset>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const imagem = new Image();

    const liberar = () => URL.revokeObjectURL(objectUrl);

    imagem.onload = () => {
      try {
        const larguraOriginal = Math.max(1, imagem.naturalWidth || imagem.width);
        const alturaOriginal = Math.max(1, imagem.naturalHeight || imagem.height);
        const larguraMaxima = 2200;
        const escala = Math.min(1, larguraMaxima / larguraOriginal);
        const largura = Math.max(1, Math.round(larguraOriginal * escala));
        const altura = Math.max(1, Math.round(alturaOriginal * escala));

        const canvas = document.createElement("canvas");
        canvas.width = largura;
        canvas.height = altura;

        const contexto = canvas.getContext("2d");
        if (!contexto) {
          liberar();
          reject(new Error("Canvas 2D indisponível para preparar overlay PNG."));
          return;
        }

        contexto.clearRect(0, 0, largura, altura);
        contexto.drawImage(imagem, 0, 0, largura, altura);

        const png = canvas.toDataURL("image/png");
        liberar();
        resolve({
          dataUrl: png,
          larguraPx: largura,
          alturaPx: altura,
        });
      } catch (erro) {
        liberar();
        reject(erro);
      }
    };

    imagem.onerror = () => {
      liberar();
      reject(new Error("A imagem recebida não pôde ser decodificada."));
    };

    imagem.src = objectUrl;
  });
}

async function converterImagemParaJpeg(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const imagem = new Image();

    const liberar = () => URL.revokeObjectURL(objectUrl);

    imagem.onload = () => {
      try {
        const larguraOriginal = Math.max(1, imagem.naturalWidth || imagem.width);
        const alturaOriginal = Math.max(1, imagem.naturalHeight || imagem.height);
        const larguraMaxima = 1600;
        const escala = Math.min(1, larguraMaxima / larguraOriginal);
        const largura = Math.max(1, Math.round(larguraOriginal * escala));
        const altura = Math.max(1, Math.round(alturaOriginal * escala));

        const canvas = document.createElement("canvas");
        canvas.width = largura;
        canvas.height = altura;

        const contexto = canvas.getContext("2d");
        if (!contexto) {
          liberar();
          reject(new Error("Canvas 2D indisponível para preparar a logo."));
          return;
        }

        contexto.fillStyle = "#FFFFFF";
        contexto.fillRect(0, 0, largura, altura);
        contexto.drawImage(imagem, 0, 0, largura, altura);

        const jpeg = canvas.toDataURL("image/jpeg", 0.94);
        liberar();
        resolve(jpeg);
      } catch (erro) {
        liberar();
        reject(erro);
      }
    };

    imagem.onerror = () => {
      liberar();
      reject(new Error("A imagem recebida não pôde ser decodificada."));
    };

    imagem.src = objectUrl;
  });
}

/** JPEG em data URL — reutilizado entre gerações de PDF na mesma sessão (evita baixar ~1MB repetidamente). */
let logoCedroJpegCache: string | undefined;
let logoCedroCarregamento: Promise<string | undefined> | null = null;

let overlaysRelatorioCache: RelatorioPdfOverlays | undefined;
let overlaysRelatorioCarregamento: Promise<RelatorioPdfOverlays> | null = null;

/** Apenas para testes: permite isolar o cache entre casos. */
export const resetCacheLogoRelatorioPdf = () => {
  logoCedroJpegCache = undefined;
  logoCedroCarregamento = null;
  overlaysRelatorioCache = undefined;
  overlaysRelatorioCarregamento = null;
};

async function carregarOverlayRelatorio(arquivo: string): Promise<RelatorioPdfImagemAsset | undefined> {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof fetch === "undefined"
  ) {
    return undefined;
  }

  try {
    const url = new URL(arquivo, new URL(".", document.baseURI)).toString();
    const resposta = await fetch(url);
    if (!resposta.ok) return undefined;

    const blob = await resposta.blob();
    if (!blob.size) return undefined;
    if (blob.type && !blob.type.toLowerCase().startsWith("image/")) return undefined;

    return await converterBlobParaPngTransparente(blob);
  } catch (erro) {
    console.warn(`Não foi possível preparar o overlay ${arquivo}.`, erro);
    return undefined;
  }
}

async function carregarOverlaysRelatorioPdf(): Promise<RelatorioPdfOverlays> {
  if (overlaysRelatorioCache) return overlaysRelatorioCache;
  if (overlaysRelatorioCarregamento) return overlaysRelatorioCarregamento;

  overlaysRelatorioCarregamento = (async () => {
    const [topoDireito, rodape] = await Promise.all([
      carregarOverlayRelatorio(OVERLAYS_RELATORIO_PDF.topoDireito),
      carregarOverlayRelatorio(OVERLAYS_RELATORIO_PDF.rodape),
    ]);

    overlaysRelatorioCache = { topoDireito, rodape };
    return overlaysRelatorioCache;
  })();

  try {
    return await overlaysRelatorioCarregamento;
  } finally {
    overlaysRelatorioCarregamento = null;
  }
}

async function carregarLogoCedro(): Promise<string | undefined> {
  if (logoCedroJpegCache) return logoCedroJpegCache;
  if (logoCedroCarregamento) return logoCedroCarregamento;

  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof fetch === "undefined"
  ) {
    return undefined;
  }

  logoCedroCarregamento = (async () => {
    const base = new URL(".", document.baseURI);
    const candidatos = [
      "LOGOCEDRO.png",
      "LOGOCEDRO-interface.png",
    ];

    for (const arquivo of candidatos) {
      try {
        const url = new URL(arquivo, base).toString();
        const resposta = await fetch(url);
        if (!resposta.ok) continue;

        const blob = await resposta.blob();
        if (!blob.size) continue;
        if (blob.type && !blob.type.toLowerCase().startsWith("image/")) continue;

        const jpeg = await converterImagemParaJpeg(blob);
        logoCedroJpegCache = jpeg;
        return jpeg;
      } catch (erro) {
        console.warn(`Não foi possível preparar a logo ${arquivo}.`, erro);
      }
    }

    console.warn("Nenhuma logo válida foi encontrada para o relatório. Usando marca textual de segurança.");
    return undefined;
  })();

  try {
    return await logoCedroCarregamento;
  } finally {
    logoCedroCarregamento = null;
  }
}

/**
 * Mantém todo o relatório em uma única página A4.
 * O texto diminui de forma controlada e, somente no limite extremo,
 * recebe reticências para impedir qualquer quebra estrutural do PDF.
 */
function ajustarTextoNaCaixa(
  doc: jsPDF,
  texto: string,
  largura: number,
  altura: number,
  tamanhoInicial: number,
  tamanhoMinimo: number,
  lineHeight = 1.22,
) {
  let tamanho = tamanhoInicial;
  let linhas: string[] = [];

  while (tamanho >= tamanhoMinimo) {
    doc.setFontSize(tamanho);
    linhas = doc.splitTextToSize(texto, largura) as string[];
    const alturaLinhaMm = tamanho * 0.3528 * lineHeight;
    if (linhas.length * alturaLinhaMm <= altura) {
      return { linhas, tamanho, alturaLinhaMm };
    }
    tamanho -= 0.5;
  }

  doc.setFontSize(tamanhoMinimo);
  linhas = doc.splitTextToSize(texto, largura) as string[];
  const alturaLinhaMm = tamanhoMinimo * 0.3528 * lineHeight;
  const maxLinhas = Math.max(1, Math.floor(altura / alturaLinhaMm));

  if (linhas.length > maxLinhas) {
    linhas = linhas.slice(0, maxLinhas);
    const ultimoIndice = linhas.length - 1;
    const ultima = linhas[ultimoIndice].replace(/[.\s]+$/, "");
    linhas[ultimoIndice] = `${ultima}...`;
  }

  return { linhas, tamanho: tamanhoMinimo, alturaLinhaMm };
}

class DocumentoRelatorioCedroUmaPagina {
  private readonly doc = new jsPDF({
    unit: "mm",
    format: "a4",
    orientation: "portrait",
  });

  constructor(
    private readonly dados: RelatorioPdfDados,
    private readonly logoCedro?: string,
    private readonly overlays?: RelatorioPdfOverlays,
  ) {}

  gerar() {
    this.desenharPaginaUnica();

    return {
      doc: this.doc,
      fileName: `Relatorio_IA_${formatarNomeArquivo(this.dados.nomeIa || this.dados.protocolo)}.pdf`,
    };
  }

  private desenharMarcaCedro(caixa: Caixa) {
    if (this.logoCedro) {
      // Mantém a proporção da marca do Laboratório Cedro dentro do cabeçalho.
      const proporcaoLogo = 2171 / 724;
      let largura = Math.min(caixa.largura, 54);
      let altura = largura / proporcaoLogo;

      if (altura > caixa.altura) {
        altura = caixa.altura;
        largura = altura * proporcaoLogo;
      }

      const y = caixa.y + (caixa.altura - altura) / 2;
      try {
        this.doc.addImage(this.logoCedro, "JPEG", caixa.x, y, largura, altura);
        return;
      } catch (erro) {
        console.warn("Falha ao inserir a logo no PDF. Usando marca textual de segurança.", erro);
      }
    }

    setTextHex(this.doc, CORES.verde);
    this.doc.setFont(FONTE, "bold");
    this.doc.setFontSize(24);
    this.doc.text("cedro", caixa.x, caixa.y + 15);
    this.doc.setFont(FONTE, "normal");
    this.doc.setFontSize(8);
    this.doc.text("laboratório", caixa.x + 0.5, caixa.y + 6);
  }

  private desenharSeloStatusAlinhadoDireita(status: string, yCentro: number) {
    const cores = statusCor(status);
    const texto = textoSeguro(status, "Pendente").toUpperCase();
    this.doc.setFont(FONTE, "bold");
    this.doc.setFontSize(TIPOGRAFIA.statusGeral);
    const altura = 7.8;
    const largura = Math.min(
      RESERVA_LARGURA_BADGE_STATUS_MM,
      Math.max(26, this.doc.getTextWidth(texto) + 12),
    );
    const x = GRID_RELATORIO_PDF.xDireita - largura;
    const y = yCentro - altura / 2;

    setFillHex(this.doc, cores.fundo);
    setDrawHex(this.doc, cores.texto);
    this.doc.setLineWidth(0.1);
    this.doc.roundedRect(x, y, largura, altura, altura / 2, altura / 2, "FD");

    setTextHex(this.doc, cores.texto);
    this.doc.text(texto, x + largura / 2, y + altura / 2, {
      align: "center",
      baseline: "middle",
    });
  }

  private desenharFaixaResumoSolicitacao(caixa: Caixa) {
    const paddingH = 8;
    const paddingV = 4;
    setFillHex(this.doc, "#F9FBF9");
    setDrawHex(this.doc, CORES.verdeLinha);
    this.doc.setLineWidth(0.12);
    this.doc.roundedRect(caixa.x, caixa.y, caixa.largura, caixa.altura, 2.5, 2.5, "FD");

    const areaInterna = caixaFilha(
      caixa,
      paddingH,
      paddingV,
      caixa.largura - paddingH * 2,
      caixa.altura - paddingV * 2,
    );
    const colunas = gradeHorizontal(areaInterna, 3, 0);
    const labelY = areaInterna.y + areaInterna.altura * 0.34;
    const valorY = areaInterna.y + areaInterna.altura * 0.74;
    const itens = [
      { rotulo: "Solicitante", valor: this.dados.solicitante },
      { rotulo: "Setor", valor: this.dados.setorSolicitante },
      { rotulo: "Data da solicitação", valor: this.dados.dataCadastro },
    ];

    colunas.forEach((coluna, indice) => {
      const item = itens[indice];

      setTextHex(this.doc, CORES.cinza);
      this.doc.setFont(FONTE, "bold");
      this.doc.setFontSize(TIPOGRAFIA.label);
      this.doc.text(item.rotulo.toUpperCase(), coluna.x, labelY, { baseline: "middle" });

      const ajustado = ajustarTextoNaCaixa(
        this.doc,
        textoSeguro(item.valor),
        coluna.largura,
        areaInterna.y + areaInterna.altura - valorY + 1.5,
        TIPOGRAFIA.valor,
        7.5,
        1.05,
      );

      setTextHex(this.doc, CORES.grafite);
      this.doc.setFont(FONTE, "bold");
      this.doc.setFontSize(ajustado.tamanho);
      const blocoValorAltura = ajustado.linhas.length * ajustado.alturaLinhaMm;
      const valorBaselineY = valorY - blocoValorAltura / 2 + ajustado.alturaLinhaMm;
      this.doc.text(ajustado.linhas, coluna.x, valorBaselineY, {
        lineHeightFactor: 1.05,
        baseline: "alphabetic",
      });

      if (indice < colunas.length - 1) {
        const separadorX = coluna.x + coluna.largura;
        const recuoSeparador = 1.2;
        setDrawHex(this.doc, CORES.cinzaLinha);
        this.doc.setLineWidth(0.1);
        this.doc.line(
          separadorX,
          areaInterna.y + recuoSeparador,
          separadorX,
          areaInterna.y + areaInterna.altura - recuoSeparador,
        );
      }
    });
  }

  private desenharRodapeAtual() {
    const { yLinha, yTexto } = RODAPE_PDF;

    setDrawHex(this.doc, "#D5DAD7");
    this.doc.setLineWidth(0.14);
    this.doc.line(GRID_RELATORIO_PDF.margemEsquerda, yLinha, GRID_RELATORIO_PDF.xDireita, yLinha);

    setTextHex(this.doc, "#5F676E");
    this.doc.setFont(FONTE, "bold");
    this.doc.setFontSize(TIPOGRAFIA.rodape);
    const protocolo = `PROTOCOLO: ${textoSeguro(this.dados.protocolo)}`;
    const atualizado = `ATUALIZADO EM: ${textoSeguro(this.dados.atualizadoEm)}`;
    this.doc.text(protocolo, GRID_RELATORIO_PDF.margemEsquerda, yTexto, { baseline: "middle" });
    this.doc.setFont(FONTE, "normal");
    this.doc.text(atualizado, GRID_RELATORIO_PDF.xDireita, yTexto, {
      align: "right",
      baseline: "middle",
    });
  }

  private prepararFundoPagina() {
    setFillHex(this.doc, CORES.branco);
    this.doc.rect(0, 0, PAGINA_LARGURA, PAGINA_ALTURA, "F");
    desenharFundoDecorativoPagina(this.doc, this.overlays);
  }

  private desenharTituloSecaoComLinha(titulo: string, y: number) {
    setTextHex(this.doc, CORES.grafite);
    this.doc.setFont(FONTE, "bold");
    this.doc.setFontSize(TIPOGRAFIA.secao);
    const x = GRID_RELATORIO_PDF.margemEsquerda;
    this.doc.text(titulo, x, y, { baseline: "middle" });
    const larguraTitulo = this.doc.getTextWidth(titulo);
    const yLinha = y - 0.6;
    setDrawHex(this.doc, CORES.verdeLinha);
    this.doc.setLineWidth(0.14);
    this.doc.line(x + larguraTitulo + 4, yLinha, GRID_RELATORIO_PDF.xDireita, yLinha);
  }

  private iniciarPaginaInformacoesContinuacao() {
    this.doc.addPage();
    this.prepararFundoPagina();

    this.desenharTituloSecaoComLinha("INFORMAÇÕES DA SOLICITAÇÃO — CONTINUAÇÃO", 18);

    return 24;
  }

  /**
   * Desenha o conteúdo textual sem reticências. A altura do card acompanha a
   * quantidade real de linhas e, quando não há espaço, o texto continua em uma
   * nova página. Assim nenhuma parte da descrição, objetivos ou benefícios é perdida.
   */
  private desenharBlocoTextoPaginado(titulo: string, texto: string, yInicial: number) {
    const tamanhoFonte = TIPOGRAFIA.corpo;
    const lineHeightFactor = 1.22;
    const alturaLinhaMm = tamanhoFonte * 0.3528 * lineHeightFactor;
    const limiteConteudoY = LIMITE_CONTEUDO_Y;
    const margemEntreBlocos = BLOCO_CONTEUDO.gapEntreBlocos;
    const alturaCabecalho = BLOCO_CONTEUDO.alturaTitulo;
    const paddingInferior = BLOCO_CONTEUDO.paddingInferior;
    const paddingSuperior = BLOCO_CONTEUDO.paddingSuperior;
    const larguraTexto = GRID_RELATORIO_PDF.larguraUtil
      - BLOCO_CONTEUDO.paddingEsquerdoConteudo
      - BLOCO_CONTEUDO.faixaVerdeLargura
      - 2;

    this.doc.setFont(FONTE, "normal");
    this.doc.setFontSize(tamanhoFonte);
    const linhas = this.doc.splitTextToSize(
      textoSeguro(texto, "Não informado."),
      larguraTexto,
    ) as string[];

    let indiceLinha = 0;
    let y = yInicial;
    let parte = 1;

    while (indiceLinha < linhas.length) {
      const alturaMinima = alturaCabecalho + alturaLinhaMm + paddingInferior;
      if (y + alturaMinima > limiteConteudoY) {
        this.desenharRodapeAtual();
        y = this.iniciarPaginaInformacoesContinuacao();
      }

      const alturaDisponivel = limiteConteudoY - y - alturaCabecalho - paddingInferior;
      const quantidadeLinhas = Math.max(1, Math.floor(alturaDisponivel / alturaLinhaMm));
      const trecho = linhas.slice(indiceLinha, indiceLinha + quantidadeLinhas);
      const alturaCard = paddingSuperior + alturaCabecalho + trecho.length * alturaLinhaMm + paddingInferior;
      const caixa: Caixa = {
        x: GRID_RELATORIO_PDF.margemEsquerda,
        y,
        largura: GRID_RELATORIO_PDF.larguraUtil,
        altura: alturaCard,
      };

      setFillHex(this.doc, "#FCFDFC");
      setDrawHex(this.doc, "#ECEFED");
      this.doc.setLineWidth(0.1);
      this.doc.roundedRect(
        caixa.x,
        caixa.y,
        caixa.largura,
        caixa.altura,
        BLOCO_CONTEUDO.raioCard,
        BLOCO_CONTEUDO.raioCard,
        "FD",
      );

      const recuoFaixa = BLOCO_CONTEUDO.recuoFaixaVertical;
      setFillHex(this.doc, CORES.verdeMedio);
      this.doc.roundedRect(
        caixa.x,
        caixa.y + recuoFaixa,
        BLOCO_CONTEUDO.faixaVerdeLargura,
        caixa.altura - recuoFaixa * 2,
        BLOCO_CONTEUDO.faixaVerdeRaio,
        BLOCO_CONTEUDO.faixaVerdeRaio,
        "F",
      );

      const conteudoX = caixa.x + BLOCO_CONTEUDO.faixaVerdeLargura + BLOCO_CONTEUDO.paddingEsquerdoConteudo;
      const tituloExibido = parte === 1 ? titulo : `${titulo} — CONTINUAÇÃO`;
      setTextHex(this.doc, CORES.verde);
      this.doc.setFont(FONTE, "bold");
      this.doc.setFontSize(TIPOGRAFIA.label);
      this.doc.text(
        tituloExibido.toUpperCase(),
        conteudoX,
        caixa.y + paddingSuperior + BLOCO_CONTEUDO.offsetTituloVertical,
      );

      setTextHex(this.doc, CORES.grafite);
      this.doc.setFont(FONTE, "normal");
      this.doc.setFontSize(tamanhoFonte);
      this.doc.text(
        trecho,
        conteudoX,
        caixa.y + paddingSuperior + alturaCabecalho + alturaLinhaMm + BLOCO_CONTEUDO.offsetCorpoVertical,
        { lineHeightFactor },
      );

      indiceLinha += trecho.length;
      y += alturaCard + margemEntreBlocos;
      parte += 1;

      if (indiceLinha < linhas.length) {
        this.desenharRodapeAtual();
        y = this.iniciarPaginaInformacoesContinuacao();
      }
    }

    return y;
  }

  private desenharBadgeFluxoEtapa(
    centroX: number,
    seloY: number,
    status: string,
    larguraMaxima: number,
  ) {
    const cores = statusCorEtapa(status);
    const statusTexto = formatarStatusBadgeFluxoPdf(status);
    const icone = classificarIconeBadgeFluxo(status);
    const temIcone = icone !== null;

    this.doc.setFont(FONTE, "bold");
    this.doc.setFontSize(TIPOGRAFIA.fluxoBadge);
    const larguraTexto = this.doc.getTextWidth(statusTexto);
    const paddingH = FLUXO_LAYOUT.paddingBadgeHorizontal;
    const larguraConteudoInterno = larguraTexto + (temIcone ? LARGURA_ICONE_BADGE_FLUXO + 0.8 : 0);
    const larguraSelo = Math.min(
      larguraMaxima,
      Math.max(
        FLUXO_LAYOUT.larguraBadgeMinima,
        larguraConteudoInterno + paddingH * 2,
      ),
    );
    const seloAltura = FLUXO_LAYOUT.alturaBadge;
    const seloX = centroX - larguraSelo / 2;

    setFillHex(this.doc, cores.fundo);
    setDrawHex(this.doc, "#E5E9E7");
    this.doc.setLineWidth(0.07);
    this.doc.roundedRect(seloX, seloY, larguraSelo, seloAltura, seloAltura / 2, seloAltura / 2, "FD");

    const centroVertical = seloY + seloAltura / 2;
    const larguraConteudo = (temIcone ? LARGURA_ICONE_BADGE_FLUXO + 0.8 : 0) + larguraTexto;
    const inicioConteudo = centroX - larguraConteudo / 2;
    if (temIcone) {
      desenharIconeBadgeFluxo(
        this.doc,
        icone,
        inicioConteudo + 1.2,
        centroVertical,
        cores.texto,
      );
    }

    setTextHex(this.doc, cores.texto);
    const textoX = temIcone
      ? inicioConteudo + LARGURA_ICONE_BADGE_FLUXO + 0.8
      : centroX;
    this.doc.text(statusTexto, textoX, centroVertical, {
      align: temIcone ? "left" : "center",
      baseline: "middle",
    });
  }

  private desenharFluxoAprovacao(caixa: Caixa) {
    const assinaturasPorEtapa = new Map(
      (this.dados.assinaturas || []).map((assinatura) => [assinatura.stepNumber, assinatura]),
    );
    const etapas = ETAPAS_FLUXO_PDF.map((etapa) => ({
      ...etapa,
      status: assinaturasPorEtapa.get(etapa.stepNumber)?.status || "Não iniciada",
    }));

    setFillHex(this.doc, "#FAFCFA");
    setDrawHex(this.doc, CORES.verdeLinha);
    this.doc.setLineWidth(0.11);
    this.doc.roundedRect(
      caixa.x,
      caixa.y,
      caixa.largura,
      caixa.altura,
      FLUXO_LAYOUT.raioCard,
      FLUXO_LAYOUT.raioCard,
      "FD",
    );

    const camadas = calcularCamadasVerticaisFluxoPdf(caixa.y, caixa.altura);
    const trilha = calcularTrilhaHorizontalFluxoPdf(caixa.x, caixa.largura);

    setTextHex(this.doc, CORES.cinza);
    this.doc.setFont(FONTE, "bold");
    this.doc.setFontSize(TIPOGRAFIA.fluxoTitulo);
    this.doc.text(
      "ETAPAS DE APROVAÇÃO",
      trilha.xArea,
      camadas.tituloY,
      { baseline: "alphabetic" },
    );

    const centros = calcularCentrosEtapasFluxoPdf(
      trilha.xTrilha,
      trilha.larguraTrilha,
    );
    const linhaY = camadas.circuloY;
    const raioCirculo = FLUXO_LAYOUT.raioCirculo;
    const seloY = camadas.badgeY;
    const larguraCelula = trilha.larguraTrilha / (centros.length - 1 || 1);
    const alturaAreaNomes = camadas.alturaAreaNomes;

    for (let indice = 0; indice < centros.length - 1; indice += 1) {
      const corSegmento = etapaConcluidaParaLinha(etapas[indice].status) ? CORES.verdeMedio : "#D8E0E3";
      setDrawHex(this.doc, corSegmento);
      this.doc.setLineWidth(0.3);
      const xInicio = centros[indice] + raioCirculo + FLUXO_LAYOUT.gapConector;
      const xFim = centros[indice + 1] - raioCirculo - FLUXO_LAYOUT.gapConector;
      if (xFim > xInicio) {
        this.doc.line(xInicio, linhaY, xFim, linhaY);
      }
    }

    etapas.forEach((etapa, indice) => {
      const centroX = centros[indice];
      const cores = statusCorEtapa(etapa.status);
      const normalizado = normalizarStatusParaCor(etapa.status);
      const futura = normalizado.includes("nao inici")
        || normalizado.includes("aguard")
        || normalizado.includes("pend");
      const atual = etapaAtualEmDestaque(etapa.status);

      if (futura && !ehStatusNegativo(normalizado) && !normalizado.includes("cancel")) {
        setFillHex(this.doc, "#F3F5F4");
        setDrawHex(this.doc, "#C5CDD3");
        this.doc.setLineWidth(0.35);
        this.doc.circle(centroX, linhaY, raioCirculo, "FD");
        setTextHex(this.doc, "#8B939C");
      } else if (atual) {
        setFillHex(this.doc, CORES.laranja);
        setDrawHex(this.doc, CORES.laranja);
        this.doc.setLineWidth(0.35);
        this.doc.circle(centroX, linhaY, raioCirculo, "FD");
        setTextHex(this.doc, CORES.branco);
      } else if (etapaConcluidaParaLinha(etapa.status)) {
        setFillHex(this.doc, CORES.verde);
        setDrawHex(this.doc, CORES.verde);
        this.doc.setLineWidth(0.35);
        this.doc.circle(centroX, linhaY, raioCirculo, "FD");
        setTextHex(this.doc, CORES.branco);
      } else {
        setFillHex(this.doc, cores.linha);
        setDrawHex(this.doc, cores.linha);
        this.doc.setLineWidth(0.35);
        this.doc.circle(centroX, linhaY, raioCirculo, "FD");
        setTextHex(this.doc, CORES.branco);
      }

      this.doc.setFont(FONTE, "bold");
      this.doc.setFontSize(6.6);
      this.doc.text(String(etapa.stepNumber), centroX, linhaY, {
        align: "center",
        baseline: "middle",
      });

      const nomeExibicao = textoExibicaoNomeEtapaFluxoPdf(etapa.nome, etapa.stepNumber);
      const larguraNome = Math.min(larguraCelula - 2, 24);
      const nomeDuasLinhas = nomeExibicao.includes("\n");
      const nomeAjustado = ajustarTextoNaCaixa(
        this.doc,
        nomeExibicao,
        larguraNome,
        alturaAreaNomes,
        TIPOGRAFIA.fluxoEtapa,
        nomeDuasLinhas ? 5.2 : 5.6,
        1.08,
      );
      const blocoNomeAltura = nomeAjustado.linhas.length * nomeAjustado.alturaLinhaMm;
      const primeiraLinhaY = nomeDuasLinhas
        ? camadas.nomeBaselineUnicaLinhaY - blocoNomeAltura + nomeAjustado.alturaLinhaMm
        : camadas.nomeBaselineUnicaLinhaY;
      setTextHex(this.doc, CORES.grafite);
      this.doc.setFont(FONTE, "bold");
      this.doc.setFontSize(nomeAjustado.tamanho);
      this.doc.text(nomeAjustado.linhas, centroX, primeiraLinhaY, {
        align: "center",
        lineHeightFactor: 1.08,
        baseline: "alphabetic",
      });

      this.desenharBadgeFluxoEtapa(
        centroX,
        seloY,
        etapa.status,
        Math.min(larguraCelula - 1.5, 26),
      );
    });
  }

  private desenharPaginaUnica() {
    this.prepararFundoPagina();

    const layout = LAYOUT_PAGINA_1_PDF;
    const sequencia = calcularSequenciaVerticalPagina1Pdf();
    const y = sequencia.yCabecalho;
    const caixaLogo: Caixa = {
      x: GRID_RELATORIO_PDF.margemEsquerda,
      y,
      largura: CABECALHO_PDF.larguraLogo,
      altura: layout.alturaCabecalho,
    };
    this.desenharMarcaCedro(caixaLogo);

    const divisorX = caixaLogo.x + caixaLogo.largura + CABECALHO_PDF.gapLogoDivisor;
    const centroCabecalhoY = y + layout.alturaCabecalho / 2;
    setDrawHex(this.doc, CORES.cinzaLinha);
    this.doc.setLineWidth(0.12);
    this.doc.line(
      divisorX,
      y + CABECALHO_PDF.recuoDivisorVertical,
      divisorX,
      y + layout.alturaCabecalho - CABECALHO_PDF.recuoDivisorVertical,
    );

    setTextHex(this.doc, CORES.grafite);
    this.doc.setFont(FONTE, "bold");
    this.doc.setFontSize(TIPOGRAFIA.tituloRelatorio);
    this.doc.text(
      TITULO_RELATORIO_PDF,
      divisorX + CABECALHO_PDF.gapDivisorTitulo,
      centroCabecalhoY,
      { baseline: "middle" },
    );

    setDrawHex(this.doc, CORES.verdeMedio);
    this.doc.setLineWidth(0.28);
    this.doc.line(
      GRID_RELATORIO_PDF.margemEsquerda,
      sequencia.yLinhaVerde,
      GRID_RELATORIO_PDF.xDireita,
      sequencia.yLinhaVerde,
    );

    const faixaNomeY = sequencia.yFaixaNomeIa;
    const larguraNomeUtil = GRID_RELATORIO_PDF.larguraUtil - RESERVA_LARGURA_BADGE_STATUS_MM;
    const nomeAjustado = ajustarTextoNaCaixa(
      this.doc,
      textoSeguro(this.dados.nomeIa, "Inteligência Artificial").toUpperCase(),
      larguraNomeUtil,
      layout.alturaFaixaNomeIa,
      TIPOGRAFIA.nomeIa,
      12,
      1.04,
    );
    const centroFaixaNome = faixaNomeY + layout.alturaFaixaNomeIa / 2;
    const blocoNomeAltura = nomeAjustado.linhas.length * nomeAjustado.alturaLinhaMm;
    const nomeBaselineY = centroFaixaNome - blocoNomeAltura / 2 + nomeAjustado.alturaLinhaMm;
    setTextHex(this.doc, CORES.verde);
    this.doc.setFont(FONTE, "bold");
    this.doc.setFontSize(nomeAjustado.tamanho);
    this.doc.text(nomeAjustado.linhas, GRID_RELATORIO_PDF.margemEsquerda, nomeBaselineY, {
      lineHeightFactor: 1.04,
    });
    this.desenharSeloStatusAlinhadoDireita(this.dados.status, centroFaixaNome);

    const faixaResumo: Caixa = {
      x: GRID_RELATORIO_PDF.margemEsquerda,
      y: sequencia.yFaixaResumo,
      largura: GRID_RELATORIO_PDF.larguraUtil,
      altura: layout.alturaFaixaResumo,
    };
    this.desenharFaixaResumoSolicitacao(faixaResumo);

    const caixaFluxo: Caixa = {
      x: GRID_RELATORIO_PDF.margemEsquerda,
      y: sequencia.yCardFluxo,
      largura: GRID_RELATORIO_PDF.larguraUtil,
      altura: layout.alturaCardFluxo,
    };
    this.desenharFluxoAprovacao(caixaFluxo);

    this.desenharTituloSecaoComLinha("INFORMAÇÕES DA SOLICITAÇÃO", sequencia.yTituloInformacoes);

    const objetivos = [
      ...(this.dados.objetivos || []),
      ...(this.dados.objetivoOutro ? [this.dados.objetivoOutro] : []),
    ];

    let proximoY = sequencia.yInicioBlocos;
    proximoY = this.desenharBlocoTextoPaginado(
      "Descrição da atividade",
      this.dados.descricaoAtividade,
      proximoY,
    );
    proximoY = this.desenharBlocoTextoPaginado(
      "Utilizações selecionadas",
      objetivos.length ? objetivos.join(" • ") : "Não informado.",
      proximoY,
    );
    this.desenharBlocoTextoPaginado(
      "Benefícios esperados",
      this.dados.beneficiosEsperados,
      proximoY,
    );

    this.desenharRodapeAtual();
  }
}

export async function gerarRelatorioPdfEstruturado(
  dados: RelatorioPdfDados,
  logoCedroPersonalizada?: string,
) {
  const [logoCedro, overlays] = await Promise.all([
    logoCedroPersonalizada ? Promise.resolve(logoCedroPersonalizada) : carregarLogoCedro(),
    carregarOverlaysRelatorioPdf(),
  ]);
  return new DocumentoRelatorioCedroUmaPagina(dados, logoCedro, overlays).gerar();
}
