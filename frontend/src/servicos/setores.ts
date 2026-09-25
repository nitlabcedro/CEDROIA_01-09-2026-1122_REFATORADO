import { supabase } from "@/servicos/supabase";
import { TABELA_SETORES_OFICIAL } from "@/servicos/setores-gestao";
import {
  normalizarSetoresAtivos,
  type SetorCadastro,
} from "@/utilitarios/cadastro-usuario";

/** Mesmo valor que TABELA_SETORES_OFICIAL (`public.sectors`). */
const TABELA_SETORES_CADASTRO = "sectors";

if (TABELA_SETORES_CADASTRO !== TABELA_SETORES_OFICIAL) {
  throw new Error("TABELA_SETORES_CADASTRO divergiu de TABELA_SETORES_OFICIAL.");
}

/**
 * Fonte oficial do cadastro: public.sectors (ver TABELA_SETORES_OFICIAL).
 * Não usa cache legado nem lista hardcoded para não aceitar atribuições obsoletas.
 */
export async function obterSetoresAtivos(): Promise<SetorCadastro[]> {
  const { data, error } = await supabase
    .from(TABELA_SETORES_CADASTRO)
    .select("name,cargos,status")
    .eq("status", "Ativo")
    .order("name");

  if (error) throw error;
  return normalizarSetoresAtivos(data);
}

export async function obterCargosDoSetor(setor: string): Promise<string[]> {
  const setores = await obterSetoresAtivos();
  return setores.find((item) => item.name === setor.trim())?.cargos || [];
}
