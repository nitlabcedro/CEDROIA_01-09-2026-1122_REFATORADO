import { RELACOES_SUPABASE, TABELAS_SUPABASE } from "../configuracoes/schema-supabase";
import { ETAPAS_PADRAO_APROVACAO } from "../configuracoes/fluxo-aprovacao";
import type { Request, Response } from "express";

import { obterClienteSupabase } from "../configuracoes/supabase";
import {
  chamarRpcDecidirEtapaTI,
  estruturaChatAusente,
  mapearErroRpcInteracaoTI,
} from "./interacoes-ti.servico";
import {
  autorizarCancelamento,
  estadoFinalImpedeCancelamento,
  montarDadosRegistroCancelado,
  STATUS_USO_CANCELADA,
} from "./cancelamento-solicitacao.regras";
import type { RequisicaoAutenticada } from "../tipos/requisicao";

function configuracaoSegueFluxoOficial(rows: any[] | null | undefined) {
  return rows?.length === ETAPAS_PADRAO_APROVACAO.length && ETAPAS_PADRAO_APROVACAO.every(
    (stepDef) => rows.some(
      (row: any) => Number(row.step_number) === stepDef.step_number && row.role_name === stepDef.role_name
        && Boolean(row.is_opinion_only) === stepDef.is_opinion_only
    )
  );
}

function obterEtapasOficiaisComResponsaveis(rows: any[] | null | undefined) {
  return ETAPAS_PADRAO_APROVACAO.map((stepDef) => {
    const configuredStep = rows?.find((row: any) => Number(row.step_number) === stepDef.step_number)
      || rows?.find((row: any) => row.role_name === stepDef.role_name);

    return {
      ...stepDef,
      assigned_user_id: configuredStep?.assigned_user_id || null,
      assigned_user_name: configuredStep?.assigned_user_name || null,
    };
  });
}

export function filtrarWorkflowsVisiveis(
  workflows: any[],
  etapasAtribuidas: number[],
) {
  const etapas = new Set(etapasAtribuidas.map(Number));
  const possuiAcompanhamentoGlobal = etapas.has(1) || etapas.has(2);

  return workflows.filter((workflow) => {
    if (workflow.final_status !== "pendente") return false;
    if (possuiAcompanhamentoGlobal) {
      return Number(workflow.current_step) >= 1 && Number(workflow.current_step) <= 5;
    }
    return etapas.has(Number(workflow.current_step));
  });
}

export function usuarioPodeVisualizarResumoWorkflow(params: {
  userId: string;
  role?: string | null;
  setores?: string | null;
  registro: {
    owner_id?: string | null;
    unidade_setor?: string | null;
  };
}) {
  const role = String(params.role || "").toLowerCase().trim();
  if (role === "admin" || role === "moderator") return true;
  if (params.registro.owner_id === params.userId) return true;

  const setores = String(params.setores || "")
    .split(";")
    .map((setor) => setor.trim().toLowerCase())
    .filter(Boolean);
  const setorRegistro = String(params.registro.unidade_setor || "").trim().toLowerCase();
  return Boolean(setorRegistro && setores.includes(setorRegistro));
}

export function montarResumoWorkflow(workflow: any) {
  return {
    ia_record_id: workflow.ia_record_id,
    current_step: Number(workflow.current_step),
    final_status: workflow.final_status,
    steps: Array.isArray(workflow.steps)
      ? workflow.steps.map((step: any) => ({
          step_number: Number(step.step_number),
          status: step.status,
        }))
      : [],
  };
}

export function usuarioPodeInicializarWorkflow(userId: string, ownerId: string | null | undefined) {
  return Boolean(userId && ownerId && userId === ownerId);
}

export function papelPodeRedefinirWorkflow(role: string | null | undefined) {
  return String(role || "").toLowerCase().trim() === "admin";
}

export function validarAutorizacaoDecisao(params: {
  userId: string;
  requestedStep: number;
  workflow: { current_step: number; final_status: string };
  step: { status?: string | null; assigned_user_id?: string | null };
}) {
  if (params.workflow.final_status !== "pendente") {
    return { permitido: false, status: 409, mensagem: "O workflow já foi encerrado." };
  }
  if (Number(params.workflow.current_step) !== Number(params.requestedStep)) {
    return { permitido: false, status: 409, mensagem: "A etapa informada não é a etapa atual do workflow." };
  }
  if (params.step.status !== "aguardando") {
    return { permitido: false, status: 409, mensagem: "A etapa atual não está aguardando decisão." };
  }
  if (!params.step.assigned_user_id) {
    return {
      permitido: false,
      status: 409,
      mensagem: "A etapa atual não possui responsável. Um administrador deve corrigir a configuração do fluxo.",
    };
  }
  if (params.step.assigned_user_id !== params.userId) {
    return { permitido: false, status: 403, mensagem: "Apenas o responsável designado para a etapa atual pode decidir." };
  }
  return { permitido: true, status: 200, mensagem: "" };
}

export function calcularResultadoDecisaoWorkflow(params: {
  decision: "aprovado" | "negado";
  currentStep: number;
  maxStep: number;
  isOpinionOnly?: boolean | null;
}) {
  void params.isOpinionOnly;

  if (params.decision === "negado") {
    return {
      stepStatus: "negado" as const,
      finalStatus: "negado" as const,
      statusAuditoria: "Negado",
      statusUso: "Não aprovado",
      nextStep: null as number | null,
      completed: true,
    };
  }

  if (params.currentStep === params.maxStep) {
    return {
      stepStatus: "aprovado" as const,
      finalStatus: "aprovado" as const,
      statusAuditoria: "Aprovado",
      statusUso: "Aprovado",
      nextStep: null,
      completed: true,
    };
  }

  const nextStep = params.currentStep + 1;
  return {
    stepStatus: "aprovado" as const,
    finalStatus: "pendente" as const,
    statusAuditoria: "Pendente",
    statusUso: nextStep >= 3 ? "Em teste/piloto" : "Em avaliação",
    nextStep,
    completed: false,
  };
}

