import type { UserProfile } from "@/tipos";

export interface AtribuicaoPerfil {
  setor: string;
  cargo: string;
}

function separarValores(valor?: string): string[] {
  return (valor || "").split(";").map((item) => item.trim()).filter(Boolean);
}

export function obterAtribuicoesPerfil(setor?: string, cargo?: string): AtribuicaoPerfil[] {
  const setores = separarValores(setor);
  const cargos = separarValores(cargo);

  return setores.map((nomeSetor, indice) => ({
    setor: nomeSetor,
    cargo: cargos[indice] || "",
  }));
}

export function obterCargoPrincipal(cargo?: string): string {
  return separarValores(cargo)[0] || "";
}

export function obterRotuloNivelAcesso(role?: UserProfile["role"]): string {
  if (role === "admin") return "Administrador";
  if (role === "moderator") return "Moderador";
  return "Usuário";
}

export function obterRotuloStatusPerfil(status?: UserProfile["status"]): string {
  if (status === "Autorizado") return "Ativo";
  return status || "Pendente";
}
