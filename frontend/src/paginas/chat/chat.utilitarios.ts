import type { ChatMessage, UserProfile } from "@/tipos";

export const EMOJIS_SUGERIDOS = ["😀", "😄", "👍", "👏", "🙏", "✅", "⚠️", "📌", "💬", "📎"];

export function ordenarMensagens(lista: ChatMessage[]): ChatMessage[] {
  return [...lista].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

export function mensagensSaoEquivalentes(
  temporaria: ChatMessage,
  definitiva: ChatMessage,
): boolean {
  if (!temporaria.id?.startsWith("temp-")) return false;
  if (temporaria.status !== "sending") return false;
  if (temporaria.sender_id !== definitiva.sender_id) return false;
  if (temporaria.recipient_id !== definitiva.recipient_id) return false;

  const diferencaTempo = Math.abs(
    new Date(definitiva.created_at).getTime() - new Date(temporaria.created_at).getTime(),
  );
  if (diferencaTempo > 60_000) return false;

  const textoTemporario = (temporaria.content || "").trim();
  const textoDefinitivo = (definitiva.content || "").trim();
  const mesmoTexto = textoTemporario === textoDefinitivo;
  const mesmoAnexo = Boolean(
    temporaria.attachment_name &&
      (temporaria.attachment_name === definitiva.attachment_name ||
        textoDefinitivo.includes(temporaria.attachment_name)),
  );

  return mesmoTexto || mesmoAnexo;
}

export function mesclarMensagemSemDuplicar(
  lista: ChatMessage[],
  nova: ChatMessage,
): ChatMessage[] {
  const indiceExistente = lista.findIndex((mensagem) => mensagem.id === nova.id);
  if (indiceExistente >= 0) {
    const copia = [...lista];
    copia[indiceExistente] = { ...copia[indiceExistente], ...nova };
    return ordenarMensagens(copia);
  }

  const indiceTemporaria = lista.findIndex((mensagem) =>
    mensagensSaoEquivalentes(mensagem, nova),
  );
  if (indiceTemporaria >= 0) {
    const copia = [...lista];
    copia[indiceTemporaria] = nova;
    return ordenarMensagens(copia);
  }

  return ordenarMensagens([...lista, nova]);
}

export function removerDuplicadasPorId(lista: ChatMessage[]): ChatMessage[] {
  const mapa = new Map<string, ChatMessage>();
  lista.forEach((mensagem) => {
    if (mensagem?.id) mapa.set(mensagem.id, mensagem);
  });
  return ordenarMensagens(Array.from(mapa.values()));
}

export function obterIniciais(nome?: string | null): string {
  if (!nome) return "IA";
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "IA";
  return partes.map((parte) => parte[0]).join("").substring(0, 2).toUpperCase();
}

export function usuarioEstaOnline(lastSeen?: string | null): boolean {
  if (!lastSeen) return false;
  const timestamp = new Date(lastSeen).getTime();
  if (Number.isNaN(timestamp)) return false;
  const diferenca = Date.now() - timestamp;
  return diferenca >= 0 && diferenca < 3 * 60 * 1000;
}

export function obterContatoExibicao(
  profile: UserProfile,
  usuarioAtual?: { id?: string; email?: string | null } | null,
): string {
  if (usuarioAtual?.id === profile.id && usuarioAtual.email) {
    return usuarioAtual.email;
  }

  const contato = profile.contato?.trim();
  if (contato && contato !== "N/A" && contato !== "Não informado" && contato.includes("@")) {
    return contato;
  }

  return "E-mail não informado";
}

export function datasNoMesmoDia(dataA: string, dataB: string): boolean {
  try {
    const a = new Date(dataA);
    const b = new Date(dataB);
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  } catch {
    return false;
  }
}

export function rotuloDataAmigavel(data: string): string {
  try {
    const valor = new Date(data);
    const hoje = new Date();
    const ontem = new Date();
    ontem.setDate(hoje.getDate() - 1);

    if (datasNoMesmoDia(data, hoje.toISOString())) return "Hoje";
    if (datasNoMesmoDia(data, ontem.toISOString())) return "Ontem";

    const meses = [
      "janeiro", "fevereiro", "março", "abril", "maio", "junho",
      "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
    ];
    return `${valor.getDate()} de ${meses[valor.getMonth()]} de ${valor.getFullYear()}`;
  } catch {
    return "Data Indeterminada";
  }
}

export function formatarHorarioMensagem(data: string): string {
  try {
    return new Date(data).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}
