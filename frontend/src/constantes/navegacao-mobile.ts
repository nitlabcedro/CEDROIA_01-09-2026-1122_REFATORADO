import type { AbaAplicacao } from "@/constantes/navegacao";
import { abaPermitida } from "@/utilitarios/permissoes-navegacao";

export const ORDEM_ITENS_MAIS = [
  "new",
  "sectors",
  "sectors_mgr",
  "admin",
  "profile",
] as const satisfies readonly AbaAplicacao[];

export type AbaPainelMais = (typeof ORDEM_ITENS_MAIS)[number];

export interface AcaoCentralMobile {
  aba: "new" | "approval_queue";
  rotulo: "Nova" | "Aprovação";
}

const ABAS_MAIS_ATIVAS = new Set<AbaAplicacao>([
  "profile",
  "admin",
  "sectors",
  "sectors_mgr",
]);

export function obterAcaoCentral(privilegiado: boolean): AcaoCentralMobile {
  if (privilegiado) return { aba: "approval_queue", rotulo: "Aprovação" };
  return { aba: "new", rotulo: "Nova" };
}

export function obterItensPainelMais(
  isAdmin: boolean,
  isPrivileged: boolean,
): AbaPainelMais[] {
  const central = obterAcaoCentral(isPrivileged).aba;
  return ORDEM_ITENS_MAIS.filter(
    (aba) => aba !== central && abaPermitida(aba, isAdmin, isPrivileged),
  );
}

export function acaoCentralAtiva(abaAtiva: AbaAplicacao, privilegiado: boolean): boolean {
  return abaAtiva === obterAcaoCentral(privilegiado).aba;
}

export function painelMaisAtivo(abaAtiva: AbaAplicacao, privilegiado: boolean): boolean {
  if (ABAS_MAIS_ATIVAS.has(abaAtiva)) return true;
  return privilegiado && abaAtiva === "new";
}
