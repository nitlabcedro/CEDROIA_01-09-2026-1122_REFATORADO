import type { NextFunction, Response } from "express";

import { obterClienteSupabase } from "../configuracoes/supabase";
import type { RequisicaoAutenticada } from "../tipos/requisicao";

export async function autenticar(
  req: RequisicaoAutenticada,
  res: Response,
  next: NextFunction,
) {
  const cabecalho = req.headers.authorization;

  if (!cabecalho?.startsWith("Bearer ")) {
    return res.status(401).json({
      sucesso: false,
      mensagem: "Não autorizado: token ausente",
      error: "Unauthorized",
    });
  }

  try {
    const token = cabecalho.slice("Bearer ".length).trim();
    const { data, error } = await obterClienteSupabase().auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({
        sucesso: false,
        mensagem: "Token inválido ou expirado",
        error: "Invalid token",
      });
    }

    req.usuarioAutenticado = data.user;
    return next();
  } catch (erro) {
    return next(erro);
  }
}
