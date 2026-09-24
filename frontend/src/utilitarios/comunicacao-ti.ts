import {
  LIMITE_MENSAGEM_COMUNICACAO_TI,
  LIMITE_PERGUNTA_BLOCO_TI,
  LIMITE_RESPOSTA_BLOCO_TI,
  MAXIMO_PERGUNTAS_BLOCO_TI,
} from "../constantes/comunicacao-ti";
import type {
  MensagemComunicacaoTI,
  SolicitacaoInformacoesTI,
  TurnoComunicacaoTI,
} from "../tipos";

export type AcaoNotificacaoComunicacaoTI =
  | "abrir_modal"
  | "fechar_modal"
  | "enviar_mensagem"
  | "salvar_resposta_bloco"
  | "finalizar_bloco"
  | "encerrar_conversa";

export function criarTravaEnvioComunicacaoTI() {
  let ocupada = false;
  return {
    tentarIniciar() {
      if (ocupada) return false;
      ocupada = true;
      return true;
    },
    liberar() {
      ocupada = false;
    },
  };
}

export function mensagemComunicacaoTIValida(mensagem: string): boolean {
  const texto = mensagem.trim();
  return texto.length > 0 && texto.length <= LIMITE_MENSAGEM_COMUNICACAO_TI;
}

export function perguntasBlocoTIValidas(perguntas: string[]): boolean {
  return perguntas.length >= 1
    && perguntas.length <= MAXIMO_PERGUNTAS_BLOCO_TI
    && perguntas.every((pergunta) => {
      const texto = pergunta.trim();
      return texto.length >= 1 && texto.length <= LIMITE_PERGUNTA_BLOCO_TI;
    });
}

export function respostaBlocoTIValida(resposta: string): boolean {
  const texto = resposta.trim();
  return texto.length >= 1 && texto.length <= LIMITE_RESPOSTA_BLOCO_TI;
}

export function respostasLocaisBlocoTIValidas(
  perguntas: Array<{ id: string }>,
  respostas: Record<string, string>,
): boolean {
  return perguntas.length > 0
    && perguntas.every((pergunta) => respostaBlocoTIValida(respostas[pergunta.id] || ""));
}

export async function salvarEFinalizarRespostasBlocoTI<T>(params: {
  perguntas: Array<{ id: string }>;
  respostas: Record<string, string>;
  salvar: (perguntaId: string, resposta: string) => Promise<unknown>;
  finalizar: () => Promise<T>;
}): Promise<T> {
  for (const pergunta of params.perguntas) {
    await params.salvar(pergunta.id, params.respostas[pergunta.id]);
  }
  return params.finalizar();
}

export function calcularProgressoBlocoTI(
  perguntas: Array<{ resposta?: string }>,
) {
  const totalPerguntas = perguntas.length;
  const totalRespondidas = perguntas.filter(
    (pergunta) => String(pergunta.resposta || "").trim().length > 0,
  ).length;
  return {
    totalPerguntas,
    totalRespondidas,
    todasRespondidas: totalPerguntas > 0 && totalRespondidas === totalPerguntas,
  };
}

export function usuarioPodeEscreverComunicacaoTI(
  papelUsuario: TurnoComunicacaoTI,
  conversa?: SolicitacaoInformacoesTI | null,
): boolean {
  if (!conversa || conversa.modo !== "chat" || conversa.estado === "encerrada") return false;
  return conversa.turnoAtual === papelUsuario;
}

export function obterConversaAbertaTI(
  interacoes: SolicitacaoInformacoesTI[],
): SolicitacaoInformacoesTI | undefined {
  return [...interacoes]
    .sort((a, b) => b.numeroRodada - a.numeroRodada)
    .find((interacao) => interacao.estado !== "encerrada");
}

export function acaoResolveNotificacaoComunicacaoTI(
  papelUsuario: TurnoComunicacaoTI,
  acao: AcaoNotificacaoComunicacaoTI,
): boolean {
  if (acao === "abrir_modal" || acao === "fechar_modal") return false;
  if (papelUsuario === "solicitante") {
    return acao === "enviar_mensagem" || acao === "finalizar_bloco";
  }
  return acao === "enviar_mensagem" || acao === "encerrar_conversa";
}

export function consolidarHistoricoComunicacaoTI(
  interacoes: SolicitacaoInformacoesTI[],
): MensagemComunicacaoTI[] {
  const ids = new Set<string>();
  const mensagens: Array<MensagemComunicacaoTI & { rodada: number }> = [];

  for (const interacao of interacoes) {
    for (const item of interacao.mensagens || []) {
      if (ids.has(item.id)) continue;
      ids.add(item.id);
      mensagens.push({ ...item, rodada: interacao.numeroRodada });
    }
  }

  return mensagens
    .sort((a, b) =>
      a.rodada - b.rodada
      || a.sequencia - b.sequencia
      || a.criadoEm.localeCompare(b.criadoEm)
    )
    .map(({ rodada: _rodada, ...item }) => item);
}
