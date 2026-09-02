import { supabase } from "./supabase";

interface AmbienteFrontend {
  VITE_API_URL?: string;
}

const variaveisAmbiente = (import.meta as ImportMeta & { env: AmbienteFrontend }).env;
const URL_BASE_API = (variaveisAmbiente.VITE_API_URL || "").replace(/\/$/, "");

export async function requisicaoApi(
  rota: string,
  opcoes: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(opcoes.headers);

  if (!headers.has("Authorization")) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  if (opcoes.body && !(opcoes.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${URL_BASE_API}${rota}`, {
    ...opcoes,
    headers,
  });
}
