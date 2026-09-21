import { RELACOES_SUPABASE, TABELAS_SUPABASE } from "../configuracoes/schema-supabase";
import { ETAPAS_PADRAO_APROVACAO, NOME_ETAPA_FINANCEIRA } from "../configuracoes/fluxo-aprovacao";
import { papelEhAdmin, papelEhCoordenadorNit } from "../utilitarios/permissoes";
import type { Request, Response } from "express";

import { obterClienteSupabase } from "../configuracoes/supabase";
import {
  chamarRpcDecidirEtapaTI,
  estruturaChatAusente,
  mapearErroRpcInteracaoTI,
} from "./interacoes-ti.servico";

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
      console.log("Sincronizando a configuração com o fluxo oficial de 5 etapas...");

      const officialSteps = obterEtapasOficiaisComResponsaveis(configData);
      const configuredStepNumbers = [...new Set((configData || []).map((row: any) => Number(row.step_number)))];

      for (const stepNumber of configuredStepNumbers) {
        const { error: deleteError } = await supabaseAdmin
          .from(TABELAS_SUPABASE.CONFIGURACAO_APROVACAO)
          .delete()
          .eq("step_number", stepNumber);

        if (deleteError) {
          return res.status(500).json({ error: deleteError.message });
        }
      }

      const { error: upsertError } = await supabaseAdmin.from(TABELAS_SUPABASE.CONFIGURACAO_APROVACAO).upsert(
        officialSteps.map((stepDef) => ({
          ...stepDef,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "step_number" }
      );

      if (upsertError) {
        return res.status(500).json({ error: upsertError.message });
      }

      const { data: updatedConfig } = await supabaseAdmin
        .from(TABELAS_SUPABASE.CONFIGURACAO_APROVACAO)
        .select("*")
        .order("step_number");

      return res.json(updatedConfig || []);
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
          .eq("step_number", step.step_number);

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

export async function listarWorkflows(req: Request, res: Response) {
  try {
    const supabaseAdmin = obterClienteSupabase();
    const { data: wfData, error } = await supabaseAdmin
      .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
      .select(`*, ${RELACOES_SUPABASE.ETAPAS_DO_FLUXO}`);
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.json(wfData || []);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}

export async function inicializarWorkflow(req: Request, res: Response) {
  const { recordId } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  try {
    const token = authHeader.replace("Bearer ", "");
    const supabase = obterClienteSupabase();
    const supabaseAdmin = obterClienteSupabase();

    // 1. Verificar quem está fazendo a requisição
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Token inválido" });

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
    const { data: iaRecord } = await supabaseAdmin
      .from(TABELAS_SUPABASE.REGISTROS_IA)
      .select("data")
      .eq("id", recordId)
      .single();

    if (iaRecord?.data) {
      const recordData = iaRecord.data as any;
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

export async function decidirWorkflow(req: Request, res: Response) {
  const { recordId, decision, comment, coordinatorData } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
  if (!["aprovado", "negado"].includes(decision)) {
    return res.status(400).json({ error: "Decisão inválida. Use: aprovado ou negado" });
  }

  try {
    const token = authHeader.replace("Bearer ", "");
    const supabase = obterClienteSupabase();
    const supabaseAdmin = obterClienteSupabase();

    // 1. Verificar quem está fazendo a requisição
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Token inválido" });

    // 2. Obter perfil do solicitante
    const { data: requesterProfile } = await supabaseAdmin
      .from(TABELAS_SUPABASE.PERFIS)
      .select("role, full_name")
      .eq("id", user.id)
      .single();

    const role = requesterProfile?.role?.toLowerCase().trim() || "user";
    const fullName = requesterProfile?.full_name || user.email || "Avaliador";

    // 3. Buscar workflow da IA
    let wfData = null;
    const { data: existingWf } = await supabaseAdmin
      .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
      .select("id, current_step, final_status")
      .eq("ia_record_id", recordId)
      .maybeSingle();

    if (existingWf) {
      wfData = existingWf;
      await garantirEtapasWorkflowSincronizadas(supabaseAdmin, wfData, recordId);
    } else {
      console.log(`Workflow não encontrado para a IA ${recordId}. Inicializando on-the-fly...`);
      const { data: configRows } = await supabaseAdmin
        .from(TABELAS_SUPABASE.CONFIGURACAO_APROVACAO)
        .select("*")
        .order("step_number");

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

      const stepsToInsert = obterEtapasOficiaisComResponsaveis(configRows)
        .map((c) => ({
            workflow_id: newWf.id,
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
        console.error("Erro ao inserir etapas automáticas:", stepsInsertErr);
        return res.status(500).json({ error: `Erro ao salvar as etapas do fluxo: ${stepsInsertErr.message}` });
      }
    }

    if (wfData.final_status !== "pendente") {
      return res.status(400).json({ error: "Esta IA já teve seu fluxo encerrado" });
    }

    // 4. Buscar dados da etapa atual
    let { data: currentStepData } = await supabaseAdmin
      .from(TABELAS_SUPABASE.ETAPAS_APROVACAO)
      .select("id, role_name, is_opinion_only, assigned_user_id, assigned_user_name")
      .eq("workflow_id", wfData.id)
      .eq("step_number", wfData.current_step)
      .maybeSingle();

    if (!currentStepData) {
      // Fallback: se não encontrar por step_number, pega a primeira etapa com status 'aguardando'
      const { data: fallbackStep } = await supabaseAdmin
        .from(TABELAS_SUPABASE.ETAPAS_APROVACAO)
        .select("id, role_name, is_opinion_only, assigned_user_id, assigned_user_name, step_number")
        .eq("workflow_id", wfData.id)
        .eq("status", "aguardando")
        .order("step_number")
        .limit(1)
        .maybeSingle();

      if (fallbackStep) {
        currentStepData = fallbackStep;
        wfData.current_step = fallbackStep.step_number;
        const { error: currentStepFixError } = await supabaseAdmin
          .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
          .update({ current_step: fallbackStep.step_number })
          .eq("id", wfData.id);
        garantirGravacaoSupabase({ error: currentStepFixError }, "Não foi possível atualizar a etapa atual do fluxo");
      } else {
        return res.status(404).json({ error: "Etapa atual não encontrada no workflow" });
      }
    }

    // Se a etapa ainda não tem responsável atribuído no approval_steps, buscar do approval_config ou atribuir ao usuário atual se admin
    if (!currentStepData.assigned_user_id) {
      const { data: cfgStep } = await supabaseAdmin
        .from(TABELAS_SUPABASE.CONFIGURACAO_APROVACAO)
        .select("assigned_user_id, assigned_user_name")
        .eq("step_number", wfData.current_step)
        .maybeSingle();

      if (cfgStep?.assigned_user_id) {
        currentStepData.assigned_user_id = cfgStep.assigned_user_id;
        currentStepData.assigned_user_name = cfgStep.assigned_user_name;
        const { error: assignCfgError } = await supabaseAdmin
          .from(TABELAS_SUPABASE.ETAPAS_APROVACAO)
          .update({
            assigned_user_id: cfgStep.assigned_user_id,
            assigned_user_name: cfgStep.assigned_user_name,
          })
          .eq("id", currentStepData.id);
        garantirGravacaoSupabase({ error: assignCfgError }, "Não foi possível atribuir o responsável da etapa");
      } else if (papelEhAdmin(role) || papelEhCoordenadorNit(role)) {
        currentStepData.assigned_user_id = user.id;
        currentStepData.assigned_user_name = fullName;
        const { error: assignAdminError } = await supabaseAdmin
          .from(TABELAS_SUPABASE.ETAPAS_APROVACAO)
          .update({
            assigned_user_id: user.id,
            assigned_user_name: fullName,
          })
          .eq("id", currentStepData.id);
        garantirGravacaoSupabase({ error: assignAdminError }, "Não foi possível atribuir o responsável da etapa");
      }
    }

    // Administradores e a própria pessoa designada podem realizar a decisão
    const isAssignedToMe = currentStepData.assigned_user_id === user.id || papelEhAdmin(role);

    if (!isAssignedToMe) {
      return res.status(403).json({ 
        error: "Apenas o responsável designado para esta etapa (ou Administrador) pode aprovar ou negar." 
      });
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
    const decisionStatus = decision === "aprovado" ? "aprovado" : "negado";
    const stepUpdatePayload = {
      status: decisionStatus,
      comment: comment || null,
      decided_at: new Date().toISOString(),
      assigned_user_id: currentStepData.assigned_user_id || user.id,
      assigned_user_name: currentStepData.assigned_user_name || fullName,
    };

    // Na Etapa 2, etapa + workflow são atualizados juntos pela RPC após uma
    // segunda validação de pendência sob o mesmo lock usado pelo chat.
    if (Number(wfData.current_step) !== 2) {
      const { error: stepDecisionError } = await supabaseAdmin
        .from(TABELAS_SUPABASE.ETAPAS_APROVACAO)
        .update(stepUpdatePayload)
        .eq("id", currentStepData.id);
      garantirGravacaoSupabase({ error: stepDecisionError }, "Não foi possível registrar a decisão da etapa");
    }

    // 6. Contar total de etapas e calcular regras de fluxo dinamicamente
    const { data: allSteps } = await supabaseAdmin
      .from(TABELAS_SUPABASE.ETAPAS_APROVACAO)
      .select("step_number")
      .eq("workflow_id", wfData.id);

    const stepNumbers = (allSteps || []).map((step: any) => Number(step.step_number));
    const maxStep = stepNumbers.length > 0 ? Math.max(...stepNumbers) : 5;

    const currentStepNumber = Number(wfData.current_step);
    const nextStep = currentStepNumber + 1;
    const isFinalStep = currentStepNumber === maxStep;
    const isFinancialStep = currentStepNumber === maxStep || currentStepData?.role_name === NOME_ETAPA_FINANCEIRA;

    let finalStatus = "pendente";
    let newAuditStatus = "Pendente";
    let newStatusUso = "Em avaliação";
    let workflowUpdatePayload: any = {};

    if (decision === "negado" && isFinancialStep) {
      // Exceção: Direção Financeira desfavorável não reprova a IA. Como ela é o passo 5 (final), concluímos o fluxo como aprovado.
      finalStatus = "aprovado";
      newAuditStatus = "Aprovado";
      newStatusUso = "Aprovado";

      workflowUpdatePayload = {
        current_step: currentStepNumber,
        final_status: "aprovado",
        completed_at: new Date().toISOString()
      };
    } else if (decision === "negado") {
      // Negativa real nas demais etapas encerra o fluxo.
      finalStatus = "negado";
      newAuditStatus = "Negado";
      newStatusUso = "Não aprovado";

      workflowUpdatePayload = {
        current_step: currentStepNumber,
        final_status: "negado",
        completed_at: new Date().toISOString()
      };
    } else if (decision === "aprovado" && isFinalStep) {
      // Aprovação encerra o fluxo como aprovado.
      finalStatus = "aprovado";
      newAuditStatus = "Aprovado";
      newStatusUso = "Aprovado";

      workflowUpdatePayload = {
        current_step: currentStepNumber,
        final_status: "aprovado",
        completed_at: new Date().toISOString()
      };
    } else {
      // Aprovação de etapa intermediária avança normalmente.
      finalStatus = "pendente";
      newAuditStatus = "Pendente";

      if (nextStep >= 3) {
        newStatusUso = "Em teste/piloto";
      } else {
        newStatusUso = "Em avaliação";
      }

      workflowUpdatePayload = {
        current_step: nextStep,
        final_status: "pendente"
      };
    }

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
          const { error: stepLegacyError } = await supabaseAdmin
            .from(TABELAS_SUPABASE.ETAPAS_APROVACAO)
            .update(stepUpdatePayload)
            .eq("id", currentStepData.id);
          garantirGravacaoSupabase({ error: stepLegacyError }, "Não foi possível registrar a decisão da etapa");
          const { data: workflowLegacy, error: workflowLegacyError } = await supabaseAdmin
            .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
            .update(workflowUpdatePayload)
            .eq("id", wfData.id)
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
    let actionLabel = decision === "aprovado"
      ? `Etapa ${currentStepNumber}/${maxStep} aprovada por ${fullName}`
      : `Etapa ${currentStepNumber}/${maxStep} negada por ${fullName}`;

    if (decision === "negado" && isFinancialStep) {
      actionLabel = `Direção Financeira: parecer desfavorável. Fluxo concluído com aprovação da Presidência.`;
    }

    const updatedData: Record<string, unknown> = {
      ...recordData,
      ...(coordinatorData || {}),
      statusAuditoria: newAuditStatus,
      statusUso: newStatusUso,
      observacoesGeraisOriginais: recordData.observacoesGeraisOriginais || recordData.observacoesGerais || "",
      historico: [{
        date: new Date().toISOString(),
        user: fullName,
        action: actionLabel,
        message: comment || actionLabel
      }, ...((recordData.historico as unknown[]) || [])]
    };

    const updatePayload: Record<string, unknown> = {
      data: updatedData,
      status: newAuditStatus,
      status_uso: newStatusUso,
      updated_at: new Date().toISOString(),
    };

    const currentDateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    if (decision === "negado" && isFinancialStep) {
      updatePayload.status = "Aprovado";
      updatePayload.status_uso = "Aprovado";
      updatedData.statusUso = "Aprovado";
      updatedData.statusAuditoria = "Aprovado";
      updatePayload.observacoes_gerais = comment || "Direção Financeira: parecer desfavorável. Fluxo concluído com aprovação da Presidência.";
    } else if (decision === "negado") {
      updatePayload.status = "Negado";
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
    } else if (decision === "aprovado" && isFinalStep) {
      updatePayload.status = "Aprovado";
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
      .select("id, status, status_uso")
      .limit(1);
    garantirGravacaoSupabase(
      { error: recordDecisionError, data: registroPersistido },
      "Não foi possível atualizar o registro da solicitação",
      true,
    );

    let responseMessage = "";
    if (decision === "negado" && isFinancialStep) {
      responseMessage = "Parecer financeiro desfavorável registrado. Fluxo concluído com aprovação da Presidência.";
    } else if (finalStatus === "aprovado") {
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

export async function redefinirStatusWorkflow(req: Request, res: Response) {
  const { recordId, newStatus, reason } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Não autorizado: token ausente" });
  }

  try {
    const token = authHeader.replace("Bearer ", "");
    const supabase = obterClienteSupabase();
    const supabaseAdmin = obterClienteSupabase();

    // 1. Validar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: "Token inválido ou expirado" });
    }

    // 2. Localizar ia_record
    let iaRecord: any = null;
    const { data: directRec } = await supabaseAdmin
      .from(TABELAS_SUPABASE.REGISTROS_IA)
      .select("*")
      .eq("id", recordId)
      .maybeSingle();

    iaRecord = directRec;

    if (!iaRecord) {
      const { data: allRecs } = await supabaseAdmin
        .from(TABELAS_SUPABASE.REGISTROS_IA)
        .select("*");
      if (allRecs) {
        iaRecord = allRecs.find((r: any) => r.id === recordId || r.data?.id === recordId);
      }
    }

    if (!iaRecord) {
      return res.status(404).json({ error: "Registro de IA não encontrado" });
    }

    // 3. Validar se o usuário é admin ou o proprietário da solicitação
    const { data: profileRow } = await supabaseAdmin
      .from(TABELAS_SUPABASE.PERFIS)
      .select("role, full_name")
      .eq("id", user.id)
      .maybeSingle();

    const userRole = (profileRow?.role || (user.user_metadata as any)?.role || "").toLowerCase().trim();
    const isAdmin = userRole === "admin" || 
                    userRole === "administrador" || 
                    userRole.includes("admin") || 
                    userRole.includes("nit") || 
                    userRole.includes("gerente") ||
                    userRole.includes("presidência") ||
                    userRole.includes("presidencia");

    const isOwner = iaRecord.user_id === user.id || 
                    iaRecord.data?.userId === user.id || 
                    iaRecord.data?.solicitanteEmail === user.email;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: "Acesso proibido: Apenas administradores ou o proprietário da solicitação podem redefinir o status." });
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
