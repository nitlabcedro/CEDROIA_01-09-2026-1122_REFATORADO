import type { Request, Response } from "express";

import { obterClienteSupabase } from "../configuracoes/supabase";

const PADRAO_ID_REGISTRO = /^IA-\d{8}$/;

export async function gerarProximoIdRegistro(_req: Request, res: Response) {
  const { data, error } = await obterClienteSupabase().rpc("next_registros_ia_id");

  if (error || typeof data !== "string" || !PADRAO_ID_REGISTRO.test(data)) {
    return res.status(500).json({
      error: error?.message || "Não foi possível gerar o identificador da solicitação.",
    });
  }

  return res.json({ id: data });
}
