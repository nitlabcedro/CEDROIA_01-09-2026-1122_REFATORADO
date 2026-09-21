/**
 * Persistência da página Setores em public.sectors / public.setores.
 * Separado de armazenamento.ts para testes e para alinhar com obterSetoresAtivos.
 */

import { TABELAS_SUPABASE } from "@/constantes/supabase";
import { supabase } from "@/servicos/supabase";

export const TABELAS_SETORES_CANDIDATAS = [
  "sectors",
  TABELAS_SUPABASE.SETORES,
] as const;

export interface SetorGestaoDetalhe {
  description?: string;
  responsible?: string;
  status?: "Ativo" | "Inativo";
  cargos?: string[];
}

export type MapaDetalhesSetor = Record<string, SetorGestaoDetalhe>;

export interface LinhaSetorPersistencia {
  name: string;
  status: "Ativo" | "Inativo";
  cargos: string[];
  description?: string;
  responsible?: string;
}

export interface PlanoSincronizacaoSetores {
  upserts: LinhaSetorPersistencia[];
  nomesRemover: string[];
}

export function montarLinhasPersistenciaSetores(
  nomes: string[],
  detalhes: MapaDetalhesSetor,
): LinhaSetorPersistencia[] {
  return nomes.map((name) => {
    const meta = detalhes[name] ?? {};
    const cargos = Array.isArray(meta.cargos)
      ? meta.cargos.filter((c): c is string => typeof c === "string" && c.trim() !== "")
      : [];
    return {
      name,
      status: meta.status === "Inativo" ? "Inativo" : "Ativo",
      cargos: cargos.length > 0 ? cargos : ["Colaborador"],
      description: meta.description?.trim() || undefined,
      responsible: meta.responsible?.trim() || undefined,
    };
  });
}

export function mapearLinhasParaDetalhes(
  linhas: LinhaSetorPersistencia[],
): MapaDetalhesSetor {
  const mapa: MapaDetalhesSetor = {};
  for (const linha of linhas) {
    mapa[linha.name] = {
      description: linha.description,
      responsible: linha.responsible,
      status: linha.status,
      cargos: linha.cargos,
    };
  }
  return mapa;
}

export function planejarSincronizacaoSetores(
  nomesAtuais: string[],
  detalhes: MapaDetalhesSetor,
  nomesExistentesNoBanco: string[],
): PlanoSincronizacaoSetores {
  const conjuntoAtual = new Set(nomesAtuais);
  const nomesRemover = nomesExistentesNoBanco.filter((nome) => !conjuntoAtual.has(nome));
  return {
    upserts: montarLinhasPersistenciaSetores(nomesAtuais, detalhes),
    nomesRemover,
  };
}

function erroTabelaInexistente(message: string): boolean {
  const msg = message.toLowerCase();
  return msg.includes("does not exist") || msg.includes("could not find the table");
}

function erroColunaInexistente(message: string): boolean {
  const msg = message.toLowerCase();
  return msg.includes("column") && msg.includes("does not exist")
    || msg.includes("could not find the column");
}

function normalizarLinhaBruta(item: Record<string, unknown>): LinhaSetorPersistencia | null {
  const name = typeof item.name === "string" ? item.name.trim() : "";
  if (!name) return null;
  const status = item.status === "Inativo" ? "Inativo" : "Ativo";
  let cargos: string[] = [];
  if (Array.isArray(item.cargos)) {
    cargos = item.cargos.filter((c): c is string => typeof c === "string" && c.trim() !== "");
  }
  return {
    name,
    status,
    cargos: cargos.length > 0 ? cargos : ["Colaborador"],
    description: typeof item.description === "string" ? item.description : undefined,
    responsible: typeof item.responsible === "string" ? item.responsible : undefined,
  };
}

