import type { UserProfile } from "../tipos";
import { usuarioEhAdmin } from "./permissoes";

export function podeConversarNoChat(
  remetente?: Pick<UserProfile, "id" | "role"> | null,
  destinatario?: Pick<UserProfile, "id" | "role"> | null,
): boolean {
  if (!remetente?.id || !destinatario?.id) return false;
  if (remetente.id === destinatario.id) return false;
  if (usuarioEhAdmin(remetente)) return true;
  return usuarioEhAdmin(destinatario);
}

export function filtrarContatosChat(
  remetente: Pick<UserProfile, "id" | "role"> | null | undefined,
  contatos: UserProfile[],
): UserProfile[] {
  return contatos.filter((contato) => podeConversarNoChat(remetente, contato));
}
