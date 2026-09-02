export const ABAS_APLICACAO = [
  "dashboard",
  "inventory",
  "new",
  "report",
  "profile",
  "chat",
  "sectors",
  "admin",
  "sectors_mgr",
  "approval_queue",
] as const;

export type AbaAplicacao = (typeof ABAS_APLICACAO)[number];

const ABAS_VALIDAS = new Set<string>(ABAS_APLICACAO);

export function normalizarAbaAplicacao(valor: string | null | undefined): AbaAplicacao {
  return valor && ABAS_VALIDAS.has(valor) ? (valor as AbaAplicacao) : "profile";
}

export const TITULOS_ABAS: Record<AbaAplicacao, string> = {
  dashboard: "Dashboard",
  inventory: "Inventário de IA",
  new: "Nova Solicitação",
  report: "Relatório",
  profile: "Meu Perfil",
  chat: "Chat",
  sectors: "Mapa de IAs",
  admin: "Administração IA",
  sectors_mgr: "Setores",
  approval_queue: "Aprovação de IAs",
};
