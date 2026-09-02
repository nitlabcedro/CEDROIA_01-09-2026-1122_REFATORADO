import { CHAVES_ARMAZENAMENTO_LOCAL } from "@/constantes/armazenamento-local";
import { obterCargosPadrao } from "@/constantes/setores";

interface DetalheSetorLocal {
  cargos?: unknown;
}

/**
 * Obtém cargos de um setor respeitando a ordem de fonte já usada pelo sistema:
 * Supabase -> cache legado do navegador -> fallback institucional.
 */
export async function obterCargosDoSetor(setor: string): Promise<string[]> {
  const nomeSetor = setor.trim();
  if (!nomeSetor) return [];

  try {
    const raw = localStorage.getItem(CHAVES_ARMAZENAMENTO_LOCAL.DETALHES_SETORES);
    if (raw) {
      const detalhes = JSON.parse(raw) as Record<string, DetalheSetorLocal>;
      const cargos = detalhes[nomeSetor]?.cargos;
      if (Array.isArray(cargos) && cargos.length > 0) {
        return cargos.filter((cargo): cargo is string => typeof cargo === "string" && cargo.trim().length > 0);
      }
    }
  } catch (erro) {
    console.warn(`Não foi possível ler cargos locais de ${nomeSetor}:`, erro);
  }

  return obterCargosPadrao(nomeSetor);
}
