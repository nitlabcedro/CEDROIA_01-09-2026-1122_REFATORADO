import type { UserProfile, UserRole } from "@/tipos";

export function normalizarPapel(papel?: string | null): string {
  return String(papel || "").trim().toLowerCase();
}

export function usuarioEhAdmin(perfil?: Pick<UserProfile, "role"> | null): boolean {
  return normalizarPapel(perfil?.role) === "admin";
}

export function usuarioEhModerador(perfil?: Pick<UserProfile, "role"> | null): boolean {
  return normalizarPapel(perfil?.role) === "moderator";
}

export function usuarioEhPrivilegiado(perfil?: Pick<UserProfile, "role"> | null): boolean {
  return usuarioEhAdmin(perfil) || usuarioEhModerador(perfil);
}

export function papelValido(papel: string): papel is UserRole {
  return ["admin", "moderator", "user"].includes(normalizarPapel(papel));
}
