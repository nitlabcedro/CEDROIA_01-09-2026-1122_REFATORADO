import { LIMITE_TEXTO_FLUXO_APROVACAO } from "@/constantes/fluxo-aprovacao";

/** Limita apenas nova digitação/edição — não usar para exibir dados já persistidos. */
export function limitarTextoEntradaFluxoAprovacao(valor: string): string {
  if (valor.length <= LIMITE_TEXTO_FLUXO_APROVACAO) return valor;
  return valor.slice(0, LIMITE_TEXTO_FLUXO_APROVACAO);
}

/**
 * Aplica o limite em campos editáveis sem cortar conteúdo legado já acima de 2000 caracteres.
 * Novas entradas ficam limitadas; legado só pode ser encurtado, não expandido além do que já tinha.
 */
export function aplicarLimiteEntradaFluxoAprovacao(anterior: string, novo: string): string {
  if (novo.length <= LIMITE_TEXTO_FLUXO_APROVACAO) return novo;
  if (anterior.length > LIMITE_TEXTO_FLUXO_APROVACAO) {
    if (novo.length <= anterior.length) return novo;
    return anterior;
  }
  return limitarTextoEntradaFluxoAprovacao(novo);
}

export function textoEntradaRespeitaLimiteFluxoAprovacao(valor: string): boolean {
  return valor.length <= LIMITE_TEXTO_FLUXO_APROVACAO;
}

export function textoEntradaExcedeLimiteFluxoAprovacao(valor: string): boolean {
  return valor.length > LIMITE_TEXTO_FLUXO_APROVACAO;
}

export function formatarContadorTextoFluxoAprovacao(comprimento: number): string {
  return `${comprimento} / ${LIMITE_TEXTO_FLUXO_APROVACAO}`;
}
