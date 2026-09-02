/** Utilitários de autorização do backend. Mantém normalização de papéis em um único ponto. */
export function normalizarPapel(papel?: string | null): string {
  return String(papel || "").trim().toLowerCase();
}

export function papelEhAdmin(papel?: string | null): boolean {
  return normalizarPapel(papel) === "admin";
}

export function papelEhCoordenadorNit(papel?: string | null): boolean {
  return normalizarPapel(papel) === "coordenador nit";
}
