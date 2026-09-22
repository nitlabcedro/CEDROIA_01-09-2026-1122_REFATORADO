import { TABELAS_SUPABASE } from "../configuracoes/schema-supabase";
import { papelEhAdmin } from "../utilitarios/permissoes";
import type { Request, Response } from "express";

import { obterClienteSupabase } from "../configuracoes/supabase";
import {
  validarESerializarAtribuicoes,
  validarPayloadAtualizacaoAtribuicoes,
} from "../servicos/administracao-atribuicoes.servico";

export async function atualizarAtribuicoesUsuario(req: Request, res: Response) {
  try {
    const { userId, atribuicoes } = validarPayloadAtualizacaoAtribuicoes(req.body);
    const supabaseAdmin = obterClienteSupabase();

    const { data: perfilAlvo, error: perfilError } = await supabaseAdmin
      .from(TABELAS_SUPABASE.PERFIS)
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (perfilError) {
      return res.status(500).json({ error: perfilError.message });
    }
    if (!perfilAlvo) {
      return res.status(404).json({ error: "Usuário alvo não encontrado." });
    }

    const nomesSetores = atribuicoes.map(({ setor }) => setor);
    const { data: setores, error: setoresError } = await supabaseAdmin
      .from("sectors")
      .select("name,cargos,status")
      .in("name", nomesSetores);

    if (setoresError) {
      return res.status(500).json({ error: setoresError.message });
    }

    const serializadas = validarESerializarAtribuicoes(atribuicoes, setores || []);
    const { data: perfilAtualizado, error: updateError } = await supabaseAdmin
      .from(TABELAS_SUPABASE.PERFIS)
      .update({
        setor: serializadas.setor,
        cargo: serializadas.cargo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select("id,setor,cargo")
      .single();

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    return res.json({ success: true, profile: perfilAtualizado });
  } catch (erro) {
    return res.status(400).json({
      error: erro instanceof Error ? erro.message : "Payload inválido.",
    });
  }
}

export async function atualizarPapelUsuario(req: Request, res: Response) {
  const { userId, newRole } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const token = authHeader.replace("Bearer ", "");
    
    // Lazy initialized supabase client
    const supabase = obterClienteSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const { data: requesterProfile, error: profileError } = await supabase
      .from(TABELAS_SUPABASE.PERFIS)
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !papelEhAdmin(requesterProfile?.role)) {
      return res.status(403).json({ error: "Forbidden: You are not an admin" });
    }

    // Lazy initialized supabase admin client
    const supabaseAdmin = obterClienteSupabase();
    const { data, error: updateError } = await supabaseAdmin
      .from(TABELAS_SUPABASE.PERFIS)
      .update({ role: newRole })
      .eq("id", userId)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    return res.json({ success: true, profile: data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}

export async function excluirUsuario(req: Request, res: Response) {
  const { userId } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const token = authHeader.replace("Bearer ", "");
    const supabase = obterClienteSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) return res.status(401).json({ error: "Invalid token" });

    const { data: requester } = await supabase.from(TABELAS_SUPABASE.PERFIS).select("role").eq("id", user.id).single();
    if (!papelEhAdmin(requester?.role)) return res.status(403).json({ error: "Forbidden" });

    const supabaseAdmin = obterClienteSupabase();

    // 1. Limpar mensagens vinculadas
    await supabaseAdmin.from(TABELAS_SUPABASE.MENSAGENS).delete().eq("sender_id", userId);
    await supabaseAdmin.from(TABELAS_SUPABASE.MENSAGENS).delete().eq("recipient_id", userId);

    // 2. Limpar referências
    await supabaseAdmin.from(TABELAS_SUPABASE.REGISTROS_IA).update({ authorized_by: null }).eq("authorized_by", userId);
    await supabaseAdmin.from(TABELAS_SUPABASE.REGISTROS_IA).update({ owner_id: null }).eq("owner_id", userId);
    await supabaseAdmin.from(TABELAS_SUPABASE.PERFIS).update({ authorized_by: null }).eq("authorized_by", userId);

    // 3. Storage
    try {
      await supabaseAdmin.rpc("delete_user_storage_objects", { user_id: userId });
    } catch (e) {
      // @ts-ignore
      await supabaseAdmin.from(TABELAS_SUPABASE.OBJETOS_STORAGE).delete().eq("owner", userId).catch(() => {});
    }

    // 4. Deletar perfil
    const { error: profileDeleteError } = await supabaseAdmin.from(TABELAS_SUPABASE.PERFIS).delete().eq("id", userId);
    if (profileDeleteError) {
      return res.status(500).json({ error: `Erro ao apagar perfil: ${profileDeleteError.message}` });
    }

    // 5. Deletar do Auth
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authDeleteError) {
       return res.status(500).json({ 
         error: `Erro ao apagar conta no Auth: ${authDeleteError.message}`
       });
    }

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}