export function garantirGravacaoSupabase(
  resultado: { error?: { message?: string } | null; data?: unknown[] | null },
  contexto: string,
  exigirLinhaAtualizada = false,
) {
  if (resultado?.error) {
    throw new Error(`${contexto}: ${resultado.error.message || "Falha ao gravar no banco."}`);
  }
  if (exigirLinhaAtualizada && (!resultado.data || resultado.data.length === 0)) {
    throw new Error(`${contexto}: nenhuma linha foi atualizada no banco.`);
  }
}

export async function obterConfiguracaoWorkflow(req: Request, res: Response) {
  try {
    const supabaseAdmin = obterClienteSupabase();
    const { data: configData, error } = await supabaseAdmin
      .from(TABELAS_SUPABASE.CONFIGURACAO_APROVACAO)
      .select("*")
      .order("step_number");
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!configuracaoSegueFluxoOficial(configData)) {
      res.setHeader("X-Workflow-Config-Inconsistent", "true");
      return res.json(obterEtapasOficiaisComResponsaveis(configData));
    }

    return res.json(configData || []);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}

export async function salvarConfiguracaoWorkflow(req: Request, res: Response) {
  try {
    const supabaseAdmin = obterClienteSupabase();
    const steps = Array.isArray(req.body?.steps) ? req.body.steps : [];

    if (steps.length !== ETAPAS_PADRAO_APROVACAO.length) {
      return res.status(400).json({
        error: "A configuração do fluxo deve conter exatamente as 5 etapas oficiais.",
      });
    }

    const normalizedSteps = ETAPAS_PADRAO_APROVACAO.map((stepDef) => {
      const incoming = steps.find((step: any) => Number(step.stepNumber ?? step.step_number) === stepDef.step_number);
      if (!incoming) {
        throw new Error(`Etapa ${stepDef.step_number} ausente na configuração.`);
      }

      return {
        step_number: stepDef.step_number,
        role_name: stepDef.role_name,
        is_opinion_only: stepDef.is_opinion_only,
        assigned_user_id: incoming.userId ?? incoming.assigned_user_id ?? null,
        assigned_user_name: incoming.userName ?? incoming.assigned_user_name ?? null,
      };
    });

    const assignedIds = [...new Set(
      normalizedSteps
        .map((step) => step.assigned_user_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )];

    if (assignedIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from(TABELAS_SUPABASE.PERFIS)
        .select("id, full_name")
        .in("id", assignedIds);

      if (profilesError) {
        return res.status(500).json({ error: profilesError.message });
      }

      const profileMap = new Map((profiles || []).map((profile: any) => [profile.id, profile]));
      for (const step of normalizedSteps) {
        if (!step.assigned_user_id) continue;
        const selectedProfile = profileMap.get(step.assigned_user_id);
        if (!selectedProfile) {
          return res.status(400).json({
            error: `A conta definida para a etapa ${step.step_number} não foi encontrada.`,
          });
        }
        step.assigned_user_name = selectedProfile.full_name || step.assigned_user_name;
      }
    }

    const now = new Date().toISOString();
    const updatedBy = (req as any).usuarioAutenticado?.id || null;

    const { error: configError } = await supabaseAdmin
      .from(TABELAS_SUPABASE.CONFIGURACAO_APROVACAO)
      .upsert(
        normalizedSteps.map((step) => ({
          ...step,
          updated_at: now,
          updated_by: updatedBy,
        })),
        { onConflict: "step_number" }
      );

    if (configError) {
      return res.status(500).json({ error: configError.message });
    }

    // A configuração é global e persistente. Quando um administrador a altera,
    // os fluxos ainda ativos passam a apontar para os novos responsáveis.
    // Status, pareceres e decisões já registradas não são modificados.
    const { data: activeWfs, error: activeWfsError } = await supabaseAdmin
      .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
      .select("id")
      .eq("final_status", "pendente");

    if (activeWfsError) {
      return res.status(500).json({ error: activeWfsError.message });
    }

    const activeWfIds = (activeWfs || []).map((wf: any) => wf.id).filter(Boolean);
    if (activeWfIds.length > 0) {
      for (const step of normalizedSteps) {
        const { error: stepUpdateError } = await supabaseAdmin
          .from(TABELAS_SUPABASE.ETAPAS_APROVACAO)
          .update({
            role_name: step.role_name,
            assigned_user_id: step.assigned_user_id,
            assigned_user_name: step.assigned_user_name,
            is_opinion_only: step.is_opinion_only,
          })
          .in("workflow_id", activeWfIds)
          .eq("step_number", step.step_number)
          .eq("status", "aguardando");

        if (stepUpdateError) {
          return res.status(500).json({
            error: `A configuração foi salva, mas não foi possível atualizar a etapa ${step.step_number} dos fluxos ativos: ${stepUpdateError.message}`,
          });
        }
      }
    }

    const { data: savedConfig, error: readError } = await supabaseAdmin
      .from(TABELAS_SUPABASE.CONFIGURACAO_APROVACAO)
      .select("*")
      .order("step_number");

    if (readError) {
      return res.status(500).json({ error: readError.message });
    }

    return res.json(savedConfig || []);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || "Não foi possível salvar a configuração do fluxo." });
  }
}

