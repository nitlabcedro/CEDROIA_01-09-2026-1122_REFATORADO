import { IARecord, ApprovalWorkflow, UserProfile, StatusUso, StatusAuditoria } from "@/tipos";
import { obterCargoPrincipal, obterSetorPrincipal } from "./perfil-usuario";
import { obterStatusGeralDoRegistro } from "./status-solicitacao";

export interface SystemAlert {
  id: string;
  title: string;
  desc: string;
  level: "CRÍTICO" | "ATENÇÃO" | "INFORMATIVO";
  source: string;
  createdAt: string;
  status: "Ativo" | "Lido" | "Resolvido";
  relatedRecordId?: string;
  actionType?: "open-ia" | "open-profile" | "check-sync";
}

const ALERTS_STORAGE_KEY = "cedro_alerts_interactions_v1";

interface SavedAlertState {
  status: "Ativo" | "Lido" | "Resolvido";
  updatedAt: string;
}

export const getSavedAlertsInteractions = (): Record<string, SavedAlertState> => {
  try {
    const saved = localStorage.getItem(ALERTS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    console.error("Erro ao ler interações de alerta de localStorage:", e);
    return {};
  }
};

export const saveAlertInteraction = (alertId: string, status: "Ativo" | "Lido" | "Resolvido") => {
  try {
    const current = getSavedAlertsInteractions();
    current[alertId] = {
      status,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(current));
  } catch (e) {
    console.error("Erro ao salvar interação de alerta em localStorage:", e);
  }
};

/**
 * Centralized function to calculate system alerts based on records, workflows, profile, and Supabase status.
 */
export const generateSystemAlerts = (
  records: IARecord[],
  workflows: ApprovalWorkflow[],
  profile: UserProfile | null,
  supabaseStatus: "online" | "offline" | "checking"
): SystemAlert[] => {
  const alerts: SystemAlert[] = [];
  const savedStates = getSavedAlertsInteractions();

  // 1. Supabase status
  if (supabaseStatus === "offline") {
    const alertId = "infra-sync-offline";
    const saved = savedStates[alertId];
    alerts.push({
      id: alertId,
      title: "Instabilidade na Sincronização Coletiva",
      desc: "O servidor de dados Supabase nacional encontra-se instável ou offline temporariamente. Modificações estão sendo mantidas sob proteção local.",
      level: "CRÍTICO",
      source: "Infraestrutura",
      createdAt: new Date().toISOString(),
      status: saved ? saved.status : "Ativo",
      actionType: "check-sync"
    });
  }

  // 2. Profile completion
  if (
    profile
    && (
      !obterSetorPrincipal(profile.setor)
      || !obterCargoPrincipal(profile.cargo)
      || !profile.full_name?.trim()
    )
  ) {
    const alertId = `profile-incomplete-${profile.id || "currentUser"}`;
    const saved = savedStates[alertId];
    alerts.push({
      id: alertId,
      title: "Incompletude Cadastral",
      desc: "O seu cadastro funcional não possui Setor de Origem ou Cargo designados. Preencha seu perfil para viabilizar novas solicitações.",
      level: "INFORMATIVO",
      source: "Meu Cadastro",
      createdAt: new Date().toISOString(),
      status: saved ? saved.status : "Ativo",
      actionType: "open-profile"
    });
  }

  // 3. Record alerts
  records.forEach(record => {
    if (record.id.startsWith("METADATA")) return;

    // Blocked/Rejected
    const isSuspiciousStatus = 
      record.statusUso === StatusUso.NAO_APROVADO || 
      record.statusUso === StatusUso.SUSPENSO ||
      record.statusAuditoria === StatusAuditoria.NEGADO;

    if (isSuspiciousStatus) {
      const alertId = `${record.id}-rejection-warning`;
      const saved = savedStates[alertId];
      alerts.push({
        id: alertId,
        title: "Inteligência Artificial Recusada ou Suspensa",
        desc: `A ferramenta "${record.nomeFerramenta}" no setor "${record.unidadeSetor}" recebeu veto do comitê avaliador e não deve ser utilizada nas atividades.`,
        level: "CRÍTICO",
        source: "Atenção Administrativa",
        createdAt: record.updatedAt || record.createdAt || new Date().toISOString(),
        status: saved ? saved.status : "Ativo",
        relatedRecordId: record.id,
        actionType: "open-ia"
      });
    }

    // Pending Governance
    const relatedWf = workflows.find(wf => wf.iaRecordId === record.id);
    const statusGeral = obterStatusGeralDoRegistro(record, relatedWf);
    if (statusGeral === "Em análise" || statusGeral === "Em teste") {
      const daysSinceCreation = Math.floor(
        (Date.now() - new Date(record.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24)
      );
      const isDelayed = daysSinceCreation > 5;

      const alertId = `${record.id}-pending-governance`;
      const saved = savedStates[alertId];
      alerts.push({
        id: alertId,
        title: isDelayed ? "Avaliação de IA com Atraso Elevado" : "Nova IA Aguardando Avaliação",
        desc: isDelayed 
          ? `A solicitação para "${record.nomeFerramenta}" está aguardando homologação há mais de ${daysSinceCreation} dias na etapa ${relatedWf?.currentStep || 1}.`
          : `A ferramenta de IA "${record.nomeFerramenta}" encontra-se na fila de análise da Etapa ${relatedWf?.currentStep || 1} dos canais de governança.`,
        level: isDelayed ? "CRÍTICO" : "ATENÇÃO",
        source: "Pendências",
        createdAt: record.createdAt || new Date().toISOString(),
        status: saved ? saved.status : "Ativo",
        relatedRecordId: record.id,
        actionType: "open-ia"
      });
    }
  });

  return alerts;
};
