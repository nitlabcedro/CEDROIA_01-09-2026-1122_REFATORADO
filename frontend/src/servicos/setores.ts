import { supabase } from "@/servicos/supabase";
import {
  normalizarSetoresAtivos,
  type SetorCadastro,
} from "@/utilitarios/cadastro-usuario";

const TABELA_SETORES_CADASTRO = "sectors";

/**
 * Fonte oficial do cadastro: public.sectors.
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