export async function listarWorkflows(req: RequisicaoAutenticada, res: Response) {
  try {
    const userId = req.usuarioAutenticado?.id;
    if (!userId) return res.status(401).json({ error: "Não autorizado." });

    const supabaseAdmin = obterClienteSupabase();
    const { data: configuracoes, error: configError } = await supabaseAdmin
      .from(TABELAS_SUPABASE.CONFIGURACAO_APROVACAO)
      .select("step_number")
      .eq("assigned_user_id", userId);

    if (configError) return res.status(500).json({ error: configError.message });

    const etapasAtribuidas = (configuracoes || []).map((item: any) => Number(item.step_number));
    if (etapasAtribuidas.length === 0) return res.json([]);

    const { data: wfData, error } = await supabaseAdmin
      .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
      .select(`*, ${RELACOES_SUPABASE.ETAPAS_DO_FLUXO}`)
      .eq("final_status", "pendente");
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.json(filtrarWorkflowsVisiveis(wfData || [], etapasAtribuidas));
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}

export async function resumirWorkflowsVisiveis(req: RequisicaoAutenticada, res: Response) {
  try {
    const userId = req.usuarioAutenticado?.id;
    if (!userId) return res.status(401).json({ error: "Não autorizado." });

    const supabaseAdmin = obterClienteSupabase();
    const { data: perfil, error: perfilError } = await supabaseAdmin
      .from(TABELAS_SUPABASE.PERFIS)
      .select("role, setor")
      .eq("id", userId)
      .maybeSingle();

    if (perfilError) return res.status(500).json({ error: perfilError.message });

    const { data: registros, error: registrosError } = await supabaseAdmin
      .from(TABELAS_SUPABASE.REGISTROS_IA)
      .select("id, owner_id, unidade_setor");

    if (registrosError) return res.status(500).json({ error: registrosError.message });

    const idsVisiveis = (registros || [])
      .filter((registro: any) => usuarioPodeVisualizarResumoWorkflow({
        userId,
        role: perfil?.role,
        setores: perfil?.setor,
        registro,
      }))
      .map((registro: any) => registro.id)
      .filter(Boolean);

    if (idsVisiveis.length === 0) return res.json([]);

    const { data: workflows, error: workflowsError } = await supabaseAdmin
      .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
      .select(`ia_record_id, current_step, final_status, steps:${TABELAS_SUPABASE.ETAPAS_APROVACAO}(step_number,status)`)
      .in("ia_record_id", idsVisiveis);

    if (workflowsError) return res.status(500).json({ error: workflowsError.message });
    return res.json((workflows || []).map(montarResumoWorkflow));
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Não foi possível carregar o resumo dos workflows." });
  }
}

export async function obterWorkflowVisivel(req: RequisicaoAutenticada, res: Response) {
  try {
    const userId = req.usuarioAutenticado?.id;
    const recordId = typeof req.params?.recordId === "string" ? req.params.recordId.trim() : "";
    if (!userId) return res.status(401).json({ error: "Não autorizado." });
    if (!recordId) return res.status(400).json({ error: "Identificador da solicitação ausente." });

    const supabaseAdmin = obterClienteSupabase();
    const [{ data: perfil, error: perfilError }, { data: registro, error: registroError }] = await Promise.all([
      supabaseAdmin
        .from(TABELAS_SUPABASE.PERFIS)
        .select("role, setor")
        .eq("id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from(TABELAS_SUPABASE.REGISTROS_IA)
        .select("id, owner_id, unidade_setor")
        .eq("id", recordId)
        .maybeSingle(),
    ]);

    if (perfilError) return res.status(500).json({ error: perfilError.message });
    if (registroError) return res.status(500).json({ error: registroError.message });
    if (!registro) return res.status(404).json({ error: "Registro de IA não encontrado." });
    if (!usuarioPodeVisualizarResumoWorkflow({
      userId,
      role: perfil?.role,
      setores: perfil?.setor,
      registro,
    })) {
      return res.status(403).json({ error: "Você não possui acesso a esta solicitação." });
    }

    const { data: workflow, error: workflowError } = await supabaseAdmin
      .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
      .select(`*, ${RELACOES_SUPABASE.ETAPAS_DO_FLUXO}`)
      .eq("ia_record_id", recordId)
      .maybeSingle();

    if (workflowError) return res.status(500).json({ error: workflowError.message });
    return res.json({ workflow: workflow || null });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Não foi possível carregar o workflow da solicitação." });
  }
}

export async function inicializarWorkflow(req: RequisicaoAutenticada, res: Response) {
  const recordId = typeof req.body?.recordId === "string" ? req.body.recordId.trim() : "";
  const user = req.usuarioAutenticado;

  if (!user?.id) return res.status(401).json({ error: "Não autorizado." });
  if (!recordId) return res.status(400).json({ error: "Identificador da solicitação ausente." });

  try {
    const supabaseAdmin = obterClienteSupabase();

    const { data: registro, error: registroError } = await supabaseAdmin
      .from(TABELAS_SUPABASE.REGISTROS_IA)
      .select("id, owner_id, data")
      .eq("id", recordId)
      .maybeSingle();

    if (registroError) return res.status(500).json({ error: registroError.message });
    if (!registro) return res.status(404).json({ error: "Registro de IA não encontrado." });
    if (!usuarioPodeInicializarWorkflow(user.id, registro.owner_id)) {
      return res.status(403).json({ error: "Apenas o solicitante proprietário pode inicializar este workflow." });
    }

    // 2. Buscar workflow da IA
    let wfData = null;
    const { data: existingWf } = await supabaseAdmin
      .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
      .select("id, current_step, final_status")
      .eq("ia_record_id", recordId)
      .maybeSingle();

    if (existingWf) {
      wfData = existingWf;
      // 3. Se já existe o workflow, verificar se existem etapas no approval_steps
      const { data: existingSteps } = await supabaseAdmin
        .from(TABELAS_SUPABASE.ETAPAS_APROVACAO)
        .select("id")
        .eq("workflow_id", existingWf.id);

      if (existingSteps && existingSteps.length > 0) {
        await garantirEtapasWorkflowSincronizadas(supabaseAdmin, existingWf, recordId);
        return res.json({ success: true, alreadyExists: true, workflowId: existingWf.id });
      }
    } else {
      // Criar entrada no approval_workflows
      const { data: newWf, error: newWfErr } = await supabaseAdmin
        .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
        .insert({
          ia_record_id: recordId,
          current_step: 1,
          final_status: "pendente",
        })
        .select("id, current_step, final_status")
        .single();

      if (newWfErr || !newWf) {
        return res.status(500).json({ error: `Não foi possível inicializar o fluxo de aprovação para esta IA: ${newWfErr?.message || "Erro desconhecido"}` });
      }
      wfData = newWf;
    }

    // 4. Buscar configuração atual salva pelo administrador na tela "Configurar Fluxo"
    const { data: configRows } = await supabaseAdmin
      .from(TABELAS_SUPABASE.CONFIGURACAO_APROVACAO)
      .select("*")
      .order("step_number");

    const stepsToInsert = obterEtapasOficiaisComResponsaveis(configRows)
      .map((c) => ({
          workflow_id: wfData.id,
          ia_record_id: recordId,
          step_number: c.step_number,
          role_name: c.role_name,
          assigned_user_id: c.assigned_user_id || null,
          assigned_user_name: c.assigned_user_name || null,
          status: "aguardando",
          comment: null,
          is_opinion_only: c.is_opinion_only,
          decided_at: null,
        }));

    const { error: stepsInsertErr } = await supabaseAdmin
      .from(TABELAS_SUPABASE.ETAPAS_APROVACAO)
      .insert(stepsToInsert);

    if (stepsInsertErr) {
      console.error("Erro ao inserir etapas do fluxo:", stepsInsertErr);
      return res.status(500).json({ error: `Erro ao salvar as etapas do fluxo: ${stepsInsertErr.message}` });
    }

    // 5. Atualizar status_uso da IA para "Em avaliação" no início do workflow
    if (registro.data) {
      const recordData = registro.data as any;
      const updatedData = {
        ...recordData,
        statusUso: "Em avaliação",
      };

      const { error: registroInitError } = await supabaseAdmin
        .from(TABELAS_SUPABASE.REGISTROS_IA)
        .update({
          data: updatedData,
          status_uso: "Em avaliação",
          updated_at: new Date().toISOString()
        })
        .eq("id", recordId);
      garantirGravacaoSupabase({ error: registroInitError }, "Não foi possível atualizar o registro da solicitação");
    }

    return res.json({ success: true, workflowId: wfData.id });

  } catch (err: any) {
    console.error("Erro no workflow/init:", err);
    return res.status(500).json({ error: err.message || "Erro interno" });
  }
}

async function garantirEtapasWorkflowSincronizadas(supabaseAdmin: any, wfData: any, recordId: string) {
  try {
    const { data: existingSteps } = await supabaseAdmin
      .from(TABELAS_SUPABASE.ETAPAS_APROVACAO)
      .select("*")
      .eq("workflow_id", wfData.id);

    if (wfData.final_status !== "pendente") {
      return existingSteps || [];
    }

    const { data: configRows } = await supabaseAdmin
      .from(TABELAS_SUPABASE.CONFIGURACAO_APROVACAO)
      .select("*")
      .order("step_number");

    const templateSteps = obterEtapasOficiaisComResponsaveis(configRows);

    if (!configuracaoSegueFluxoOficial(existingSteps)) {
      const synchronizedSteps = templateSteps.map((templateStep) => {
        // step_number is the stable identity of a workflow stage. Role labels may change for display.
        const existingMatch = existingSteps?.find(
          (step: any) => Number(step.step_number) === templateStep.step_number
        );

        return {
          workflow_id: wfData.id,
          ia_record_id: recordId,
          step_number: templateStep.step_number,
          role_name: templateStep.role_name,
          assigned_user_id: existingMatch?.assigned_user_id || templateStep.assigned_user_id,
          assigned_user_name: existingMatch?.assigned_user_name || templateStep.assigned_user_name,
          status: existingMatch?.status || "aguardando",
          comment: existingMatch?.comment || null,
          is_opinion_only: templateStep.is_opinion_only,
          decided_at: existingMatch?.decided_at || null,
        };
      });

      const { error: deleteError } = await supabaseAdmin
        .from(TABELAS_SUPABASE.ETAPAS_APROVACAO)
        .delete()
        .eq("workflow_id", wfData.id);

      if (deleteError) throw deleteError;

      const { error: insertError } = await supabaseAdmin
        .from(TABELAS_SUPABASE.ETAPAS_APROVACAO)
        .insert(synchronizedSteps);

      if (insertError) throw insertError;
    } else {
      for (const tStep of templateSteps) {
        const existingMatch = existingSteps?.find((s: any) => Number(s.step_number) === tStep.step_number);
        if (existingMatch && !existingMatch.assigned_user_id && tStep.assigned_user_id) {
          const { error: assignError } = await supabaseAdmin
            .from(TABELAS_SUPABASE.ETAPAS_APROVACAO)
            .update({
              assigned_user_id: tStep.assigned_user_id,
              assigned_user_name: tStep.assigned_user_name || null,
            })
            .eq("id", existingMatch.id);
          garantirGravacaoSupabase({ error: assignError }, "Não foi possível atribuir o responsável da etapa");
        }
      }
    }

    const { data: finalSteps } = await supabaseAdmin
      .from(TABELAS_SUPABASE.ETAPAS_APROVACAO)
      .select("*")
      .eq("workflow_id", wfData.id)
      .order("step_number");

    let validCurrentStep = Number(wfData.current_step);
    if (validCurrentStep > 5) validCurrentStep = 5;
    if (validCurrentStep < 1) validCurrentStep = 1;

    const currentStepExists = finalSteps?.some((s: any) => Number(s.step_number) === validCurrentStep);
    if (!currentStepExists && finalSteps && finalSteps.length > 0) {
      const firstPending = finalSteps.find((s: any) => s.status === "aguardando");
      validCurrentStep = firstPending ? Number(firstPending.step_number) : Number(finalSteps[0].step_number);
    }

    if (validCurrentStep !== Number(wfData.current_step)) {
      const { error: currentStepError } = await supabaseAdmin
        .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
        .update({ current_step: validCurrentStep })
        .eq("id", wfData.id);
      garantirGravacaoSupabase({ error: currentStepError }, "Não foi possível corrigir a etapa atual do fluxo");
      wfData.current_step = validCurrentStep;
    }

    // Defensive repair for workflows affected by older role-name synchronization.
    // If the workflow has already advanced, every previous stage was necessarily approved.
    const stalePreviousSteps = (finalSteps || []).filter((step: any) => {
      const stepNumber = Number(step.step_number);
      const status = String(step.status || "").toLowerCase();
      return stepNumber < validCurrentStep && !["aprovado", "opiniao", "negado"].includes(status);
    });

    if (stalePreviousSteps.length > 0) {
      const staleIds = stalePreviousSteps.map((step: any) => step.id).filter(Boolean);
      if (staleIds.length > 0) {
        const { error: repairError } = await supabaseAdmin
          .from(TABELAS_SUPABASE.ETAPAS_APROVACAO)
          .update({ status: "aprovado" })
          .in("id", staleIds);

        if (repairError) {
          throw new Error(`Não foi possível reparar status de etapas anteriores: ${repairError.message}`);
        } else {
          stalePreviousSteps.forEach((step: any) => {
            step.status = "aprovado";
          });
        }
      }
    }

    return finalSteps || [];
  } catch (err) {
    console.error("Erro em ensureWorkflowStepsSynced:", err);
    throw err;
  }
}

// Rota de aprovação/negação de IA com validação de fluxo

export async function decidirWorkflow(req: RequisicaoAutenticada, res: Response) {
  const { recordId, decision, comment } = req.body;
  const requestedStep = Number(req.body?.stepNumber);
  const user = req.usuarioAutenticado;

  if (!user?.id) return res.status(401).json({ error: "Não autorizado." });
  if (!["aprovado", "negado"].includes(decision)) {
    return res.status(400).json({ error: "Decisão inválida. Use: aprovado ou negado" });
  }
  if (!Number.isInteger(requestedStep) || requestedStep < 1 || requestedStep > 5) {
    return res.status(400).json({ error: "Etapa da decisão inválida." });
  }

  try {
    const supabaseAdmin = obterClienteSupabase();

    const { data: requesterProfile } = await supabaseAdmin
      .from(TABELAS_SUPABASE.PERFIS)
      .select("role, full_name")
      .eq("id", user.id)
      .single();

    const fullName = requesterProfile?.full_name || user.email || "Avaliador";

    const { data: existingWf } = await supabaseAdmin
      .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
      .select("id, current_step, final_status")
      .eq("ia_record_id", recordId)
      .maybeSingle();

    if (!existingWf) return res.status(404).json({ error: "Workflow não encontrado." });
    const wfData = existingWf;
    if (wfData.final_status !== "pendente") {
      return res.status(409).json({ error: "O workflow já foi encerrado." });
    }
    if (Number(wfData.current_step) !== requestedStep) {
      return res.status(409).json({ error: "A etapa informada não é a etapa atual do workflow." });
    }

    const { data: currentStepData } = await supabaseAdmin
      .from(TABELAS_SUPABASE.ETAPAS_APROVACAO)
      .select("id, step_number, role_name, status, is_opinion_only, assigned_user_id, assigned_user_name")
      .eq("workflow_id", wfData.id)
      .eq("step_number", requestedStep)
      .maybeSingle();

    if (!currentStepData) {
      return res.status(404).json({ error: "Etapa informada não encontrada no workflow." });
    }

    const autorizacao = validarAutorizacaoDecisao({
      userId: user.id,
      requestedStep,
      workflow: wfData,
      step: currentStepData,
    });
    if (!autorizacao.permitido) {
      return res.status(autorizacao.status).json({ error: autorizacao.mensagem });
    }

    // A Etapa 2 (TI) não pode ser concluída enquanto houver perguntas aguardando resposta do solicitante.
    if (Number(wfData.current_step) === 2) {
      const { data: pendingTiRequest, error: pendingTiError } = await supabaseAdmin
        .from(TABELAS_SUPABASE.SOLICITACOES_TI)
        .select("id")
        .eq("workflow_id", wfData.id)
        .eq("status", "aguardando_resposta")
        .limit(1)
        .maybeSingle();

      if (!pendingTiError && pendingTiRequest) {
        return res.status(409).json({
          error: "A Etapa 2 — TI possui perguntas aguardando resposta do solicitante. Aguarde o envio das respostas antes de aprovar ou negar a etapa."
        });
      }

      // Mantém compatibilidade durante a implantação: se a migration ainda não foi aplicada,
      // a decisão antiga continua funcionando e o endpoint de interações informa a pendência de setup.
      if (pendingTiError) {
        console.warn("Não foi possível verificar pendências de perguntas da TI:", pendingTiError.message);
      }
    }

    // 5. Registrar decisão (Regra 4)
    // Atualizar status da etapa correspondente para 'aprovado' ou 'negado'
    const currentStepNumber = Number(wfData.current_step);
    const { data: allSteps } = await supabaseAdmin
      .from(TABELAS_SUPABASE.ETAPAS_APROVACAO)
      .select("step_number")
      .eq("workflow_id", wfData.id);

    const stepNumbers = (allSteps || []).map((step: any) => Number(step.step_number));
    const maxStep = stepNumbers.length > 0 ? Math.max(...stepNumbers) : 5;
    const resultado = calcularResultadoDecisaoWorkflow({
      decision,
      currentStep: currentStepNumber,
      maxStep,
      isOpinionOnly: currentStepData.is_opinion_only,
    });

    const stepUpdatePayload = {
      status: resultado.stepStatus,
      comment: comment || null,
      decided_at: new Date().toISOString(),
      assigned_user_id: currentStepData.assigned_user_id,
      assigned_user_name: currentStepData.assigned_user_name,
      is_opinion_only: Boolean(currentStepData.is_opinion_only),
    };

    // Na Etapa 2, etapa + workflow são atualizados juntos pela RPC após uma
    // segunda validação de pendência sob o mesmo lock usado pelo chat.
    if (Number(wfData.current_step) !== 2) {
      const { data: etapaPersistida, error: stepDecisionError } = await supabaseAdmin
        .from(TABELAS_SUPABASE.ETAPAS_APROVACAO)
        .update(stepUpdatePayload)
        .eq("id", currentStepData.id)
        .eq("status", "aguardando")
        .eq("assigned_user_id", user.id)
        .select("id")
        .limit(1);
      garantirGravacaoSupabase(
        { error: stepDecisionError, data: etapaPersistida },
        "Não foi possível registrar a decisão da etapa",
        true,
      );
    }

    const finalStatus = resultado.finalStatus;
    const newAuditStatus = resultado.statusAuditoria;
    const newStatusUso = resultado.statusUso;
    const nextStep = resultado.nextStep;
    const workflowUpdatePayload: Record<string, unknown> = resultado.completed
      ? {
          current_step: currentStepNumber,
          final_status: resultado.finalStatus,
          completed_at: new Date().toISOString(),
        }
      : {
          current_step: nextStep,
          final_status: "pendente",
        };

    if (currentStepNumber === 2) {
      try {
        await chamarRpcDecidirEtapaTI(supabaseAdmin as any, {
          workflowId: wfData.id,
          stepId: currentStepData.id,
          userId: user.id,
          decision,
          comment,
          userName: fullName,
        });
      } catch (rpcError: any) {
        if (estruturaChatAusente(rpcError)) {
          // Compatibilidade temporária antes de SUPABASE_TI_CHAT.sql:
          // sem chat novo, preserva-se a decisão legada já validada acima.
          console.warn(
            "RPC de decisão segura da TI indisponível. Revise documentacao/SUPABASE_TI_CHAT.sql:",
            rpcError?.message || rpcError,
          );
          const { data: etapaLegadaPersistida, error: stepLegacyError } = await supabaseAdmin
            .from(TABELAS_SUPABASE.ETAPAS_APROVACAO)
            .update(stepUpdatePayload)
            .eq("id", currentStepData.id)
            .eq("status", "aguardando")
            .eq("assigned_user_id", user.id)
            .select("id")
            .limit(1);
          garantirGravacaoSupabase(
            { error: stepLegacyError, data: etapaLegadaPersistida },
            "Não foi possível registrar a decisão da etapa",
            true,
          );
          const { data: workflowLegacy, error: workflowLegacyError } = await supabaseAdmin
            .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
            .update(workflowUpdatePayload)
            .eq("id", wfData.id)
            .eq("current_step", requestedStep)
            .eq("final_status", "pendente")
            .select("id, final_status")
            .limit(1);
          garantirGravacaoSupabase(
            { error: workflowLegacyError, data: workflowLegacy },
            "Não foi possível atualizar o fluxo de aprovação",
            true,
          );
        } else {
          const erroMapeado = mapearErroRpcInteracaoTI(rpcError);
          return res.status(erroMapeado.status).json({ error: erroMapeado.mensagem });
        }
      }
    } else {
      const { data: workflowPersistido, error: workflowDecisionError } = await supabaseAdmin
        .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
        .update(workflowUpdatePayload)
        .eq("id", wfData.id)
        .eq("current_step", requestedStep)
        .eq("final_status", "pendente")
        .select("id, final_status")
        .limit(1);
      garantirGravacaoSupabase(
        { error: workflowDecisionError, data: workflowPersistido },
        "Não foi possível atualizar o fluxo de aprovação",
        true,
      );
    }

    // 7. Atualizar o registro da IA no banco (sempre — colunas + JSON data)
    const { data: iaRecord, error: iaLookupError } = await supabaseAdmin
      .from(TABELAS_SUPABASE.REGISTROS_IA)
      .select("data")
      .eq("id", recordId)
      .maybeSingle();

    if (iaLookupError) {
      throw new Error(`Não foi possível localizar o registro da solicitação: ${iaLookupError.message}`);
    }
    if (!iaRecord) {
      throw new Error("Registro de IA não encontrado para persistir a decisão.");
    }

    const recordData = (iaRecord.data as Record<string, unknown> | null) || {};
    const actionLabel = decision === "aprovado"
      ? `Etapa ${currentStepNumber}/${maxStep} aprovada por ${fullName}`
      : `Etapa ${currentStepNumber}/${maxStep} negada por ${fullName}`;

    const updatedData: Record<string, unknown> = {
      ...recordData,
      statusAuditoria: newAuditStatus,
      statusUso: newStatusUso,
      observacoesGeraisOriginais: recordData.observacoesGeraisOriginais || recordData.observacoesGerais || "",
      historico: [{
        date: new Date().toISOString(),
        user: fullName,
        action: actionLabel,
        message: comment || actionLabel,
        stepNumber: currentStepNumber,
        stepStatus: resultado.stepStatus,
        isOpinionOnly: Boolean(currentStepData.is_opinion_only),
        finalStatus,
      }, ...((recordData.historico as unknown[]) || [])]
    };

    const updatePayload: Record<string, unknown> = {
      data: updatedData,
      status_uso: newStatusUso,
      updated_at: new Date().toISOString(),
    };

    const currentDateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    if (decision === "negado") {
      updatePayload.status_uso = "Não aprovado";
      updatePayload.parecer_tecnico = "IA indeferida no fluxo de aprovação.";
      updatePayload.data_aprovacao = currentDateStr;
      if (comment) {
        updatePayload.observacoes_gerais = comment;
      }

      updatedData.statusUso = "Não aprovado";
      updatedData.statusAuditoria = "Negado";
      updatedData.parecerTecnico = "IA indeferida no fluxo de aprovação.";
      updatedData.dataAprovacao = currentDateStr;
    } else if (resultado.completed) {
      updatePayload.status_uso = "Aprovado";
      updatePayload.parecer_tecnico = "IA aprovada no fluxo de aprovação.";
      updatePayload.data_aprovacao = currentDateStr;
      if (comment) {
        updatePayload.observacoes_gerais = comment;
      }

      updatedData.statusUso = "Aprovado";
      updatedData.statusAuditoria = "Aprovado";
      updatedData.parecerTecnico = "IA aprovada no fluxo de aprovação.";
      updatedData.dataAprovacao = currentDateStr;
    }

    const { data: registroPersistido, error: recordDecisionError } = await supabaseAdmin
      .from(TABELAS_SUPABASE.REGISTROS_IA)
      .update(updatePayload)
      .eq("id", recordId)
      .select("id, status_uso")
      .limit(1);
    garantirGravacaoSupabase(
      { error: recordDecisionError, data: registroPersistido },
      "Não foi possível atualizar o registro da solicitação",
      true,
    );

    let responseMessage = "";
    if (finalStatus === "aprovado") {
      responseMessage = "IA aprovada com sucesso.";
    } else if (finalStatus === "negado") {
      responseMessage = "IA indeferida.";
    } else {
      responseMessage = `Aprovado! Aguardando etapa ${nextStep}.`;
    }

    return res.json({ 
      success: true, 
      finalStatus,
      nextStep: finalStatus === "pendente" ? nextStep : null,
      message: responseMessage
    });

  } catch (err: any) {
    console.error("Erro no workflow/decide:", err);
    return res.status(500).json({ error: err.message || "Erro interno" });
  }
}

export async function redefinirStatusWorkflow(req: RequisicaoAutenticada, res: Response) {
  const { recordId, newStatus, reason } = req.body;
  const user = req.usuarioAutenticado;

  if (!user?.id) {
    return res.status(401).json({ error: "Não autorizado." });
  }

  try {
    const supabaseAdmin = obterClienteSupabase();

    const { data: directRec } = await supabaseAdmin
      .from(TABELAS_SUPABASE.REGISTROS_IA)
      .select("*")
      .eq("id", recordId)
      .maybeSingle();

    const iaRecord = directRec;

    if (!iaRecord) {
      return res.status(404).json({ error: "Registro de IA não encontrado" });
    }

    const { data: profileRow } = await supabaseAdmin
      .from(TABELAS_SUPABASE.PERFIS)
      .select("role, full_name")
      .eq("id", user.id)
      .maybeSingle();

    const userRole = String(profileRow?.role || "").toLowerCase().trim();
    if (!papelPodeRedefinirWorkflow(userRole)) {
      return res.status(403).json({ error: "Acesso proibido: apenas administradores podem redefinir o status." });
    }

    const userFullName = profileRow?.full_name || user.email || "Usuário";
    const targetStatusUso = newStatus || "Em avaliação";

    let targetStatusAuditoria = "Pendente";
    if (targetStatusUso === "Aprovado" || targetStatusUso === "Aprovado com restrições") {
      targetStatusAuditoria = "Aprovado";
    } else if (targetStatusUso === "Não aprovado" || targetStatusUso === "Suspenso") {
      targetStatusAuditoria = "Negado";
    }

    let targetFinalStatus = "pendente";
    if (targetStatusAuditoria === "Aprovado") {
      targetFinalStatus = "aprovado";
    } else if (targetStatusAuditoria === "Negado") {
      targetFinalStatus = "negado";
    }

    const realRecordId = iaRecord.id;

    // 4. Localizar e reiniciar TODOS os approval_workflows vinculados a esta IA
    const { data: workflows } = await supabaseAdmin
      .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
      .select("id")
      .or(`ia_record_id.eq.${realRecordId},ia_record_id.eq.${recordId}`);

    if (workflows && workflows.length > 0) {
      const wfIds = workflows.map((w: any) => w.id);

      // Reiniciar approval_workflows para a etapa 1 e status correto
      const { error: wfUpdateErr } = await supabaseAdmin
        .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
        .update({
          current_step: 1,
          final_status: targetFinalStatus,
          completed_at: targetFinalStatus === "pendente" ? null : new Date().toISOString()
        })
        .in("id", wfIds);

      if (wfUpdateErr) {
        return res.status(500).json({ error: `Erro ao reiniciar o workflow: ${wfUpdateErr.message}` });
      }

      // Reiniciar TODAS as approval_steps para aguardando e limpar pareceres e decisões anteriores
      const { error: stepsUpdateErr } = await supabaseAdmin
        .from(TABELAS_SUPABASE.ETAPAS_APROVACAO)
        .update({
          status: "aguardando",
          comment: null,
          decided_at: null
        })
        .in("workflow_id", wfIds);

      if (stepsUpdateErr) {
        return res.status(500).json({ error: `Erro ao redefinir as etapas de aprovação: ${stepsUpdateErr.message}` });
      }

      if (targetFinalStatus === "pendente") {
        for (const workflowId of wfIds) {
          await garantirEtapasWorkflowSincronizadas(
            supabaseAdmin,
            { id: workflowId, current_step: 1, final_status: "pendente" },
            realRecordId
          );
        }
      }
    } else {
      // Criar workflow do zero se não existia
      const { data: newWf, error: newWfErr } = await supabaseAdmin
        .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
        .insert({
          ia_record_id: realRecordId,
          current_step: 1,
          final_status: targetFinalStatus
        })
        .select("id")
        .single();

      if (newWfErr || !newWf) {
        return res.status(500).json({ error: `Não foi possível criar o fluxo de aprovação: ${newWfErr?.message || "Erro desconhecido"}` });
      }

      if (newWf) {
        const { data: configRows } = await supabaseAdmin
          .from(TABELAS_SUPABASE.CONFIGURACAO_APROVACAO)
          .select("*")
          .order("step_number");

        const stepsToInsert = obterEtapasOficiaisComResponsaveis(configRows)
          .map((c) => ({
              workflow_id: newWf.id,
              ia_record_id: realRecordId,
              step_number: c.step_number,
              role_name: c.role_name,
              assigned_user_id: c.assigned_user_id || null,
              assigned_user_name: c.assigned_user_name || null,
              status: "aguardando",
              comment: null,
              is_opinion_only: c.is_opinion_only,
              decided_at: null,
            }));

        const { error: stepsResetInsertErr } = await supabaseAdmin.from(TABELAS_SUPABASE.ETAPAS_APROVACAO).insert(stepsToInsert);
        garantirGravacaoSupabase({ error: stepsResetInsertErr }, "Não foi possível criar as etapas do fluxo");
      }
    }

    // 5. Atualizar ia_records para status de nova avaliação, limpar pareceres antigos e registrar histórico
    const recordData = iaRecord.data ? { ...iaRecord.data } : {};

    const now = new Date();
    const pad = (num: number) => String(num).padStart(2, "0");
    const formattedDate = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const infoMessage = `O status desta IA foi redefinido por ${userFullName} em ${formattedDate} para "${targetStatusUso}" e o fluxo de aprovação foi reiniciado para o início.${reason ? ` Motivo: ${reason}` : ""}`;

    const newHistoryEntry = {
      date: now.toISOString(),
      user: userFullName,
      action: "Status redefinido",
      message: infoMessage
    };

    recordData.statusAuditoria = targetStatusAuditoria;
    recordData.statusUso = targetStatusUso;
    recordData.dataAprovacao = null;
    recordData.parecerTecnico = "";
    recordData.parecerTI = "";
    recordData.parecerDiretoria = "";
    recordData.parecerPresidencia = "";
    recordData.etapasAprovacao = [];
    recordData.historico = [newHistoryEntry, ...(recordData.historico || [])];

    let iaUpdateErr: any = null;
    try {
      const { error } = await supabaseAdmin
        .from(TABELAS_SUPABASE.REGISTROS_IA)
        .update({
          data: recordData,
          status: targetStatusAuditoria,
          status_uso: targetStatusUso,
          parecer_tecnico: "",
          data_aprovacao: null
        })
        .eq("id", realRecordId);
      iaUpdateErr = error;
    } catch (e: any) {
      iaUpdateErr = e;
    }

    if (iaUpdateErr) {
      const errMsg = (iaUpdateErr.message || "").toLowerCase();
      const isMissingColumn = 
        iaUpdateErr.code === "PGRST204" || 
        iaUpdateErr.code === "42703" || 
        errMsg.includes("status") || 
        errMsg.includes("schema cache");

      if (isMissingColumn) {
        console.warn("⚠️ Coluna 'status' ou similar não existe em ia_records. Tentando fallback sem a coluna 'status'...");
        const { error: retryError } = await supabaseAdmin
          .from(TABELAS_SUPABASE.REGISTROS_IA)
          .update({
            data: recordData,
            status_uso: targetStatusUso
          })
          .eq("id", realRecordId);
        iaUpdateErr = retryError;
      }
    }

    if (iaUpdateErr) {
      return res.status(500).json({ error: `Erro ao atualizar a ficha da IA: ${iaUpdateErr.message}` });
    }

    return res.json({
      success: true,
      message: "Status e fluxo de aprovação reiniciados com sucesso!",
      recordId
    });

  } catch (err: any) {
    console.error("Erro no workflow/reset-status:", err);
    return res.status(500).json({ error: err.message || "Erro interno do servidor" });
  }
}

export async function cancelarSolicitacao(req: RequisicaoAutenticada, res: Response) {
  const recordId = typeof req.body?.recordId === "string" ? req.body.recordId.trim() : "";
  const user = req.usuarioAutenticado;

  if (!user?.id) {
    return res.status(401).json({ error: "Não autorizado." });
  }
  if (!recordId) {
    return res.status(400).json({ error: "Identificador da solicitação ausente." });
  }

  const supabaseAdmin = obterClienteSupabase();

  try {
    const { data: registro, error: registroError } = await supabaseAdmin
      .from(TABELAS_SUPABASE.REGISTROS_IA)
      .select("id, owner_id, status_uso, data")
      .eq("id", recordId)
      .maybeSingle();

    if (registroError) {
      return res.status(500).json({ error: registroError.message });
    }
    if (!registro) {
      return res.status(404).json({ error: "Registro de IA não encontrado." });
    }

    const { data: perfil } = await supabaseAdmin
      .from(TABELAS_SUPABASE.PERFIS)
      .select("role, full_name")
      .eq("id", user.id)
      .maybeSingle();

    const autorizacao = autorizarCancelamento({
      userId: user.id,
      role: perfil?.role,
      ownerId: registro.owner_id,
    });
    if (!autorizacao.permitido) {
      return res.status(autorizacao.status).json({ error: autorizacao.mensagem });
    }

    const { data: workflow, error: workflowError } = await supabaseAdmin
      .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
      .select("id, current_step, final_status, completed_at")
      .eq("ia_record_id", recordId)
      .maybeSingle();

    if (workflowError) {
      return res.status(500).json({ error: workflowError.message });
    }

    // Sem fluxo: a UI atual também recusava. Não inventamos workflow e não
    // cancelamos só o registro, para não deixar estado institucional divergente.
    if (!workflow) {
      return res.status(409).json({ error: "Workflow correspondente não encontrado." });
    }

    if (estadoFinalImpedeCancelamento({
      statusUso: registro.status_uso,
      workflowFinalStatus: workflow.final_status,
    })) {
      return res.status(409).json({ error: "Esta solicitação já está encerrada e não pode ser cancelada." });
    }

    const agora = new Date().toISOString();
    const nomeAtor = perfil?.full_name || user.email || "Solicitante";
    const dadosAtuais = (registro.data && typeof registro.data === "object")
      ? { ...(registro.data as Record<string, unknown>) }
      : {};
    const dadosCancelados = montarDadosRegistroCancelado(dadosAtuais, agora, nomeAtor);

    const { data: workflowPersistido, error: workflowUpdateError } = await supabaseAdmin
      .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
      .update({
        final_status: "cancelado",
        completed_at: agora,
      })
      .eq("id", workflow.id)
      .select("id, current_step, final_status, completed_at")
      .single();

    if (workflowUpdateError || workflowPersistido?.final_status !== "cancelado") {
      return res.status(500).json({
        error: workflowUpdateError?.message || "Workflow não foi persistido de forma coerente.",
      });
    }

    const { data: registroPersistido, error: registroUpdateError } = await supabaseAdmin
      .from(TABELAS_SUPABASE.REGISTROS_IA)
      .update({
        data: dadosCancelados,
        status_uso: STATUS_USO_CANCELADA,
        updated_at: agora,
      })
      .eq("id", recordId)
      .select("id, owner_id, status_uso, updated_at, data")
      .single();

    if (registroUpdateError || registroPersistido?.status_uso !== STATUS_USO_CANCELADA) {
      const { error: restoreError } = await supabaseAdmin
        .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
        .update({
          final_status: workflow.final_status,
          completed_at: workflow.completed_at,
        })
        .eq("id", workflow.id);
      if (restoreError) {
        console.error("Erro ao restaurar workflow após falha no cancelamento:", restoreError);
      }
      return res.status(500).json({
        error: registroUpdateError?.message || "Registro não foi persistido como cancelado.",
      });
    }

    if (registroPersistido.owner_id !== registro.owner_id) {
      return res.status(500).json({ error: "Cancelamento alterou owner_id indevidamente." });
    }

    return res.json({
      success: true,
      record: registroPersistido,
      workflow: workflowPersistido,
    });
  } catch (err: any) {
    console.error("Erro no workflow/cancel:", err);
    return res.status(500).json({ error: err.message || "Erro interno do servidor" });
  }
}
