import type { User } from "@supabase/supabase-js";
import type { NextFunction, Response } from "express";

import { obterClienteSupabase } from "../configuracoes/supabase";
import type { RequisicaoAutenticada } from "../tipos/requisicao";

const RESPOSTA_TOKEN_AUSENTE = {
  sucesso: false,
  mensagem: "Não autorizado: token ausente",
  error: "Unauthorized",
} as const;

const RESPOSTA_TOKEN_INVALIDO = {
  sucesso: false,
  mensagem: "Token inválido ou expirado",
  error: "Invalid token",
} as const;

const RESPOSTA_AUTH_INDISPONIVEL = {
  sucesso: false,
  mensagem: "Autenticação temporariamente indisponível",
  error: "Auth service unavailable",
} as const;

type ResultadoGetUser = {
  data: { user: User | null };
  error: unknown;
};

export type ConsultarUsuarioAuth = (token: string) => Promise<ResultadoGetUser>;

function lerStatusHttp(erro: object): number | undefined {
  const candidato = erro as { status?: unknown; statusCode?: unknown };
  if (typeof candidato.status === "number") return candidato.status;
  if (typeof candidato.statusCode === "number") return candidato.statusCode;
  return undefined;
}

function lerNomeErro(erro: object): string {
  return typeof (erro as { name?: unknown }).name === "string"
    ? (erro as { name: string }).name
    : "";
}

function lerCodigoErro(erro: object): string {
  const codigo = (erro as { code?: unknown }).code;
  return typeof codigo === "string" ? codigo : "";
}

export function falhaAuthETransitoria(error: unknown): boolean {
  if (!error || typeof error !== "object") return true;

  const nome = lerNomeErro(error);
  if (nome === "AuthRetryableFetchError") return true;

  const status = lerStatusHttp(error);
  if (status === 0) return true;
  if (status === 408 || status === 425 || status === 429) return true;
  if (status !== undefined && status >= 500 && status <= 599) return true;

  return false;
}

export function falhaAuthRejeitaToken(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if (falhaAuthETransitoria(error)) return false;

  const nome = lerNomeErro(error);
  const status = lerStatusHttp(error);
  const codigo = lerCodigoErro(error).toLowerCase();

  if (nome === "AuthInvalidJwtError") return true;
  if (status === 401 || status === 403) return true;
  if (
    nome === "AuthApiError"
    && (status === undefined || status === 400)
    && (
      codigo.includes("jwt")
      || codigo === "invalid_token"
      || codigo === "bad_jwt"
      || codigo === "session_not_found"
    )
  ) {
    return true;
  }

  return false;
}

export function classificarFalhaAuth(error: unknown): "token_invalido" | "indisponivel" {
  if (falhaAuthETransitoria(error)) return "indisponivel";
  if (falhaAuthRejeitaToken(error)) return "token_invalido";
  return "indisponivel";
}

export function criarMiddlewareAutenticar(consultarUsuario: ConsultarUsuarioAuth) {
  return async function autenticar(
    req: RequisicaoAutenticada,
    res: Response,
    next: NextFunction,
  ) {
    const cabecalho = req.headers.authorization;

    if (!cabecalho?.startsWith("Bearer ")) {
      return res.status(401).json(RESPOSTA_TOKEN_AUSENTE);
    }

    const token = cabecalho.slice("Bearer ".length).trim();
    if (!token) {
      return res.status(401).json(RESPOSTA_TOKEN_AUSENTE);
    }

    try {
      const { data, error } = await consultarUsuario(token);

      if (error) {
        if (classificarFalhaAuth(error) === "indisponivel") {
          return res.status(503).json(RESPOSTA_AUTH_INDISPONIVEL);
        }
        return res.status(401).json(RESPOSTA_TOKEN_INVALIDO);
      }

      if (!data.user) {
        return res.status(401).json(RESPOSTA_TOKEN_INVALIDO);
      }

      req.usuarioAutenticado = data.user;
      return next();
    } catch (erro) {
      if (classificarFalhaAuth(erro) === "token_invalido") {
        return res.status(401).json(RESPOSTA_TOKEN_INVALIDO);
      }
      return res.status(503).json(RESPOSTA_AUTH_INDISPONIVEL);
    }
  };
}

export const autenticar = criarMiddlewareAutenticar(
  (token) => obterClienteSupabase().auth.getUser(token),
);
