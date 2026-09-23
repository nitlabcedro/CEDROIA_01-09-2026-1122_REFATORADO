import type { UserProfile } from "@/tipos";

export interface AtribuicaoPerfil {
  setor: string;
  cargo: string;
}

export interface ContagemAtribuicoesPerfil {
  pares: number;
  setores: number;
  cargos: number;
}

export interface FonteAtribuicoesPerfil {
  setor?: string | null;
  cargo?: string | null;
}

function normalizarCampoAtribuicao(valor?: string | null): string {
  if (valor == null) return "";
  if (Array.isArray(valor)) {
    return valor.map((item) => String(item).trim()).filter(Boolean).join("; ");
  }
  return String(valor);
}

function separarValores(valor?: string | null): string[] {
  return normalizarCampoAtribuicao(valor)
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function obterSetoresVinculadosPerfil(setor?: string | null): string[] {
  return Array.from(new Set(separarValores(setor)));
}

export function obterAtribuicoesPerfil(
  setor?: string | null,
  cargo?: string | null,
): AtribuicaoPerfil[] {
  const setores = separarValores(setor);
  const cargos = separarValores(cargo);
  const quantidade = Math.max(setores.length, cargos.length);

  return Array.from({ length: quantidade }, (_, indice) => ({
    setor: setores[indice] || "",
    cargo: cargos[indice] || "",
  }));
}

export function obterCargoVinculadoAoSetor(
  setorSelecionado: string,
  setor?: string | null,
  cargo?: string | null,
): string {
  return obterAtribuicoesPerfil(setor, cargo)
    .find((atribuicao) => atribuicao.setor === setorSelecionado)?.cargo || "";
}

export function definirSetorInicialSolicitacao(
  setoresVinculados: string[],
  setorSalvo?: string | null,
): string {
  const salvo = setorSalvo?.trim();
  if (salvo) return salvo;
  return setoresVinculados.length === 1 ? setoresVinculados[0] : "";
}

export interface ContextoSetorSolicitacao {
  edicaoAdministrativa: boolean;
  setoresVinculados: string[];
  setoresAtivos?: string[];
  setorOriginal?: string | null;
}

const SETORES_SEM_DEFINICAO = ["não definido", "nao definido"];

/**
 * Criação: o solicitante só escolhe setores vinculados ao próprio perfil.
 * Edição administrativa: qualquer setor ativo, somado ao setor original do
 * registro (que pode não estar mais ativo nem pertencer ao administrador).
 */
export function resolverOpcoesSetorSolicitacao({
  edicaoAdministrativa,
  setoresVinculados,
  setoresAtivos = [],
  setorOriginal,
}: ContextoSetorSolicitacao): string[] {
  if (!edicaoAdministrativa) return [...setoresVinculados];

  const ativos = Array.from(
    new Set(setoresAtivos.map((setor) => setor.trim()).filter(Boolean)),
  );
  const original = setorOriginal?.trim();
  if (original && !ativos.includes(original)) return [original, ...ativos];
  return ativos;
}

export function setorSolicitacaoValido(
  setor: string | null | undefined,
  { edicaoAdministrativa, setoresVinculados }: ContextoSetorSolicitacao,
): boolean {
  const valor = (setor || "").trim();
  if (!valor || SETORES_SEM_DEFINICAO.includes(valor.toLowerCase())) return false;
  if (edicaoAdministrativa) return true;
  return setoresVinculados.includes(valor);
}

export interface FontePerfilSolicitacao {
  full_name?: string | null;
  setor?: string | null;
  cargo?: string | null;
}

/**
 * Criação: o solicitante precisa de nome, setor e cargo vinculados.
 * Edição administrativa: o perfil do admin não é requisito; os dados
 * relevantes já estão no registro.
 */
export function perfilImpedeEtapaSolicitacao({
  edicaoAdministrativa,
  profile,
}: {
  edicaoAdministrativa: boolean;
  profile?: FontePerfilSolicitacao | null;
}): boolean {
  if (edicaoAdministrativa) return false;
  if (!profile || !profile.full_name || profile.full_name.trim() === "") return true;
  const setoresVinculados = obterSetoresVinculadosPerfil(profile.setor);
  return setoresVinculados.length === 0 ||
    setoresVinculados.every((setor) => !obterCargoVinculadoAoSetor(
      setor,
      profile.setor,
      profile.cargo,
    ));
}

export function serializarAtribuicoesPerfil(atribuicoes: AtribuicaoPerfil[]): {
  setor: string;
  cargo: string;
} {
  const validas = atribuicoes.filter((item) => item.setor.trim() || item.cargo.trim());
  return {
    setor: validas.map((item) => item.setor.trim()).join("; "),
    cargo: validas.map((item) => item.cargo.trim()).join("; "),
  };
}

export function contarAtribuicoesPerfil(
  atribuicoes: AtribuicaoPerfil[],
): ContagemAtribuicoesPerfil {
  const setores = new Set(atribuicoes.map((item) => item.setor.trim()).filter(Boolean));
  const cargos = new Set(atribuicoes.map((item) => item.cargo.trim()).filter(Boolean));
  return {
    pares: atribuicoes.filter((item) => item.setor.trim() || item.cargo.trim()).length,
    setores: setores.size,
    cargos: cargos.size,
  };
}

export function resolverAtribuicoesPerfil(
  perfil?: FonteAtribuicoesPerfil | null,
  metadata?: FonteAtribuicoesPerfil | null,
): AtribuicaoPerfil[] {
  const doPerfil = obterAtribuicoesPerfil(perfil?.setor, perfil?.cargo);
  if (doPerfil.length > 0) return doPerfil;
  return obterAtribuicoesPerfil(metadata?.setor, metadata?.cargo);
}

export function mesclarAtualizacaoPerfil(
  atual: UserProfile | null,
  atualizacao: Partial<UserProfile>,
): UserProfile {
  if (!atual) return atualizacao as UserProfile;
  return {
    ...atual,
    ...atualizacao,
    setor: atualizacao.setor ?? atual.setor,
    cargo: atualizacao.cargo ?? atual.cargo,
  };
}

/**
 * Aplica o novo papel apenas ao perfil alvo, preservando os demais campos já
 * carregados (full_name, setor, cargo, avatar_url etc.).
 */
export function aplicarPapelNaListaPerfis(
  perfis: UserProfile[],
  userId: string,
  role: UserProfile["role"],
): UserProfile[] {
  return perfis.map((perfil) =>
    perfil.id === userId ? { ...perfil, role } : perfil,
  );
}

export function obterCargoPrincipal(cargo?: string | null): string {
  return separarValores(cargo)[0] || "";
}

export function obterSetorPrincipal(setor?: string | null): string {
  return separarValores(setor)[0] || "";
}

export function mesclarPerfilBuscado(
  anterior: UserProfile | null,
  dados: UserProfile,
): UserProfile {
  if (!anterior) return { ...dados };
  const keepBlob = anterior.avatar_url?.startsWith("blob:") ? anterior.avatar_url : null;
  return {
    ...anterior,
    ...dados,
    avatar_url: keepBlob || dados.avatar_url,
  };
}

export function obterRotuloNivelAcesso(role?: UserProfile["role"]): string {
  if (role === "admin") return "Administrador";
  if (role === "moderator") return "Moderador";
  return "Usuário";
}

export function obterRotuloStatusPerfil(status?: UserProfile["status"]): string {
  if (status === "Autorizado") return "Ativo";
  return status || "Pendente";
}
