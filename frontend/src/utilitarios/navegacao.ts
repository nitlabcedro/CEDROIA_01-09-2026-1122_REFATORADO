import {
  ABA_POR_ROTA,
  ROTAS_POR_ABA,
  ROTA_REDEFINIR_SENHA,
  type AbaAplicacao,
} from "../constantes/navegacao";

const ORIGEM_PARSING = "https://cedro.local";

export interface OpcoesUrlNavegacao {
  registroId?: string | null;
}

export type ResultadoUrlNavegacao =
  | { tipo: "aba"; aba: AbaAplicacao; registroId?: string }
  | { tipo: "raiz" }
  | { tipo: "reset-password" }
  | { tipo: "invalida" };

function criarUrl(url: string): URL {
  return new URL(url, ORIGEM_PARSING);
}

function normalizarCaminho(pathname: string): string {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "") || "/";
}

export function criarUrlNavegacao(
  aba: AbaAplicacao,
  opcoes: OpcoesUrlNavegacao = {},
): string {
  const parametros = new URLSearchParams();
  const registroId = opcoes.registroId?.trim();

  if (registroId && (aba === "report" || aba === "new")) {
    parametros.set("id", registroId);
  }

  const busca = parametros.toString();
  return `${ROTAS_POR_ABA[aba]}${busca ? `?${busca}` : ""}`;
}

export function interpretarUrlNavegacao(
  pathnameOuUrl: string,
  search?: string,
): ResultadoUrlNavegacao {
  const url = criarUrl(pathnameOuUrl);
  const pathname = normalizarCaminho(url.pathname);
  const parametros = new URLSearchParams(search === undefined ? url.search : search);

  if (pathname === "/") return { tipo: "raiz" };
  if (pathname === ROTA_REDEFINIR_SENHA) return { tipo: "reset-password" };

  const aba = ABA_POR_ROTA[pathname];
  if (!aba) return { tipo: "invalida" };

  const registroId = parametros.get("id")?.trim();
  return registroId
    ? { tipo: "aba", aba, registroId }
    : { tipo: "aba", aba };
}

export function urlsNavegacaoIguais(urlAtual: string, urlDestino: string): boolean {
  const atual = criarUrl(urlAtual);
  const destino = criarUrl(urlDestino);

  return (
    normalizarCaminho(atual.pathname) === normalizarCaminho(destino.pathname)
    && atual.search === destino.search
  );
}
