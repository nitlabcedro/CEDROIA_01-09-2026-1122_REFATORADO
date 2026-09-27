import type { AbaAplicacao } from "@/constantes/navegacao";

export const ABAS_SOMENTE_ADMIN = new Set<AbaAplicacao>(["sectors", "sectors_mgr"]);
export const ABAS_PRIVILEGIADAS = new Set<AbaAplicacao>(["approval_queue", "admin"]);

export function abaPermitida(
  aba: AbaAplicacao,
  isAdmin: boolean,
  isPrivileged: boolean,
): boolean {
  if (ABAS_SOMENTE_ADMIN.has(aba)) return isAdmin;
  if (ABAS_PRIVILEGIADAS.has(aba)) return isPrivileged;
  return true;
}
