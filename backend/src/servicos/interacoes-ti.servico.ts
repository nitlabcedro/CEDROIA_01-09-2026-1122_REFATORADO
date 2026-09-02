import { RELACOES_SUPABASE, TABELAS_SUPABASE } from "../configuracoes/schema-supabase";
import { papelEhAdmin } from "../utilitarios/permissoes";
import type { Request, Response } from "express";

import { obterClienteSupabase } from "../configuracoes/supabase";

function mensagemTabelaAusente(error: any) {
  const texto = String(error?.message || error?.details || "").toLowerCase();
  return texto.includes(TABELAS_SUPABASE.SOLICITACOES_TI) || texto.includes(TABELAS_SUPABASE.PERGUNTAS_TI) || error?.code === "PGRST205";
}

async function obterUsuarioAutenticado(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader) throw new Error("UNAUTHORIZED");

  const token = authHeader.replace("Bearer ", "");
  const supabaseAdmin = obterClienteSupabase();
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) throw new Error("UNAUTHORIZED");

  const { data: profile } = await supabaseAdmin
    .from(TABELAS_SUPABASE.PERFIS)
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  return {
    user,
    role: profile?.role?.toLowerCase().trim() || "user",
    fullName: profile?.full_name || user.email || "Usuário",
  };
}

function formatarInteracao(row: any, nomeFerramenta?: string) {
  const perguntas = (row.questions || row.perguntas || [])
    .slice()
    .sort((a: any, b: any) => Number(a.order_number) - Number(b.order_number))
    .map((q: any) => ({
      id: q.id,
      solicitacaoId: q.request_id,
      ordem: Number(q.order_number),
      pergunta: q.question,
      resposta: q.answer || "",
      respondidaEm: q.answered_at || undefined,
      atualizadaEm: q.updated_at || undefined,
    }));

  return {
    id: row.id,
    workflowId: row.workflow_id,
    iaRecordId: row.ia_record_id,
    nomeFerramenta: nomeFerramenta || row.nome_ferramenta || undefined,
    numeroRodada: Number(row.round_number),
    solicitadoPorId: row.requested_by_id,
    solicitadoPorNome: row.requested_by_name,
    solicitanteId: row.requester_id,
    status: row.status,
    criadoEm: row.created_at,
    respondidoEm: row.responded_at || undefined,
    perguntas,
  };
}

async function registrarHistoricoTI(
  supabaseAdmin: any,
  recordId: string,
  entrada: { action: string; user: string; message: string },
) {
  const { data: iaRecord } = await supabaseAdmin
    .from(TABELAS_SUPABASE.REGISTROS_IA)
    .select("data")
    .eq("id", recordId)
    .maybeSingle();

  if (!iaRecord?.data) return;

  const agora = new Date().toISOString();
  const dataAtual = iaRecord.data as any;
  const atualizado = {
    ...dataAtual,
    updatedAt: agora,
    historico: [
      {
        date: agora,
        action: entrada.action,
        user: entrada.user,
        message: entrada.message,
      },
      ...(dataAtual.historico || []),
    ],
  };

  await supabaseAdmin
    .from(TABELAS_SUPABASE.REGISTROS_IA)
    .update({ data: atualizado, updated_at: agora })
    .eq("id", recordId);
}

async function obterInteracaoCompleta(supabaseAdmin: any, solicitacaoId: string) {
  const { data, error } = await supabaseAdmin
    .from(TABELAS_SUPABASE.SOLICITACOES_TI)
    .select(`*, ${RELACOES_SUPABASE.PERGUNTAS_TI}`)
    .eq("id", solicitacaoId)
    .single();

  if (error || !data) throw error || new Error("Solicitação de informações não encontrada.");

  const { data: registro } = await supabaseAdmin
    .from(TABELAS_SUPABASE.REGISTROS_IA)
    .select("nome_ferramenta, data")
    .eq("id", data.ia_record_id)
    .maybeSingle();

  const nomeFerramenta = registro?.nome_ferramenta || registro?.data?.nomeFerramenta;
  return formatarInteracao(data, nomeFerramenta);
}

