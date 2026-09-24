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

interface DependenciasRequisicaoApi {
  obterToken: typeof obterAccessTokenParaApi;
  fetch: typeof fetch;
  registrarFalha: typeof registrarFalhaAutenticacaoApi;
  urlBase?: string;
}

function lerBearer(headers: Headers): string | null {
  const cabecalho = headers.get("Authorization");
  if (!cabecalho?.startsWith("Bearer ")) return null;
  const token = cabecalho.slice("Bearer ".length).trim();
  return token || null;
}

export function criarRequisicaoApi({
  obterToken,
  fetch: executarFetchHttp,
  registrarFalha,
  urlBase = URL_BASE_API,
}: DependenciasRequisicaoApi) {
  return async function executarRequisicaoApi(
    rota: string,
    opcoes: RequestInit = {},
  ): Promise<Response> {
    const headers = new Headers(opcoes.headers);

    if (!headers.has("Authorization")) {
      const token = await obterToken();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    }

    if (opcoes.body && !(opcoes.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const executarFetch = () => executarFetchHttp(`${urlBase}${rota}`, {
      ...opcoes,
      headers,
    });

    const response = await executarFetch();

    if (response.status === 503) {
      return response;
    }

    if (response.status === 401 && !headers.get("X-Auth-Retry")) {
      const tokenUsado = lerBearer(headers);
      const tokenAtual = await obterToken();
      if (tokenAtual && tokenAtual !== tokenUsado) {
        headers.set("Authorization", `Bearer ${tokenAtual}`);
        headers.set("X-Auth-Retry", "1");
        const respostaRetry = await executarFetch();
        if (respostaRetry.status === 401) {
          registrarFalha();
        }
        return respostaRetry;
      }
    }

    if (response.status === 401) {
      registrarFalha();
    }

    return response;
  };
}

export const requisicaoApi = criarRequisicaoApi({
  obterToken: obterAccessTokenParaApi,
  // Resolva fetch no momento da chamada; isso preserva polyfills/mocks e não
  // captura uma implementação antiga durante a inicialização do módulo.
  fetch: (input, init) => fetch(input, init),
  registrarFalha: registrarFalhaAutenticacaoApi,
});
