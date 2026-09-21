export interface SetorCadastro {
  name: string;
  cargos: string[];
  status: "Ativo";
}

export interface AtribuicaoCadastro {
  setor: string;
  cargo: string;
}

interface DadosMetadataCadastro extends AtribuicaoCadastro {
  fullName: string;
}

export function normalizarSetoresAtivos(dados: unknown): SetorCadastro[] {
  if (!Array.isArray(dados)) return [];

  return dados.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const registro = item as Record<string, unknown>;
    const name = typeof registro.name === "string" ? registro.name.trim() : "";
    if (!name || registro.status !== "Ativo" || !Array.isArray(registro.cargos)) return [];

    const cargos = Array.from(new Set(
      registro.cargos
        .filter((cargo): cargo is string => typeof cargo === "string")
        .map((cargo) => cargo.trim())
        .filter(Boolean),
    ));

    return [{ name, cargos, status: "Ativo" as const }];
  });
}

export function validarAtribuicaoCadastro(
  atribuicao: AtribuicaoCadastro,
  setores: SetorCadastro[],
): string | null {
  const setor = atribuicao.setor.trim();
  const cargo = atribuicao.cargo.trim();

  if (!setor) return "Selecione um setor.";
  if (!cargo) return "Selecione um cargo.";

  const setorAtivo = setores.find((item) => item.name === setor);
  if (!setorAtivo?.cargos.includes(cargo)) {
    return "O cargo selecionado não pertence ao setor informado.";
  }

  return null;
}

export function podeEnviarCadastro(
  atribuicao: AtribuicaoCadastro,
  setores: SetorCadastro[],
): boolean {
  return validarAtribuicaoCadastro(atribuicao, setores) === null;
}

export function manterCargoAoTrocarSetor(
  cargoAtual: string,
  novoSetor: string,
  setores: SetorCadastro[],
): string {
  const setorAtivo = setores.find((item) => item.name === novoSetor.trim());
  const cargo = cargoAtual.trim();
  return setorAtivo?.cargos.includes(cargo) ? cargo : "";
}

export function criarMetadataCadastro(
  dados: DadosMetadataCadastro,
  setores: SetorCadastro[],
): { full_name: string; setor: string; cargo: string } {
  const erroAtribuicao = validarAtribuicaoCadastro(dados, setores);
  if (erroAtribuicao) throw new Error(erroAtribuicao);

  return {
    full_name: dados.fullName.trim(),
    setor: dados.setor.trim(),
    cargo: dados.cargo.trim(),
  };
}
