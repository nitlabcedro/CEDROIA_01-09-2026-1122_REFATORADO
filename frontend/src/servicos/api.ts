import {
  obterAccessTokenParaApi,
  registrarFalhaAutenticacaoApi,
} from "@/servicos/autenticacao-api";

interface AmbienteFrontend {
  VITE_API_URL?: string;
}

const variaveisAmbiente =
  (import.meta as ImportMeta & { env?: AmbienteFrontend }).env || {};
const URL_BASE_API = (variaveisAmbiente.VITE_API_URL || "").replace(/\/$/, "");

export async function requisicaoApi(
  rota: string,
  opcoes: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(opcoes.headers);

  if (!headers.has("Authorization")) {
    const token = await obterAccessTokenParaApi();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  if (opcoes.body && !(opcoes.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const executarFetch = () => fetch(`${URL_BASE_API}${rota}`, {
    ...opcoes,
    headers,
  });

  let response = await executarFetch();

  if (response.status === 401 && !headers.get("X-Auth-Retry")) {
    const tokenRenovado = await obterAccessTokenParaApi({ forcarRenovacao: true });
    if (tokenRenovado) {
      headers.set("Authorization", `Bearer ${tokenRenovado}`);
      headers.set("X-Auth-Retry", "1");
      response = await executarFetch();
    }
  }

  if (response.status === 401) {
    registrarFalhaAutenticacaoApi();
  }

  return response;
}
