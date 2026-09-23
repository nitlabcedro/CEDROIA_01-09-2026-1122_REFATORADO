import type { Response } from "express";

import { TABELAS_SUPABASE } from "../configuracoes/schema-supabase";
import { obterClienteSupabase } from "../configuracoes/supabase";
import type { RequisicaoAutenticada } from "../tipos/requisicao";

function garantirExclusao(
  resultado: { error?: { message?: string } | null },
  contexto: string,
) {
  if (resultado.error) {
    throw new Error(`${contexto}: ${resultado.error.message || "falha no banco de dados"}`);
  }
}

export async function excluirRegistroIa(
  req: RequisicaoAutenticada,
  res: Response,
) {
  const id = String(req.params.id || "").trim();
  if (!id) {
    return res.status(400).json({ error: "Identificador do registro é obrigatório." });
  }

  try {
    const supabaseAdmin = obterClienteSupabase();
    const { data: registro, error: erroRegistro } = await supabaseAdmin
      .from(TABELAS_SUPABASE.REGISTROS_IA)
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (erroRegistro) {
      return res.status(500).json({ error: erroRegistro.message });
    }
    if (!registro) {
      return res.status(404).json({ error: "Registro de IA não encontrado." });
    }

    const { data: fluxos, error: erroFluxos } = await supabaseAdmin
      .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
      .select("id")
      .eq("ia_record_id", id);
    garantirExclusao({ error: erroFluxos }, "Não foi possível localizar os fluxos de aprovação");

    const idsFluxos = (fluxos || []).map((fluxo) => fluxo.id);
    if (idsFluxos.length > 0) {
      const resultadoEtapas = await supabaseAdmin
        .from(TABELAS_SUPABASE.ETAPAS_APROVACAO)
        .delete()
        .in("workflow_id", idsFluxos);
      garantirExclusao(resultadoEtapas, "Não foi possível excluir as etapas de aprovação");

      const resultadoFluxos = await supabaseAdmin
        .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
        .delete()
        .in("id", idsFluxos);
      garantirExclusao(resultadoFluxos, "Não foi possível excluir os fluxos de aprovação");
    }

    const resultadoRegistro = await supabaseAdmin
      .from(TABELAS_SUPABASE.REGISTROS_IA)
      .delete()
      .eq("id", id);
    garantirExclusao(resultadoRegistro, "Não foi possível excluir o registro de IA");

    return res.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir registro de IA:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Não foi possível excluir o registro de IA.",
    });
  }
}