async function selecionarSetores(
  tabela: string,
  colunas: string,
): Promise<{ linhas: LinhaSetorPersistencia[]; error: unknown }> {
  const { data, error } = await supabase
    .from(tabela)
    .select(colunas)
    .order("name");

  if (error) return { linhas: [], error };

  const linhas = (data ?? [])
    .map((item) => normalizarLinhaBruta(item as unknown as Record<string, unknown>))
    .filter((item): item is LinhaSetorPersistencia => item !== null);

  return { linhas, error: null };
}

export async function carregarSetoresGestaoDoSupabase(): Promise<{
  nomes: string[];
  detalhes: MapaDetalhesSetor;
} | null> {
  const colunasCompletas = "name,status,cargos,description,responsible";
  const colunasBasicas = "name,status,cargos";

  for (const tabela of TABELAS_SETORES_CANDIDATAS) {
    let resultado = await selecionarSetores(tabela, colunasCompletas);
    if (resultado.error && erroColunaInexistente(String((resultado.error as { message?: string }).message ?? ""))) {
      resultado = await selecionarSetores(tabela, colunasBasicas);
    }
    if (resultado.error) {
      const msg = String((resultado.error as { message?: string }).message ?? "");
      if (erroTabelaInexistente(msg)) continue;
      console.error("Erro ao carregar setores da tabela oficial:", resultado.error);
      return null;
    }
    if (resultado.linhas.length === 0) continue;

    const detalhes = mapearLinhasParaDetalhes(resultado.linhas);
    return {
      nomes: resultado.linhas.map((l) => l.name),
      detalhes,
    };
  }

  return null;
}

async function upsertLinhas(tabela: string, linhas: LinhaSetorPersistencia[]): Promise<unknown> {
  if (linhas.length === 0) return null;

  let payload: Record<string, unknown>[] = linhas.map((linha) => ({
    name: linha.name,
    status: linha.status,
    cargos: linha.cargos,
    description: linha.description,
    responsible: linha.responsible,
  }));

  for (let tentativa = 0; tentativa < 4; tentativa += 1) {
    const { error } = await supabase.from(tabela).upsert(payload, { onConflict: "name" });
    if (!error) return null;

    const msg = String(error.message ?? "");
    if (!erroColunaInexistente(msg)) return error;

    if (msg.includes("description")) {
      payload = payload.map(({ description: _d, ...rest }) => rest);
      continue;
    }
    if (msg.includes("responsible")) {
      payload = payload.map(({ responsible: _r, ...rest }) => rest);
      continue;
    }
    return error;
  }

  return new Error("Não foi possível persistir setores após remover colunas opcionais.");
}

async function removerSetores(tabela: string, nomes: string[]): Promise<unknown> {
  if (nomes.length === 0) return null;
  const { error } = await supabase.from(tabela).delete().in("name", nomes);
  return error ?? null;
}

export async function persistirSetoresGestaoNoSupabase(
  nomesAtuais: string[],
  detalhes: MapaDetalhesSetor,
): Promise<boolean> {
  for (const tabela of TABELAS_SETORES_CANDIDATAS) {
    const existentes = await selecionarSetores(tabela, "name");
    if (existentes.error) {
      const msg = String((existentes.error as { message?: string }).message ?? "");
      if (erroTabelaInexistente(msg)) continue;
      console.error("Erro ao listar setores para sincronização:", existentes.error);
      return false;
    }

    const nomesExistentes = existentes.linhas.map((l) => l.name);
    const plano = planejarSincronizacaoSetores(nomesAtuais, detalhes, nomesExistentes);

    const erroRemocao = await removerSetores(tabela, plano.nomesRemover);
    if (erroRemocao) {
      console.error("Erro ao remover setores:", erroRemocao);
      return false;
    }

    const erroUpsert = await upsertLinhas(tabela, plano.upserts);
    if (erroUpsert) {
      const msg = String((erroUpsert as { message?: string }).message ?? "");
      if (erroTabelaInexistente(msg)) continue;
      console.error("Erro ao persistir setores na tabela oficial:", erroUpsert);
      return false;
    }

    return true;
  }

  return false;
}
