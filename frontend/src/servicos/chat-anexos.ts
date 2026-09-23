import { BUCKETS_SUPABASE } from "@/constantes/supabase";
import { supabase } from "@/servicos/supabase";
import { extrairCaminhoAnexoChat } from "@/servicos/chat-anexos-caminho";

export {
  LIMITE_BYTES_ANEXO_CHAT,
  MIME_ANEXO_CHAT_PERMITIDOS,
  MENSAGEM_ANEXO_FORMATO,
  MENSAGEM_ANEXO_GRANDE,
  extrairCaminhoAnexoChat,
  limparAnexoChatAposFalhaDeMensagem,
  montarCaminhoAnexoChat,
  sanitizarNomeArquivoAnexo,
  validarAnexoChat,
} from "@/servicos/chat-anexos-caminho";

export async function removerObjetoAnexoChat(caminho: string) {
  return supabase.storage.from(BUCKETS_SUPABASE.ANEXOS_CHAT).remove([caminho]);
}

export async function obterUrlLeituraAnexoChat(referencia?: string | null): Promise<string | null> {
  const caminho = extrairCaminhoAnexoChat(referencia);
  if (!caminho) return null;

  const { data, error } = await supabase.storage
    .from(BUCKETS_SUPABASE.ANEXOS_CHAT)
    .createSignedUrl(caminho, 60 * 10);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