async function validarResponsavelTI(supabaseAdmin: any, recordId: string, userId: string, role: string) {
  const { data: workflow, error: wfError } = await supabaseAdmin
    .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
    .select("id, current_step, final_status")
    .eq("ia_record_id", recordId)
    .maybeSingle();

  if (wfError || !workflow) {
    throw new Error("Workflow de aprovação não encontrado.");
  }
  if (workflow.final_status !== "pendente") {
    throw new Error("O fluxo desta IA já foi encerrado.");
  }
  if (Number(workflow.current_step) !== 2) {
    throw new Error("As perguntas ao solicitante só podem ser criadas durante a Etapa 2 — TI.");
  }

  const { data: step, error: stepError } = await supabaseAdmin
    .from(TABELAS_SUPABASE.ETAPAS_APROVACAO)
    .select("assigned_user_id, assigned_user_name")
    .eq("workflow_id", workflow.id)
    .eq("step_number", 2)
    .maybeSingle();

  if (stepError || !step) throw new Error("Etapa de TI não encontrada no workflow.");

  const permitido = papelEhAdmin(role) || step.assigned_user_id === userId;
  if (!permitido) {
    throw new Error("Apenas o responsável designado pela Etapa 2 — TI pode solicitar informações.");
  }

  return { workflow, step };
}

export async function listarInteracoesTI(req: Request, res: Response) {
  try {
    const { user, role } = await obterUsuarioAutenticado(req);
    const recordId = String(req.query.recordId || "").trim();
    if (!recordId) return res.status(400).json({ error: "recordId é obrigatório." });

    const supabaseAdmin = obterClienteSupabase();
    const { data: registro, error: recordError } = await supabaseAdmin
      .from(TABELAS_SUPABASE.REGISTROS_IA)
      .select("owner_id, nome_ferramenta, data")
      .eq("id", recordId)
      .maybeSingle();

    if (recordError || !registro) return res.status(404).json({ error: "Solicitação de IA não encontrada." });

    const { data: workflow } = await supabaseAdmin
      .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
      .select("id")
      .eq("ia_record_id", recordId)
      .maybeSingle();

    let podeVisualizar = registro.owner_id === user.id || papelEhAdmin(role);
    if (workflow) {
      const { data: stepTI } = await supabaseAdmin
        .from(TABELAS_SUPABASE.ETAPAS_APROVACAO)
        .select("assigned_user_id")
        .eq("workflow_id", workflow.id)
        .eq("step_number", 2)
        .maybeSingle();
      podeVisualizar = podeVisualizar || stepTI?.assigned_user_id === user.id;
    }

    if (!podeVisualizar) return res.status(403).json({ error: "Sem permissão para consultar estas interações." });

    const { data, error } = await supabaseAdmin
      .from(TABELAS_SUPABASE.SOLICITACOES_TI)
      .select(`*, ${RELACOES_SUPABASE.PERGUNTAS_TI}`)
      .eq("ia_record_id", recordId)
      .order("round_number", { ascending: true });

    if (error) {
      if (mensagemTabelaAusente(error)) {
        return res.status(503).json({ error: "Estrutura de perguntas da TI ainda não foi criada no Supabase. Execute documentacao/SUPABASE_TI_INTERACOES.sql." });
      }
      return res.status(500).json({ error: error.message });
    }

    const nomeFerramenta = registro.nome_ferramenta || registro.data?.nomeFerramenta;
    return res.json({ interactions: (data || []).map((row: any) => formatarInteracao(row, nomeFerramenta)) });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return res.status(401).json({ error: "Não autorizado." });
    return res.status(500).json({ error: error?.message || "Erro ao listar interações da TI." });
  }
}

