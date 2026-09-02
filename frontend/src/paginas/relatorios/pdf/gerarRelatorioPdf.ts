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
const FONTE = "helvetica";

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

function statusCor(status: string) {
  const normalizado = status.toLowerCase();
  if (normalizado.includes("aprov")) {
    return { fundo: "#E7F5EA", texto: CORES.verde };
  }
  if (normalizado.includes("neg") || normalizado.includes("indefer")) {
    return { fundo: "#FDEBEC", texto: CORES.vermelho };
  }
  return { fundo: "#FFF1DF", texto: CORES.laranja };
}

function statusCorEtapa(status: string) {
  const normalizado = status.toLowerCase();
  if (normalizado.includes("aprov")) {
    return { fundo: "#E7F5EA", texto: CORES.verde, linha: CORES.verde };
  }
  if (normalizado.includes("neg") || normalizado.includes("indefer")) {
    return { fundo: "#FDEBEC", texto: CORES.vermelho, linha: CORES.vermelho };
  }
  if (normalizado.includes("pend") || normalizado.includes("aguard")) {
    return { fundo: "#F3F4F6", texto: "#6B7280", linha: "#CBD5E1" };
  }
  return { fundo: "#FFF1DF", texto: CORES.laranja, linha: CORES.laranja };
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

async function carregarLogoCedro(): Promise<string | undefined> {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof fetch === "undefined"
  ) {
    return undefined;
  }

  const base = new URL(".", document.baseURI);
  const candidatos = [
    "LOGOCEDRO.png",
    "LOGOCEDRO-interface.png",
  ];

  for (const arquivo of candidatos) {
    try {
      const url = new URL(arquivo, base).toString();
      const resposta = await fetch(url, { cache: "no-store" });
      if (!resposta.ok) continue;

      const blob = await resposta.blob();
      if (!blob.size) continue;
      if (blob.type && !blob.type.toLowerCase().startsWith("image/")) continue;

      return await converterImagemParaJpeg(blob);
    } catch (erro) {
      console.warn(`Não foi possível preparar a logo ${arquivo}.`, erro);
    }
  }

  console.warn("Nenhuma logo válida foi encontrada para o relatório. Usando marca textual de segurança.");
  return undefined;
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
      let largura = Math.min(caixa.largura, 76);
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

  private desenharSeloStatus(caixa: Caixa, status: string) {
    const cores = statusCor(status);
    const texto = textoSeguro(status, "Pendente").toUpperCase();
    this.doc.setFont(FONTE, "bold");
    this.doc.setFontSize(8.5);
    const largura = Math.min(caixa.largura, Math.max(30, this.doc.getTextWidth(texto) + 12));
    const altura = Math.min(caixa.altura, 9);

    setFillHex(this.doc, cores.fundo);
    this.doc.roundedRect(caixa.x, caixa.y, largura, altura, altura / 2, altura / 2, "F");

    setTextHex(this.doc, cores.texto);
    this.doc.text(texto, caixa.x + largura / 2, caixa.y + altura * 0.66, { align: "center" });
  }

  private desenharCampoCompacto(caixa: Caixa, rotulo: string, valor: string) {
    setFillHex(this.doc, CORES.cinzaClaro);
    setDrawHex(this.doc, CORES.cinzaLinha);
    this.doc.setLineWidth(0.25);
    this.doc.roundedRect(caixa.x, caixa.y, caixa.largura, caixa.altura, 3.5, 3.5, "FD");

    const conteudo = caixaFilha(caixa, 5, 4, caixa.largura - 10, caixa.altura - 8);

    setTextHex(this.doc, CORES.cinza);
    this.doc.setFont(FONTE, "bold");
    this.doc.setFontSize(7.2);
    this.doc.text(rotulo.toUpperCase(), conteudo.x, conteudo.y + 2.5);

    const caixaValor = caixaFilha(conteudo, 0, 6, conteudo.largura, conteudo.altura - 6);
    const ajustado = ajustarTextoNaCaixa(
      this.doc,
      textoSeguro(valor),
      caixaValor.largura,
      caixaValor.altura,
      10.5,
      8.5,
      1.08,
    );

    setTextHex(this.doc, CORES.grafite);
    this.doc.setFont(FONTE, "bold");
    this.doc.setFontSize(ajustado.tamanho);
    this.doc.text(ajustado.linhas, caixaValor.x, caixaValor.y + ajustado.alturaLinhaMm, {
      lineHeightFactor: 1.08,
    });
  }

  private desenharRodapeAtual() {
    const caixaRodape: Caixa = {
      x: MARGEM_X,
      y: 278,
      largura: LARGURA_UTIL,
      altura: 10,
    };

    setDrawHex(this.doc, CORES.verdeLinha);
    this.doc.setLineWidth(0.35);
    this.doc.line(caixaRodape.x, caixaRodape.y, caixaRodape.x + caixaRodape.largura, caixaRodape.y);

    setTextHex(this.doc, CORES.cinza);
    this.doc.setFont(FONTE, "bold");
    this.doc.setFontSize(7.2);
    this.doc.text(`PROTOCOLO: ${textoSeguro(this.dados.protocolo)}`, caixaRodape.x, caixaRodape.y + 7);
    this.doc.text(
      `ATUALIZADO EM: ${textoSeguro(this.dados.atualizadoEm)}`,
      caixaRodape.x + caixaRodape.largura,
      caixaRodape.y + 7,
      { align: "right" },
    );
  }

  private iniciarPaginaInformacoesContinuacao() {
    this.doc.addPage();
    setFillHex(this.doc, CORES.branco);
    this.doc.rect(0, 0, PAGINA_LARGURA, PAGINA_ALTURA, "F");

    setTextHex(this.doc, CORES.grafite);
    this.doc.setFont(FONTE, "bold");
    this.doc.setFontSize(9.2);
    this.doc.text("INFORMAÇÕES DA SOLICITAÇÃO — CONTINUAÇÃO", MARGEM_X, 18);

    setDrawHex(this.doc, CORES.verdeLinha);
    this.doc.setLineWidth(0.35);
    this.doc.line(MARGEM_X, 23, MARGEM_X + LARGURA_UTIL, 23);

    return 29;
  }

  /**
   * Desenha o conteúdo textual sem reticências. A altura do card acompanha a
   * quantidade real de linhas e, quando não há espaço, o texto continua em uma
   * nova página. Assim nenhuma parte da descrição, objetivos ou benefícios é perdida.
   */
  private desenharBlocoTextoPaginado(titulo: string, texto: string, yInicial: number) {
    const tamanhoFonte = 9.2;
    const lineHeightFactor = 1.22;
    const alturaLinhaMm = tamanhoFonte * 0.3528 * lineHeightFactor;
    const limiteConteudoY = 270;
    const margemEntreBlocos = 5;
    const alturaCabecalho = 12;
    const paddingInferior = 5;
    const larguraTexto = LARGURA_UTIL - 25;

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
      const alturaCard = alturaCabecalho + trecho.length * alturaLinhaMm + paddingInferior;
      const caixa: Caixa = {
        x: MARGEM_X,
        y,
        largura: LARGURA_UTIL,
        altura: alturaCard,
      };

      setFillHex(this.doc, CORES.branco);
      setDrawHex(this.doc, CORES.cinzaLinha);
      this.doc.setLineWidth(0.25);
      this.doc.roundedRect(caixa.x, caixa.y, caixa.largura, caixa.altura, 4, 4, "FD");

      setFillHex(this.doc, CORES.verdeSuave);
      this.doc.roundedRect(caixa.x, caixa.y, 5, caixa.altura, 4, 0, "F");

      const conteudoX = caixa.x + 10;
      const tituloExibido = parte === 1 ? titulo : `${titulo} — CONTINUAÇÃO`;
      setTextHex(this.doc, CORES.verde);
      this.doc.setFont(FONTE, "bold");
      this.doc.setFontSize(8);
      this.doc.text(tituloExibido.toUpperCase(), conteudoX, caixa.y + 8);

      setTextHex(this.doc, CORES.grafite);
      this.doc.setFont(FONTE, "normal");
      this.doc.setFontSize(tamanhoFonte);
      this.doc.text(trecho, conteudoX, caixa.y + alturaCabecalho + alturaLinhaMm, {
        lineHeightFactor,
      });

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

  private desenharFluxoAprovacao(caixa: Caixa) {
    const etapas = [
      { nome: "NIT", status: this.dados.assinaturas?.[0]?.status || "Pendente" },
      { nome: "TI", status: this.dados.assinaturas?.[1]?.status || "Pendente" },
      { nome: "PERÍODO DE TESTE", status: this.dados.assinaturas?.[2]?.status || "Pendente" },
      { nome: "PRESIDÊNCIA", status: this.dados.assinaturas?.[3]?.status || "Pendente" },
      { nome: "FINANCEIRO", status: this.dados.assinaturas?.[4]?.status || "Pendente" },
    ];

    // O fluxo inteiro vive dentro de uma única caixa pai.
    // Todos os cinco itens são derivados dessa caixa, garantindo alinhamento perfeito.
    setFillHex(this.doc, "#FBFCFB");
    setDrawHex(this.doc, CORES.cinzaLinha);
    this.doc.setLineWidth(0.25);
    this.doc.roundedRect(caixa.x, caixa.y, caixa.largura, caixa.altura, 4, 4, "FD");

    const cabecalho = caixaFilha(caixa, 6, 5, caixa.largura - 12, 7);
    setTextHex(this.doc, CORES.grafite);
    this.doc.setFont(FONTE, "bold");
    this.doc.setFontSize(8.5);
    this.doc.text("FLUXO DE APROVAÇÃO", cabecalho.x, cabecalho.y + 3);

    const linhaEtapas = caixaFilha(caixa, 6, 14, caixa.largura - 12, caixa.altura - 18);
    const celulas = gradeHorizontal(linhaEtapas, 5, 3);
    const centros = celulas.map((celula) => celula.x + celula.largura / 2);
    const linhaY = linhaEtapas.y + 7;

    setDrawHex(this.doc, CORES.cinzaLinha);
    this.doc.setLineWidth(0.7);
    this.doc.line(centros[0], linhaY, centros[centros.length - 1], linhaY);

    etapas.forEach((etapa, indice) => {
      const celula = celulas[indice];
      const centroX = celula.x + celula.largura / 2;
      const cores = statusCorEtapa(etapa.status);

      setFillHex(this.doc, cores.linha);
      setDrawHex(this.doc, CORES.branco);
      this.doc.setLineWidth(0.7);
      this.doc.circle(centroX, linhaY, 3.8, "FD");

      setTextHex(this.doc, CORES.branco);
      this.doc.setFont(FONTE, "bold");
      this.doc.setFontSize(6.8);
      this.doc.text(String(indice + 1), centroX, linhaY + 1.7, { align: "center" });

      const caixaNome = caixaFilha(celula, 1, 12, celula.largura - 2, 8.5);
      const nomeAjustado = ajustarTextoNaCaixa(
        this.doc,
        etapa.nome,
        caixaNome.largura,
        caixaNome.altura,
        5.8,
        4.8,
        1.02,
      );
      setTextHex(this.doc, CORES.grafite);
      this.doc.setFont(FONTE, "bold");
      this.doc.setFontSize(nomeAjustado.tamanho);
      this.doc.text(nomeAjustado.linhas, centroX, caixaNome.y + nomeAjustado.alturaLinhaMm, {
        align: "center",
        lineHeightFactor: 1.02,
      });

      const caixaStatus = caixaFilha(celula, 2, 22, celula.largura - 4, 7);
      const statusTexto = textoSeguro(etapa.status, "Pendente").toUpperCase();
      this.doc.setFontSize(5.4);
      const larguraSelo = Math.min(caixaStatus.largura, Math.max(18, this.doc.getTextWidth(statusTexto) + 6));
      const seloX = caixaStatus.x + (caixaStatus.largura - larguraSelo) / 2;
      const seloAltura = 6.3;

      setFillHex(this.doc, cores.fundo);
      this.doc.roundedRect(seloX, caixaStatus.y, larguraSelo, seloAltura, seloAltura / 2, seloAltura / 2, "F");
      setTextHex(this.doc, cores.texto);
      this.doc.text(statusTexto, centroX, caixaStatus.y + 4.15, { align: "center" });
    });
  }

  private desenharPaginaUnica() {
    setFillHex(this.doc, CORES.branco);
    this.doc.rect(0, 0, PAGINA_LARGURA, PAGINA_ALTURA, "F");

    // Grade principal: todos os blocos são filhos desta área útil.
    const paginaUtil: Caixa = {
      x: MARGEM_X,
      y: 10,
      largura: LARGURA_UTIL,
      altura: 278,
    };

    // Elementos decorativos isolados da grade de conteúdo.
    setFillHex(this.doc, CORES.verdeSuave);
    this.doc.circle(190, 17, 13, "F");
    setFillHex(this.doc, CORES.verdeLinha);
    this.doc.circle(201, 27, 7, "F");

    const caixaLogo = caixaFilha(paginaUtil, 0, 1, 78, 27);
    this.desenharMarcaCedro(caixaLogo);

    const caixaTitulo = caixaFilha(paginaUtil, 0, 37, paginaUtil.largura, 20);
    setTextHex(this.doc, CORES.grafite);
    this.doc.setFont(FONTE, "bold");
    this.doc.setFontSize(16.5);
    this.doc.text("RELATÓRIO DE AVALIAÇÃO", caixaTitulo.x, caixaTitulo.y + 3);
    this.doc.text("DE INTELIGÊNCIA ARTIFICIAL", caixaTitulo.x, caixaTitulo.y + 12);

    setDrawHex(this.doc, CORES.verdeLinha);
    this.doc.setLineWidth(0.45);
    this.doc.line(paginaUtil.x, caixaTitulo.y + 19, paginaUtil.x + paginaUtil.largura, caixaTitulo.y + 19);

    const caixaIdentificacao = caixaFilha(paginaUtil, 0, 62, paginaUtil.largura, 24);
    setTextHex(this.doc, CORES.cinza);
    this.doc.setFont(FONTE, "bold");
    this.doc.setFontSize(7.4);
    this.doc.text("INTELIGÊNCIA ARTIFICIAL SOLICITADA", caixaIdentificacao.x, caixaIdentificacao.y + 3);

    const caixaNome = caixaFilha(caixaIdentificacao, 0, 7, 116, 15);
    const nomeAjustado = ajustarTextoNaCaixa(
      this.doc,
      textoSeguro(this.dados.nomeIa, "Inteligência Artificial"),
      caixaNome.largura,
      caixaNome.altura,
      20,
      12,
      1.02,
    );
    setTextHex(this.doc, CORES.verde);
    this.doc.setFont(FONTE, "bold");
    this.doc.setFontSize(nomeAjustado.tamanho);
    this.doc.text(nomeAjustado.linhas, caixaNome.x, caixaNome.y + nomeAjustado.alturaLinhaMm, {
      lineHeightFactor: 1.02,
    });

    const caixaStatusGeral = caixaFilha(caixaIdentificacao, 132, 0, 42, 20);
    setTextHex(this.doc, CORES.cinza);
    this.doc.setFont(FONTE, "bold");
    this.doc.setFontSize(7.4);
    this.doc.text("STATUS", caixaStatusGeral.x, caixaStatusGeral.y + 3);
    const caixaSeloGeral = caixaFilha(caixaStatusGeral, 0, 7, caixaStatusGeral.largura, 10);
    this.desenharSeloStatus(caixaSeloGeral, this.dados.status);

    // Linha de dados essenciais - os 3 campos compartilham exatamente a mesma caixa pai.
    const linhaCampos = caixaFilha(paginaUtil, 0, 91, paginaUtil.largura, 22);
    const campos = gradeHorizontal(linhaCampos, 3, 5);
    this.desenharCampoCompacto(campos[0], "Solicitante", this.dados.solicitante);
    this.desenharCampoCompacto(campos[1], "Setor", this.dados.setorSolicitante);
    this.desenharCampoCompacto(campos[2], "Data da solicitação", this.dados.dataCadastro);

    // Fluxo aninhado em um único bloco pai, impedindo desalinhamento dos 5 status.
    const caixaFluxo = caixaFilha(paginaUtil, 0, 119, paginaUtil.largura, 43);
    this.desenharFluxoAprovacao(caixaFluxo);

    // Informações da solicitação: os cards agora crescem conforme o conteúdo.
    // Se o texto não couber na primeira página, o restante continua em páginas adicionais.
    const caixaInformacoes = caixaFilha(paginaUtil, 0, 168, paginaUtil.largura, 12);
    setTextHex(this.doc, CORES.grafite);
    this.doc.setFont(FONTE, "bold");
    this.doc.setFontSize(9.2);
    this.doc.text("INFORMAÇÕES DA SOLICITAÇÃO", caixaInformacoes.x, caixaInformacoes.y + 3);
    setDrawHex(this.doc, CORES.verdeLinha);
    this.doc.line(
      caixaInformacoes.x,
      caixaInformacoes.y + 8,
      caixaInformacoes.x + caixaInformacoes.largura,
      caixaInformacoes.y + 8,
    );

    const objetivos = [
      ...(this.dados.objetivos || []),
      ...(this.dados.objetivoOutro ? [this.dados.objetivoOutro] : []),
    ];

    let proximoY = caixaInformacoes.y + 13;
    proximoY = this.desenharBlocoTextoPaginado(
      "Descrição da atividade",
      this.dados.descricaoAtividade,
      proximoY,
    );
    proximoY = this.desenharBlocoTextoPaginado(
      "Objetivos da utilização",
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
  const logoCedro = logoCedroPersonalizada || await carregarLogoCedro();
  return new DocumentoRelatorioCedroUmaPagina(dados, logoCedro).gerar();
}
