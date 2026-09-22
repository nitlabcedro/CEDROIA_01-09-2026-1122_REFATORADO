export interface AtribuicaoAdministrativa {
  setor: string;
  cargo: string;
}

export interface SetorParaValidacao {
  name: string;
  cargos: unknown;
  status: string;
}

export interface PayloadAtualizacaoAtribuicoes {
  userId: string;
  atribuicoes: AtribuicaoAdministrativa[];
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function objetoSimples(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function validarChavesExatas(
  objeto: Record<string, unknown>,
  permitidas: readonly string[],
): void {
  const extras = Object.keys(objeto).filter((chave) => !permitidas.includes(chave));
  if (extras.length > 0) {
    throw new Error(`Campo não permitido: ${extras[0]}.`);
  }
}

export function validarPayloadAtualizacaoAtribuicoes(
  corpo: unknown,
): PayloadAtualizacaoAtribuicoes {
  if (!objetoSimples(corpo)) {
    throw new Error("Payload inválido.");
  }

  validarChavesExatas(corpo, ["userId", "atribuicoes"]);

  if (typeof corpo.userId !== "string" || !UUID.test(corpo.userId)) {
    throw new Error("Usuário alvo inválido.");
  }
  if (!Array.isArray(corpo.atribuicoes) || corpo.atribuicoes.length === 0) {
    throw new Error("Adicione pelo menos uma atribuição de setor e cargo.");
  }

  const atribuicoes = corpo.atribuicoes.map((valor) => {
    if (!objetoSimples(valor)) {
      throw new Error("Atribuição inválida.");
    }
    validarChavesExatas(valor, ["setor", "cargo"]);

    if (typeof valor.setor !== "string" || !valor.setor.trim()) {
      throw new Error("Setor é obrigatório.");
    }
    if (typeof valor.cargo !== "string" || !valor.cargo.trim()) {
      throw new Error("Cargo é obrigatório.");
    }

    return {
      setor: valor.setor.trim(),
      cargo: valor.cargo.trim(),
    };
  });

  const setoresNormalizados = atribuicoes.map(({ setor }) => setor.toLocaleLowerCase("pt-BR"));
  if (new Set(setoresNormalizados).size !== setoresNormalizados.length) {
    throw new Error("Não é permitido selecionar o mesmo setor mais de uma vez.");
  }

  return { userId: corpo.userId, atribuicoes };
}

export function validarESerializarAtribuicoes(
  atribuicoes: AtribuicaoAdministrativa[],
  setores: SetorParaValidacao[],
): { setor: string; cargo: string } {
  for (const atribuicao of atribuicoes) {
    const setor = setores.find((item) => item.name === atribuicao.setor);
    if (!setor) {
      throw new Error(`O setor "${atribuicao.setor}" não existe.`);
    }
    if (setor.status !== "Ativo") {
      throw new Error(`O setor "${atribuicao.setor}" não está ativo.`);
    }
    if (
      !Array.isArray(setor.cargos)
      || !setor.cargos.some((cargo) => cargo === atribuicao.cargo)
    ) {
      throw new Error(
        `O cargo "${atribuicao.cargo}" não pertence ao setor "${atribuicao.setor}".`,
      );
    }
  }

  return {
    setor: atribuicoes.map(({ setor }) => setor).join("; "),
    cargo: atribuicoes.map(({ cargo }) => cargo).join("; "),
  };
}
