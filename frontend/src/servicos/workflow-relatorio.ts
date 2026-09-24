import { rotaDetalheWorkflow } from "@/constantes/api";
import { requisicaoApi } from "@/servicos/api";
import type { ApprovalWorkflow } from "@/tipos";
import { normalizarWorkflowAprovacao } from "@/utilitarios/workflows-aprovacao";

export async function obterWorkflowRelatorio(recordId: string): Promise<ApprovalWorkflow | null> {
  const response = await requisicaoApi(rotaDetalheWorkflow(recordId));
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || `Erro HTTP ${response.status}`);
  }

  return payload?.workflow ? normalizarWorkflowAprovacao(payload.workflow) : null;
}
