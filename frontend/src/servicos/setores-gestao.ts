/**
 * Persistência da página Setores.
 * Tabela oficial: public.sectors (mesma fonte do cadastro em setores.ts).
 * public.setores (TABELAS_SUPABASE.SETORES) é fallback legado, somente se sectors não existir.
 */

import { TABELAS_SUPABASE } from "@/constantes/supabase";
import { supabase } from "@/servicos/supabase";

/** Tabela canônica — alinhada a obterSetoresAtivos(). */
export const TABELA_SETORES_OFICIAL = "sectors";

/** Fallback legado para instalações que ainda não migraram o nome físico. */
export const TABELA_SETORES_LEGADO = TABELAS_SUPABASE.SETORES;

export const TABELAS_SETORES_CANDIDATAS = [
  TABELA_SETORES_OFICIAL,
  TABELA_SETORES_LEGADO,
] as const;

export const AVISO_METADADOS_NAO_PERSISTIDOS =
  "Responsável não foi gravado no banco (coluna ausente). Status, cargos e nome foram salvos.";

export interface ResultadoPersistenciaSetoresGestao {
  sucesso: boolean;
  metadadosParciais?: boolean;
  erro?: unknown;
}

export interface SetorGestaoDetalhe {
  responsible?: string;
  status?: "Ativo" | "Inativo";
  cargos?: string[];
}

export type MapaDetalhesSetor = Record<string, SetorGestaoDetalhe>;

export interface LinhaSetorPersistencia {
  id?: string;
  name: string;
  status: "Ativo" | "Inativo";
  cargos: string[];
  responsible?: string;
}

export interface SetorExistenteBanco {
  id?: string;
  name: string;
}

