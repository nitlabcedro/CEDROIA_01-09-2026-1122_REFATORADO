import { ROTAS_API } from "@/constantes/api";
import { requisicaoApi } from "@/servicos/api";

const PADRAO_ID_REGISTRO = /^IA-\d{8}$/;

export function idRegistroIaValido(id: unknown): id is string {
  return typeof id === "string" && PADRAO_ID_REGISTRO.test(id);
}

export async function solicitarProximoIdRegistro(): Promise<string> {
  const response = await requisicaoApi(ROTAS_API.REGISTROS_PROXIMO_ID, {
    method: "POST",
  });
  const payload = await response.json().catch(() => null) as { id?: unknown; error?: string } | null;

  if (!response.ok || !idRegistroIaValido(payload?.id)) {
    throw new Error(payload?.error || "Não foi possível gerar o identificador da solicitação.");
  }

  return payload.id;
}
