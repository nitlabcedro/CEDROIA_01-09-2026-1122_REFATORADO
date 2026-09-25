import { obterAtribuicoesPerfil } from "./perfil-usuario";

export interface PerfilOcupanteSetor {
  id?: string;
  full_name?: string | null;
  setor?: string | null;
  cargo?: string | null;
}

export interface CargoComOcupantes {
  cargo: string;
  usuarios: string[];
}

export function textoMinusculoSeguro(valor: unknown): string {
  if (valor == null) return "";
  return String(valor).toLowerCase();
}

export function perfilPertenceAoSetor(
  perfil: PerfilOcupanteSetor,
  setor: string,
): boolean {
  const alvo = setor.trim().toLowerCase();
  if (!alvo) return false;

  return obterAtribuicoesPerfil(perfil.setor, perfil.cargo).some(
    (atribuicao) => atribuicao.setor.trim().toLowerCase() === alvo,
  );
}

export function cargoDoPerfilNoSetor(
  perfil: PerfilOcupanteSetor,
  setor: string,
): string {
  const alvo = setor.trim().toLowerCase();
  return obterAtribuicoesPerfil(perfil.setor, perfil.cargo)
    .find((atribuicao) => atribuicao.setor.trim().toLowerCase() === alvo)
    ?.cargo.trim() || "";
}

export function agruparOcupantesPorCargo(
  setor: string,
  cargosCatalogo: string[],
  perfis: PerfilOcupanteSetor[],
): CargoComOcupantes[] {
  const grupos = new Map<string, string[]>();

  const registrar = (cargo: string, nome: string) => {
    const titulo = cargo.trim() || "Cargo não informado";
    const ocupantes = grupos.get(titulo) ?? [];
    if (!ocupantes.includes(nome)) ocupantes.push(nome);
    grupos.set(titulo, ocupantes);
  };

  for (const cargo of cargosCatalogo) {
    const titulo = cargo.trim();
    if (titulo && !grupos.has(titulo)) grupos.set(titulo, []);
  }

  for (const perfil of perfis) {
    if (!perfilPertenceAoSetor(perfil, setor)) continue;
    const nome = (perfil.full_name || "").trim() || "Usuário sem nome";
    registrar(cargoDoPerfilNoSetor(perfil, setor), nome);
  }

  for (const ocupantes of grupos.values()) {
    ocupantes.sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  const catalogo = cargosCatalogo
    .map((cargo) => cargo.trim())
    .filter(Boolean)
    .map((cargo) => ({ cargo, usuarios: grupos.get(cargo) ?? [] }));

  const extras = [...grupos.entries()]
    .filter(([cargo]) => !catalogo.some((item) => item.cargo === cargo))
    .map(([cargo, usuarios]) => ({ cargo, usuarios }));

  return [...catalogo, ...extras];
}

export function setorCorrespondeBusca(
  termo: string,
  campos: Array<unknown>,
): boolean {
  const busca = textoMinusculoSeguro(termo).trim();
  if (!busca) return true;
  return campos.some((campo) => textoMinusculoSeguro(campo).includes(busca));
}
