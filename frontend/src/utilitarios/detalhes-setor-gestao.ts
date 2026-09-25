export interface DetalheSetorParcial {
  responsible?: string;
  status?: "Ativo" | "Inativo";
  cargos?: string[];
}

export interface DetalheSetorNormalizado {
  responsible: string;
  status: "Ativo" | "Inativo";
  cargos: string[];
}

export const RESPONSAVEL_PADRAO_SETOR = "Gestor Cedro";

function textoSetorUtil(valor: string | undefined): string | undefined {
  const texto = valor?.trim();
  return texto ? texto : undefined;
}

function normalizarListaCargos(cargos: string[] | undefined): string[] {
  if (!Array.isArray(cargos)) return [];
  return cargos.map((item) => item.trim()).filter(Boolean);
}

/**
 * Mescla metadados armazenados, preset institucional e defaults por campo
 * (entrada vazia no armazenado não bloqueia fallback do preset).
 */
export function normalizarDetalhesSetor(
  armazenado: DetalheSetorParcial | undefined,
  preset: DetalheSetorParcial | undefined,
): DetalheSetorNormalizado {
  const cargosArmazenados = normalizarListaCargos(armazenado?.cargos);
  const cargosPreset = normalizarListaCargos(preset?.cargos);
  const cargos =
    cargosArmazenados.length > 0 ?
      cargosArmazenados :
      cargosPreset.length > 0 ?
        cargosPreset :
        ["Colaborador"];

  return {
    responsible:
      textoSetorUtil(armazenado?.responsible) ??
      textoSetorUtil(preset?.responsible) ??
      RESPONSAVEL_PADRAO_SETOR,
    status: armazenado?.status ?? preset?.status ?? "Ativo",
    cargos,
  };
}
