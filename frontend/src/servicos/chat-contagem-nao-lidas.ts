/**
 * Cálculo puro de mensagens não lidas para badge global e Chat (sem I/O).
 */

/** Limite da consulta mínima de badge (somente metadados, sem conteúdo). */
export const LIMITE_MENSAGENS_CONTAGEM_BADGE = 500;

export type MensagemParaContagem = {
  id: string;
  sender_id?: string;
  recipient_id?: string;
  created_at?: string;
};

export function obterMapaVistoChat(storedJson: string | null): Record<string, string> {
  if (!storedJson) return {};
  try {
    const parsed = JSON.parse(storedJson) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function timestampMensagem(msg: MensagemParaContagem): number {
  if (!msg.created_at) return 0;
  const t = new Date(msg.created_at).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** Mensagens recebidas de um parceiro (qualquer ordem na entrada). */
export function listarRecebidasDoParceiro(
  mensagens: MensagemParaContagem[],
  userId: string,
  partnerId: string,
): MensagemParaContagem[] {
  return mensagens.filter(
    (msg) => msg.sender_id === partnerId && msg.recipient_id === userId,
  );
}

/** Última mensagem recebida do parceiro (por created_at). */
export function obterIdUltimaMensagemRecebidaDoParceiro(
  mensagens: MensagemParaContagem[],
  userId: string,
  partnerId: string,
): string | undefined {
  const recebidas = listarRecebidasDoParceiro(mensagens, userId, partnerId);
  if (recebidas.length === 0) return undefined;
  let melhor = recebidas[0];
  for (const msg of recebidas) {
    if (timestampMensagem(msg) >= timestampMensagem(melhor)) melhor = msg;
  }
  return melhor.id;
}

/**
 * Avança o marcador de leitura do parceiro sem regredir para mensagens mais antigas.
 * `mensagensContexto` deve incluir as recebidas conhecidas (conversa aberta ou feed global).
 */
export function avancarMarcadorLeituraParceiro(
  mapaVisto: Record<string, string>,
  userId: string,
  partnerId: string,
  candidatoId: string | null | undefined,
  mensagensContexto: MensagemParaContagem[],
): Record<string, string> {
  if (!partnerId || !candidatoId) return mapaVisto;
  if (mapaVisto[partnerId] === candidatoId) return mapaVisto;

  const recebidas = listarRecebidasDoParceiro(mensagensContexto, userId, partnerId);
  const candidato = recebidas.find((msg) => msg.id === candidatoId);
  const atualId = mapaVisto[partnerId];
  const atual = atualId ? recebidas.find((msg) => msg.id === atualId) : undefined;

  if (!candidato) {
    if (!atualId) return { ...mapaVisto, [partnerId]: candidatoId };
    return mapaVisto;
  }
  if (!atual) return { ...mapaVisto, [partnerId]: candidatoId };
  if (timestampMensagem(candidato) >= timestampMensagem(atual)) {
    return { ...mapaVisto, [partnerId]: candidatoId };
  }
  return mapaVisto;
}

/** Agrupa recebidas por remetente (ordem decrescente de created_at esperada na entrada). */
function agruparRecebidasPorRemetente(
  mensagens: MensagemParaContagem[],
  userId: string,
): Record<string, MensagemParaContagem[]> {
  const porRemetente: Record<string, MensagemParaContagem[]> = {};
  for (const msg of mensagens) {
    if (!msg.sender_id || msg.sender_id === userId) continue;
    if (msg.recipient_id !== userId) continue;
    if (!porRemetente[msg.sender_id]) porRemetente[msg.sender_id] = [];
    porRemetente[msg.sender_id].push(msg);
  }
  return porRemetente;
}

export function calcularContagemNaoLidasPorParceiro(
  mensagens: MensagemParaContagem[],
  userId: string,
  mapaVisto: Record<string, string>,
  conversaAbertaId?: string | null,
): Record<string, number> {
  const recebidasPorParceiro = agruparRecebidasPorRemetente(mensagens, userId);
  const unread: Record<string, number> = {};

  Object.entries(recebidasPorParceiro).forEach(([partnerId, recebidas]) => {
    if (conversaAbertaId && conversaAbertaId === partnerId) {
      unread[partnerId] = 0;
      return;
    }

    const lastSeenId = mapaVisto[partnerId];
    if (!lastSeenId) {
      unread[partnerId] = recebidas.length;
      return;
    }

    const indiceVista = recebidas.findIndex((msg) => msg.id === lastSeenId);
    if (indiceVista === -1) {
      // Marcador fora da janela carregada: não reabrir tudo como não lido se já havia leitura.
      unread[partnerId] = 0;
      return;
    }
    unread[partnerId] = indiceVista;
  });

  return unread;
}

export function calcularTotalMensagensNaoLidas(
  mensagens: MensagemParaContagem[],
  userId: string,
  mapaVisto: Record<string, string>,
): number {
  const porParceiro = calcularContagemNaoLidasPorParceiro(mensagens, userId, mapaVisto);
  return somarContagemPorParceiro(porParceiro);
}

export function somarContagemPorParceiro(contagem: Record<string, number>): number {
  return Object.values(contagem).reduce((acc, n) => acc + (n || 0), 0);
}

export function mensagemIncrementaBadgeGlobal(
  msg: { sender_id?: string; recipient_id?: string },
  userId: string,
  conversaAbertaNoChat: string | null,
  parceiroAtivoNoStorage: string | null,
): boolean {
  if (!msg.recipient_id || msg.recipient_id !== userId) return false;
  if (!msg.sender_id || msg.sender_id === userId) return false;
  const parceiro = msg.sender_id;
  if (conversaAbertaNoChat && conversaAbertaNoChat === parceiro) return false;
  if (parceiroAtivoNoStorage && parceiroAtivoNoStorage === parceiro) return false;
  return true;
}
