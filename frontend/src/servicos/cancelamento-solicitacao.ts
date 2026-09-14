export interface OperacoesCancelamento {
  persistirWorkflowCancelado: () => Promise<void>;
  persistirRegistroCancelado: () => Promise<void>;
  restaurarWorkflow: () => Promise<void>;
}

/**
 * Mantém a confirmação do cancelamento condicionada à persistência das duas
 * partes. O workflow é atualizado primeiro; se o registro falhar, ele volta ao
 * estado anterior para não deixar um cancelamento parcial.
 */
export async function persistirCancelamentoCoerente({
  persistirWorkflowCancelado,
  persistirRegistroCancelado,
  restaurarWorkflow,
}: OperacoesCancelamento): Promise<void> {
  await persistirWorkflowCancelado();

  try {
    await persistirRegistroCancelado();
  } catch (erroRegistro) {
    try {
      await restaurarWorkflow();
    } catch (erroRestauracao) {
      console.error("Erro ao restaurar workflow após falha no cancelamento:", erroRestauracao);
    }
    throw erroRegistro;
  }
}
