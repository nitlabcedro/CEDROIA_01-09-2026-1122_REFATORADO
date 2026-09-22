const COLUNAS_PROTEGIDAS = new Set([
  "owner_id",
  "status_uso",
  "id",
  "unidade_setor",
  "data",
]);

const COLUNAS_LEGADAS_REMOVIVEIS = new Set([
  "responsavel_preenchimento",
  "nome_ferramenta",
  "updated_at",
]);

export interface ErroPostgrest {
  message?: string | null;
}

/** Retorna a coluna somente quando a mensagem afirma explicitamente que ela não existe. */
export function obterColunaInexistente(error: ErroPostgrest): string | null {
  const mensagem = String(error?.message || "");
  const padroes = [
    /column\s+(?:(?:["']?[\w-]+["']?)\.)?["']?([a-zA-Z_][\w-]*)["']?\s+does not exist/i,
    /could not find (?:the )?["']?([a-zA-Z_][\w-]*)["']?\s+column(?:\s+of\s+["']?[\w-]+["']?)?\s+in the schema cache/i,
    /could not find the column\s+["']?([a-zA-Z_][\w-]*)["']?/i,
  ];

  for (const padrao of padroes) {
    const match = mensagem.match(padrao);
    if (match) return match[1].toLowerCase();
  }
  return null;
}

/**
 * Compatibilidade só remove colunas legadas conhecidas. Campos estruturais
 * nunca são removidos, mesmo diante de erro explícito de schema.
 */
export function obterColunaLegadaRemovivel(
  error: ErroPostgrest,
  payload: Record<string, unknown>,
): string | null {
  const coluna = obterColunaInexistente(error);
  if (
    !coluna
    || COLUNAS_PROTEGIDAS.has(coluna)
    || !COLUNAS_LEGADAS_REMOVIVEIS.has(coluna)
    || !(coluna in payload)
  ) {
    return null;
  }
  return coluna;
}