export async function listarPendenciasSolicitanteTI(req: Request, res: Response) {
  try {
    const { user } = await obterUsuarioAutenticado(req);
    const supabaseAdmin = obterClienteSupabase();

    const { data, error } = await supabaseAdmin
      .from(TABELAS_SUPABASE.SOLICITACOES_TI)
      .select(`*, ${RELACOES_SUPABASE.PERGUNTAS_TI}`)
      .eq("requester_id", user.id)
      .eq("status", "aguardando_resposta")
      .order("created_at", { ascending: true });

    if (error) {
      if (mensagemTabelaAusente(error)) {
        return res.status(503).json({ error: "Estrutura de perguntas da TI ainda não foi criada no Supabase. Execute documentacao/SUPABASE_TI_INTERACOES.sql." });
      }
      return res.status(500).json({ error: error.message });
    }

    const workflowIds = [...new Set((data || []).map((row: any) => row.workflow_id))];
    const workflowsAtivos = new Set<string>();
    if (workflowIds.length > 0) {
      const { data: workflows } = await supabaseAdmin
        .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
        .select("id, current_step, final_status")
        .in("id", workflowIds);
      (workflows || []).forEach((workflow: any) => {
        if (workflow.final_status === "pendente" && Number(workflow.current_step) === 2) {
          workflowsAtivos.add(workflow.id);
        }
      });
    }

    const pendenciasAtivas = (data || []).filter((row: any) => workflowsAtivos.has(row.workflow_id));
    const ids = [...new Set(pendenciasAtivas.map((row: any) => row.ia_record_id))];
    const nomes = new Map<string, string>();
    if (ids.length > 0) {
      const { data: registros } = await supabaseAdmin
        .from(TABELAS_SUPABASE.REGISTROS_IA)
        .select("id, nome_ferramenta, data")
        .in("id", ids);
      (registros || []).forEach((r: any) => nomes.set(r.id, r.nome_ferramenta || r.data?.nomeFerramenta || r.id));
    }

    return res.json({
      interactions: pendenciasAtivas.map((row: any) => formatarInteracao(row, nomes.get(row.ia_record_id))),
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return res.status(401).json({ error: "Não autorizado." });
    return res.status(500).json({ error: error?.message || "Erro ao consultar pendências da TI." });
  }
}

export async function criarSolicitacaoInformacoesTI(req: Request, res: Response) {
  try {
    const { user, role, fullName } = await obterUsuarioAutenticado(req);
    const recordId = String(req.body?.recordId || "").trim();
    const perguntas = Array.isArray(req.body?.perguntas)
      ? req.body.perguntas.map((p: any) => String(p || "").trim()).filter(Boolean)
      : [];

    if (!recordId) return res.status(400).json({ error: "recordId é obrigatório." });
    if (perguntas.length === 0) return res.status(400).json({ error: "Adicione pelo menos uma pergunta." });
    if (perguntas.length > 20) return res.status(400).json({ error: "O limite é de 20 perguntas por rodada." });

    const supabaseAdmin = obterClienteSupabase();
    const { workflow } = await validarResponsavelTI(supabaseAdmin, recordId, user.id, role);

    const { data: registro, error: recordError } = await supabaseAdmin
      .from(TABELAS_SUPABASE.REGISTROS_IA)
      .select("owner_id, nome_ferramenta, data")
      .eq("id", recordId)
      .maybeSingle();

    if (recordError || !registro) return res.status(404).json({ error: "Solicitação de IA não encontrada." });
    const solicitanteId = registro.owner_id || registro.data?.ownerId;
    if (!solicitanteId) {
      return res.status(400).json({ error: "A solicitação não possui owner_id. Não é possível direcionar as perguntas ao usuário correto." });
    }

    const { data: pendente, error: pendingError } = await supabaseAdmin
      .from(TABELAS_SUPABASE.SOLICITACOES_TI)
      .select("id")
      .eq("workflow_id", workflow.id)
      .eq("status", "aguardando_resposta")
      .limit(1)
      .maybeSingle();

    if (pendingError && mensagemTabelaAusente(pendingError)) {
      return res.status(503).json({ error: "Estrutura de perguntas da TI ainda não foi criada no Supabase. Execute documentacao/SUPABASE_TI_INTERACOES.sql." });
    }
    if (pendente) return res.status(409).json({ error: "Já existe uma rodada aguardando resposta do solicitante." });

    const { data: ultimaRodada } = await supabaseAdmin
      .from(TABELAS_SUPABASE.SOLICITACOES_TI)
      .select("round_number")
      .eq("workflow_id", workflow.id)
      .order("round_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const numeroRodada = Number(ultimaRodada?.round_number || 0) + 1;
    const { data: solicitacao, error: insertError } = await supabaseAdmin
      .from(TABELAS_SUPABASE.SOLICITACOES_TI)
      .insert({
        workflow_id: workflow.id,
        ia_record_id: recordId,
        step_number: 2,
        round_number: numeroRodada,
        requested_by_id: user.id,
        requested_by_name: fullName,
        requester_id: solicitanteId,
        status: "aguardando_resposta",
      })
      .select("*")
      .single();

    if (insertError || !solicitacao) {
      if (mensagemTabelaAusente(insertError)) {
        return res.status(503).json({ error: "Estrutura de perguntas da TI ainda não foi criada no Supabase. Execute documentacao/SUPABASE_TI_INTERACOES.sql." });
      }
      return res.status(500).json({ error: insertError?.message || "Não foi possível criar a rodada de perguntas." });
    }

    const rowsPerguntas = perguntas.map((pergunta: string, index: number) => ({
      request_id: solicitacao.id,
      order_number: index + 1,
      question: pergunta,
      answer: null,
    }));
    const { error: questionsError } = await supabaseAdmin
      .from(TABELAS_SUPABASE.PERGUNTAS_TI)
      .insert(rowsPerguntas);

    if (questionsError) {
      await supabaseAdmin.from(TABELAS_SUPABASE.SOLICITACOES_TI).delete().eq("id", solicitacao.id);
      return res.status(500).json({ error: questionsError.message });
    }

    await registrarHistoricoTI(supabaseAdmin, recordId, {
      action: `TI solicitou informações adicionais — rodada ${numeroRodada}`,
      user: fullName,
      message: `${perguntas.length} pergunta(s) enviada(s) ao solicitante.`,
    });

    const interaction = await obterInteracaoCompleta(supabaseAdmin, solicitacao.id);
    return res.status(201).json({ success: true, interaction });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return res.status(401).json({ error: "Não autorizado." });
    const status = String(error?.message || "").includes("Apenas o responsável") ? 403 : 400;
    return res.status(status).json({ error: error?.message || "Erro ao solicitar informações." });
  }
}

export async function salvarRascunhoInformacoesTI(req: Request, res: Response) {
  try {
    const { user } = await obterUsuarioAutenticado(req);
    const solicitacaoId = String(req.params.id || "").trim();
    const respostas = Array.isArray(req.body?.respostas) ? req.body.respostas : [];
    const supabaseAdmin = obterClienteSupabase();

    const { data: solicitacao, error } = await supabaseAdmin
      .from(TABELAS_SUPABASE.SOLICITACOES_TI)
      .select("id, requester_id, status")
      .eq("id", solicitacaoId)
      .maybeSingle();

    if (error || !solicitacao) return res.status(404).json({ error: "Solicitação de informações não encontrada." });
    if (solicitacao.requester_id !== user.id) return res.status(403).json({ error: "Apenas o solicitante pode responder estas perguntas." });
    if (solicitacao.status !== "aguardando_resposta") return res.status(409).json({ error: "Esta rodada já foi enviada." });

    for (const item of respostas) {
      const perguntaId = String(item?.perguntaId || "").trim();
      if (!perguntaId) continue;
      const resposta = String(item?.resposta || "");
      const { error: updateError } = await supabaseAdmin
        .from(TABELAS_SUPABASE.PERGUNTAS_TI)
        .update({ answer: resposta, updated_at: new Date().toISOString() })
        .eq("id", perguntaId)
        .eq("request_id", solicitacaoId);
      if (updateError) return res.status(500).json({ error: updateError.message });
    }

    return res.json({ success: true });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return res.status(401).json({ error: "Não autorizado." });
    return res.status(500).json({ error: error?.message || "Erro ao salvar rascunho." });
  }
}

export async function enviarRespostasInformacoesTI(req: Request, res: Response) {
  try {
    const { user, fullName } = await obterUsuarioAutenticado(req);
    const solicitacaoId = String(req.params.id || "").trim();
    const respostas = Array.isArray(req.body?.respostas) ? req.body.respostas : [];
    const supabaseAdmin = obterClienteSupabase();

    const { data: solicitacao, error } = await supabaseAdmin
      .from(TABELAS_SUPABASE.SOLICITACOES_TI)
      .select("id, ia_record_id, requester_id, status, round_number")
      .eq("id", solicitacaoId)
      .maybeSingle();

    if (error || !solicitacao) return res.status(404).json({ error: "Solicitação de informações não encontrada." });
    if (solicitacao.requester_id !== user.id) return res.status(403).json({ error: "Apenas o solicitante pode enviar estas respostas." });
    if (solicitacao.status !== "aguardando_resposta") return res.status(409).json({ error: "Esta rodada já foi respondida." });

    for (const item of respostas) {
      const perguntaId = String(item?.perguntaId || "").trim();
      if (!perguntaId) continue;
      const resposta = String(item?.resposta || "");
      const { error: updateError } = await supabaseAdmin
        .from(TABELAS_SUPABASE.PERGUNTAS_TI)
        .update({ answer: resposta, updated_at: new Date().toISOString() })
        .eq("id", perguntaId)
        .eq("request_id", solicitacaoId);
      if (updateError) return res.status(500).json({ error: updateError.message });
    }

    const { data: perguntas, error: questionsError } = await supabaseAdmin
      .from(TABELAS_SUPABASE.PERGUNTAS_TI)
      .select("id, answer")
      .eq("request_id", solicitacaoId);

    if (questionsError) return res.status(500).json({ error: questionsError.message });
    const incompletas = (perguntas || []).filter((q: any) => !String(q.answer || "").trim());
    if (incompletas.length > 0) {
      return res.status(400).json({ error: "Responda todas as perguntas antes de enviar." });
    }

    const agora = new Date().toISOString();
    await supabaseAdmin
      .from(TABELAS_SUPABASE.PERGUNTAS_TI)
      .update({ answered_at: agora, updated_at: agora })
      .eq("request_id", solicitacaoId);

    const { error: requestUpdateError } = await supabaseAdmin
      .from(TABELAS_SUPABASE.SOLICITACOES_TI)
      .update({ status: "respondida", responded_at: agora })
      .eq("id", solicitacaoId);
    if (requestUpdateError) return res.status(500).json({ error: requestUpdateError.message });

    await registrarHistoricoTI(supabaseAdmin, solicitacao.ia_record_id, {
      action: `Solicitante respondeu às informações da TI — rodada ${solicitacao.round_number}`,
      user: fullName,
      message: `${(perguntas || []).length} resposta(s) enviada(s) para reanálise da TI.`,
    });

    const interaction = await obterInteracaoCompleta(supabaseAdmin, solicitacaoId);
    return res.json({ success: true, interaction });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return res.status(401).json({ error: "Não autorizado." });
    return res.status(500).json({ error: error?.message || "Erro ao enviar respostas." });
  }
}
