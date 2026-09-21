import { ROTAS_POR_ABA, type AbaAplicacao } from "@/constantes/navegacao";

export interface PermissoesAcessoRapido {
  isAdmin: boolean;
  isPrivileged: boolean;
}

export interface AtalhoAcessoRapido {
  aba: AbaAplicacao;
  rota: string;
  titulo: string;
  descricao: string;
  permissao?: "admin" | "privileged";
}

const ATALHOS: AtalhoAcessoRapido[] = [
  {
    aba: "new",
    rota: ROTAS_POR_ABA.new,
    titulo: "Nova solicitação",
    descricao: "Registrar uma nova IA",
  },
  {
    aba: "inventory",
    rota: ROTAS_POR_ABA.inventory,
    titulo: "Inventário",
    descricao: "Visualizar IAs registradas",
  },
  {
    aba: "approval_queue",
    rota: ROTAS_POR_ABA.approval_queue,
    titulo: "Aprovações",
    descricao: "Acompanhar análises pendentes",
    permissao: "privileged",
  },
  {
    aba: "report",
    rota: ROTAS_POR_ABA.report,
    titulo: "Relatórios",
    descricao: "Consultar registros e pareceres",
  },
  {
    aba: "sectors",
    rota: ROTAS_POR_ABA.sectors,
    titulo: "Mapa de IAs",
    descricao: "Explorar tecnologias por setor",
    permissao: "admin",
  },
  {
    aba: "admin",
    rota: ROTAS_POR_ABA.admin,
    titulo: "Administração",
    descricao: "Gerenciar a plataforma",
    permissao: "privileged",
  },
];

export function obterAtalhosAcessoRapido(
  permissoes: PermissoesAcessoRapido,
): AtalhoAcessoRapido[] {
  return ATALHOS.filter((atalho) => {
    if (atalho.permissao === "admin") return permissoes.isAdmin;
    if (atalho.permissao === "privileged") return permissoes.isPrivileged;
    return true;
  });
}
