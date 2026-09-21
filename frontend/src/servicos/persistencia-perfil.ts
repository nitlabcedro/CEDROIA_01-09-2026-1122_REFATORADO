import { CHAVES_ARMAZENAMENTO_LOCAL } from "@/constantes/armazenamento-local";
import { TABELAS_SUPABASE } from "@/constantes/supabase";
import { supabase } from "@/servicos/supabase";
import {
  obterAtribuicoesPerfil,
  serializarAtribuicoesPerfil,
  type FonteAtribuicoesPerfil,
} from "@/utilitarios/perfil-usuario";

interface ArmazenamentoAtribuicoes {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
}

interface CamposComplementaresPerfil {
  full_name?: string;
  contato?: string;
  avatar_url?: string;
}

type PersistirAtribuicoes = (
  userId: string,
  atribuicoes: FonteAtribuicoesPerfil,
) => Promise<FonteAtribuicoesPerfil>;

const obterChavePendente = (userId: string) =>
  `${CHAVES_ARMAZENAMENTO_LOCAL.ATRIBUICOES_PERFIL_PENDENTES_PREFIXO}${userId}`;

function normalizarAtribuicoes(atribuicoes: FonteAtribuicoesPerfil): {
  setor: string;
  cargo: string;
} {
  return serializarAtribuicoesPerfil(
    obterAtribuicoesPerfil(atribuicoes.setor, atribuicoes.cargo),
  );
}

export function guardarAtribuicoesPerfilPendentes(
  userId: string,
  atribuicoes: FonteAtribuicoesPerfil,
  armazenamento: ArmazenamentoAtribuicoes = localStorage,
): void {
  armazenamento.setItem(
    obterChavePendente(userId),
    JSON.stringify(normalizarAtribuicoes(atribuicoes)),
  );
}

export function lerAtribuicoesPerfilPendentes(
  userId: string,
  armazenamento: ArmazenamentoAtribuicoes = localStorage,
): FonteAtribuicoesPerfil | null {
  const valor = armazenamento.getItem(obterChavePendente(userId));
  if (!valor) return null;

  try {
    const dados = JSON.parse(valor) as FonteAtribuicoesPerfil;
    const normalizadas = normalizarAtribuicoes(dados);
    return normalizadas.setor && normalizadas.cargo ? normalizadas : null;
  } catch {
    armazenamento.removeItem(obterChavePendente(userId));
    return null;
  }
}

export function removerAtribuicoesPerfilPendentes(
  userId: string,
  armazenamento: ArmazenamentoAtribuicoes = localStorage,
): void {
  armazenamento.removeItem(obterChavePendente(userId));
}

export function conferirAtribuicoesPersistidas(
  esperadas: FonteAtribuicoesPerfil,
  persistidas: FonteAtribuicoesPerfil,
): boolean {
  const esperado = normalizarAtribuicoes(esperadas);
  const persistido = normalizarAtribuicoes(persistidas);
  return esperado.setor === persistido.setor && esperado.cargo === persistido.cargo;
}

export async function persistirAtribuicoesPerfil(
  userId: string,
  atribuicoes: FonteAtribuicoesPerfil,
  complementares: CamposComplementaresPerfil = {},
): Promise<FonteAtribuicoesPerfil> {
  const normalizadas = normalizarAtribuicoes(atribuicoes);
  if (!normalizadas.setor || !normalizadas.cargo) {
    throw new Error("As atribuições completas são obrigatórias para atualizar o perfil.");
  }

  const { data, error } = await supabase
    .from(TABELAS_SUPABASE.PERFIS)
    .update({
      ...complementares,
      setor: normalizadas.setor,
      cargo: normalizadas.cargo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("id,setor,cargo")
    .single();

  if (error) {
    throw new Error(`Não foi possível persistir todas as atribuições do perfil: ${error.message}`);
  }
  if (!data || !conferirAtribuicoesPersistidas(normalizadas, data)) {
    throw new Error("O Supabase não confirmou a persistência de todos os setores e cargos.");
  }

  return { setor: data.setor, cargo: data.cargo };
}

export async function sincronizarAtribuicoesPerfilPendentes(
  userId: string,
  armazenamento: ArmazenamentoAtribuicoes = localStorage,
  persistir: PersistirAtribuicoes = (id, atribuicoes) =>
    persistirAtribuicoesPerfil(id, atribuicoes),
): Promise<FonteAtribuicoesPerfil | null> {
  const pendentes = lerAtribuicoesPerfilPendentes(userId, armazenamento);
  if (!pendentes) return null;

  const persistidas = await persistir(userId, pendentes);
  if (!conferirAtribuicoesPersistidas(pendentes, persistidas)) {
    throw new Error("A sincronização não confirmou todas as atribuições do perfil.");
  }

  removerAtribuicoesPerfilPendentes(userId, armazenamento);
  return persistidas;
}
