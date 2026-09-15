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

export const ROTAS_POR_ABA: Record<AbaAplicacao, string> = {
  dashboard: "/painel",
  inventory: "/inventario",
  new: "/nova-solicitacao",
  report: "/relatorios",
  profile: "/perfil",
  chat: "/chat",
  sectors: "/mapa-ias",
  admin: "/administracao",
  sectors_mgr: "/setores",
  approval_queue: "/aprovacoes",
};

export const ABA_POR_ROTA = Object.fromEntries(
  Object.entries(ROTAS_POR_ABA).map(([aba, rota]) => [rota, aba]),
) as Record<string, AbaAplicacao>;

export const ROTA_REDEFINIR_SENHA = "/reset-password";

export function normalizarAbaAplicacao(valor: string | null | undefined): AbaAplicacao {
  return valor && ABAS_VALIDAS.has(valor) ? (valor as AbaAplicacao) : "profile";
}

export const TITULOS_ABAS: Record<AbaAplicacao, string> = {
  dashboard: "Dashboard",
  inventory: "Minhas IAs",
  new: "Nova Solicitação",
  report: "Relatório",
  profile: "Meu Perfil",
  chat: "Chat",
  sectors: "Mapa de IAs",
  admin: "Administração IA",
  sectors_mgr: "Setores",
  approval_queue: "Aprovação de IAs",
};
