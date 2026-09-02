import { TABELAS_SUPABASE } from "../configuracoes/schema-supabase";
import { normalizarPapel } from "../utilitarios/permissoes";
import type { NextFunction, Response } from "express";

import { obterClienteSupabase } from "../configuracoes/supabase";
import type { RequisicaoAutenticada } from "../tipos/requisicao";

export function autorizarPapeis(...papeisPermitidos: string[]) {
  const papeisNormalizados = papeisPermitidos.map(normalizarPapel);

  return async (
    req: RequisicaoAutenticada,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.usuarioAutenticado) {
      return res.status(401).json({
        sucesso: false,
        mensagem: "Usuário não autenticado",
        error: "Unauthorized",
      });
    }

    try {
      const { data: perfil, error } = await obterClienteSupabase()
        .from(TABELAS_SUPABASE.PERFIS)
        .select("role")
        .eq("id", req.usuarioAutenticado.id)
        .single();

      const papel = normalizarPapel(perfil?.role);

      if (error || !papel || !papeisNormalizados.includes(papel)) {
        return res.status(403).json({
          sucesso: false,
          mensagem: "Usuário sem permissão para esta operação",
          error: "Forbidden",
        });
      }

      req.perfilAutenticado = perfil;
      return next();
    } catch (erro) {
      return next(erro);
    }
  };
}