export function planejarEscritaSetores(
  upserts: LinhaSetorPersistencia[],
  existentes: SetorExistenteBanco[],
): {
  atualizacoes: Array<{ id?: string; name: string; linha: LinhaSetorPersistencia }>;
  insercoes: LinhaSetorPersistencia[];
} {
  const porNome = new Map(
    existentes
      .filter((item) => item.name.trim())
      .map((item) => [item.name, item] as const),
  );
  const atualizacoes: Array<{ id?: string; name: string; linha: LinhaSetorPersistencia }> = [];
  const insercoes: LinhaSetorPersistencia[] = [];

  for (const linha of upserts) {
    const existente = porNome.get(linha.name);
    if (existente) {
      atualizacoes.push({ id: existente.id, name: existente.name, linha });
    } else {
      insercoes.push(linha);
    }
  }

  return { atualizacoes, insercoes };
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
  const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : undefined;
  return {
    id,
    name,
    status,
    cargos: cargos.length > 0 ? cargos : ["Colaborador"],
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
  const colunasCompletas = "id,name,status,cargos,responsible";
  const colunasBasicas = "id,name,status,cargos";

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

function montarPayloadLinha(linha: LinhaSetorPersistencia): Record<string, unknown> {
  return {
    name: linha.name,
    status: linha.status,
    cargos: linha.cargos,
    responsible: linha.responsible,
  };
}

function removerColunaOpcionalAusente(
  payload: Record<string, unknown>,
  mensagem: string,
): Record<string, unknown> | null {
  if (mensagem.includes("responsible") && "responsible" in payload) {
    const { responsible: _r, ...rest } = payload;
    return rest;
  }
  return null;
}

function payloadOmitiuMetadados(
  original: Record<string, unknown>,
  atual: Record<string, unknown>,
): boolean {
  const tinhaResponsavel =
    typeof original.responsible === "string" && original.responsible.trim() !== "";
  return tinhaResponsavel && !("responsible" in atual);
}

async function atualizarLinha(
  tabela: string,
  alvo: { id?: string; name: string },
  linha: LinhaSetorPersistencia,
): Promise<{ erro: unknown | null; metadadosParciais: boolean }> {
  const payloadInicial = montarPayloadLinha(linha);
  let payload = { ...payloadInicial };
  let metadadosParciais = false;

  for (let tentativa = 0; tentativa < 4; tentativa += 1) {
    let consulta = supabase.from(tabela).update(payload);
    consulta = alvo.id ? consulta.eq("id", alvo.id) : consulta.eq("name", alvo.name);
    const { data, error } = await consulta.select("id");

    if (!error) {
      if (!data || data.length === 0) {
        return {
          erro: new Error("Nenhuma linha de setor foi atualizada. Verifique permissões de UPDATE."),
          metadadosParciais,
        };
      }
      return { erro: null, metadadosParciais };
    }

    const msg = String(error.message ?? "");
    if (!erroColunaInexistente(msg)) return { erro: error, metadadosParciais };
    const reduzido = removerColunaOpcionalAusente(payload, msg);
    if (!reduzido) return { erro: error, metadadosParciais };
    if (payloadOmitiuMetadados(payloadInicial, reduzido)) metadadosParciais = true;
    payload = reduzido;
  }

  return {
    erro: new Error("Não foi possível atualizar o setor após remover colunas opcionais."),
    metadadosParciais,
  };
}

async function inserirLinhas(
  tabela: string,
  linhas: LinhaSetorPersistencia[],
): Promise<{ erro: unknown | null; metadadosParciais: boolean }> {
  if (linhas.length === 0) return { erro: null, metadadosParciais: false };

  const payloadsIniciais = linhas.map(montarPayloadLinha);
  let payload: Record<string, unknown>[] = payloadsIniciais.map((item) => ({ ...item }));
  let metadadosParciais = false;

  for (let tentativa = 0; tentativa < 4; tentativa += 1) {
    const { error } = await supabase.from(tabela).insert(payload);
    if (!error) {
      return { erro: null, metadadosParciais };
    }

    const msg = String(error.message ?? "");
    if (!erroColunaInexistente(msg)) return { erro: error, metadadosParciais };

    if (msg.includes("responsible")) {
      payload = payload.map((item, index) => {
        const reduzido = { ...item };
        delete reduzido.responsible;
        if (payloadOmitiuMetadados(payloadsIniciais[index], reduzido)) metadadosParciais = true;
        return reduzido;
      });
      continue;
    }
    return { erro: error, metadadosParciais };
  }

  return {
    erro: new Error("Não foi possível inserir setores após remover colunas opcionais."),
    metadadosParciais,
  };
}

async function removerSetores(tabela: string, nomes: string[]): Promise<unknown> {
  if (nomes.length === 0) return null;
  const { error } = await supabase.from(tabela).delete().in("name", nomes);
  return error ?? null;
}

export async function persistirSetoresGestaoNoSupabase(
  nomesAtuais: string[],
  detalhes: MapaDetalhesSetor,
): Promise<ResultadoPersistenciaSetoresGestao> {
  for (const tabela of TABELAS_SETORES_CANDIDATAS) {
    let existentes = await selecionarSetores(tabela, "id,name");
    if (existentes.error && erroColunaInexistente(String((existentes.error as { message?: string }).message ?? ""))) {
      existentes = await selecionarSetores(tabela, "name");
    }
    if (existentes.error) {
      const msg = String((existentes.error as { message?: string }).message ?? "");
      if (erroTabelaInexistente(msg)) continue;
      console.error("Erro ao listar setores para sincronização:", existentes.error);
      return { sucesso: false, erro: existentes.error };
    }

    const nomesExistentes = existentes.linhas.map((l) => l.name);
    const plano = planejarSincronizacaoSetores(nomesAtuais, detalhes, nomesExistentes);
    const escrita = planejarEscritaSetores(plano.upserts, existentes.linhas);
    let metadadosParciais = false;

    const erroRemocao = await removerSetores(tabela, plano.nomesRemover);
    if (erroRemocao) {
      console.error("Erro ao remover setores:", erroRemocao);
      return { sucesso: false, erro: erroRemocao };
    }

    for (const atualizacao of escrita.atualizacoes) {
      const resultadoUpdate = await atualizarLinha(tabela, atualizacao, atualizacao.linha);
      if (resultadoUpdate.metadadosParciais) metadadosParciais = true;
      if (resultadoUpdate.erro) {
        const msg = String((resultadoUpdate.erro as { message?: string }).message ?? resultadoUpdate.erro);
        if (erroTabelaInexistente(msg)) return { sucesso: false, erro: resultadoUpdate.erro };
        console.error("Erro ao atualizar setor na tabela oficial:", resultadoUpdate.erro);
        return { sucesso: false, erro: resultadoUpdate.erro };
      }
    }

    const resultadoInsert = await inserirLinhas(tabela, escrita.insercoes);
    if (resultadoInsert.metadadosParciais) metadadosParciais = true;
    if (resultadoInsert.erro) {
      const msg = String((resultadoInsert.erro as { message?: string }).message ?? "");
      if (erroTabelaInexistente(msg)) continue;
      console.error("Erro ao persistir setores na tabela oficial:", resultadoInsert.erro);
      return { sucesso: false, erro: resultadoInsert.erro };
    }

    return { sucesso: true, metadadosParciais: metadadosParciais || undefined };
  }

  return { sucesso: false };
}
