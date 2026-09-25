export interface OpcaoMenuSuspensoBusca {
  value: string;
  label: string;
}

/** Remove acentos e caixa para que "patologica" encontre "Patológica". */
export function normalizarTextoBusca(valor: unknown): string {
  if (valor == null) return "";
  return String(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function filtrarOpcoesMenuSuspenso<T extends OpcaoMenuSuspensoBusca>(
  opcoes: T[],
  termo: string,
): T[] {
  const busca = normalizarTextoBusca(termo);
  if (!busca) return opcoes;

  const termos = busca.split(/\s+/).filter(Boolean);
  return opcoes.filter((opcao) => {
    const alvo = `${normalizarTextoBusca(opcao.label)} ${normalizarTextoBusca(opcao.value)}`;
    return termos.every((parte) => alvo.includes(parte));
  });
}

/**
 * Considera toque como seleção apenas quando o dedo praticamente não se moveu;
 * acima da tolerância o gesto é rolagem da lista.
 */
export function gestoEhToqueDeSelecao(
  inicio: { x: number; y: number } | null,
  fim: { x: number; y: number },
  tolerancia = 12,
): boolean {
  if (!inicio) return false;
  return (
    Math.abs(fim.x - inicio.x) <= tolerancia &&
    Math.abs(fim.y - inicio.y) <= tolerancia
  );
}
