import { BUCKETS_SUPABASE } from "../constantes/supabase";

const PREFIXO_PUBLICO = `/object/public/${BUCKETS_SUPABASE.ANEXOS_CHAT}/`;
const PREFIXO_ASSINADO = `/object/sign/${BUCKETS_SUPABASE.ANEXOS_CHAT}/`;
const PREFIXO_AUTHENTICATED = `/object/authenticated/${BUCKETS_SUPABASE.ANEXOS_CHAT}/`;

export function sanitizarNomeArquivoAnexo(nome: string): string {
  const base = String(nome || "arquivo").replace(/[/\\]+/g, "-").replace(/\.\./g, "");
  const limpo = base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return limpo || "arquivo";
}

export function montarCaminhoAnexoChat(remetenteId: string, nomeArquivo: string, identificador: string): string {
  const extensao = sanitizarNomeArquivoAnexo(nomeArquivo).split(".").pop() || "bin";
  const id = sanitizarNomeArquivoAnexo(identificador);
  return `${remetenteId}/${id}/${sanitizarNomeArquivoAnexo(nomeArquivo) || `anexo.${extensao}`}`;
}

export const LIMITE_BYTES_ANEXO_CHAT = 5 * 1024 * 1024;

export const MIME_ANEXO_CHAT_PERMITIDOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MENSAGEM_ANEXO_GRANDE = "Arquivo muito grande. O limite é 5 MB.";
export const MENSAGEM_ANEXO_FORMATO = "Formato não permitido. Envie PDF, JPG, PNG ou WEBP.";

export function validarAnexoChat(arquivo: { size: number; type?: string | null }): string | null {
  if (arquivo.size > LIMITE_BYTES_ANEXO_CHAT) {
    return MENSAGEM_ANEXO_GRANDE;
  }
  const mime = String(arquivo.type || "").trim().toLowerCase();
  if (!(MIME_ANEXO_CHAT_PERMITIDOS as readonly string[]).includes(mime)) {
    return MENSAGEM_ANEXO_FORMATO;
  }
  return null;
}

export async function limparAnexoChatAposFalhaDeMensagem(params: {
  caminho?: string | null;
  erroOriginal: unknown;
  remover: (caminho: string) => Promise<{ error?: unknown | null } | void>;
  avisar?: (mensagem: string, erro: unknown) => void;
}): Promise<unknown> {
  const caminho = String(params.caminho || "").trim();
  if (!caminho) return params.erroOriginal;

  try {
    const resultado = await params.remover(caminho);
    const erroRemocao = resultado && typeof resultado === "object"
      ? (resultado as { error?: unknown | null }).error
      : null;
    if (erroRemocao) {
      params.avisar?.("Falha ao remover anexo órfão do chat", erroRemocao);
    }
  } catch (erroRemocao) {
    params.avisar?.("Falha ao remover anexo órfão do chat", erroRemocao);
  }

  return params.erroOriginal;
}

export function extrairCaminhoAnexoChat(referencia?: string | null): string | null {
  const valor = String(referencia || "").trim();
  if (!valor) return null;
  if (!/^https?:\/\//i.test(valor)) return valor.replace(/^\/+/, "");

  for (const prefixo of [PREFIXO_PUBLICO, PREFIXO_ASSINADO, PREFIXO_AUTHENTICATED]) {
    const indice = valor.indexOf(prefixo);
    if (indice >= 0) {
      const caminho = valor.slice(indice + prefixo.length).split("?")[0];
      return decodeURIComponent(caminho);
    }
  }
  return null;
}
