import { ROTAS_API } from "@/constantes/api";
import { usuarioEhAdmin, usuarioEhModerador, usuarioEhPrivilegiado } from "@/utilitarios/permissoes";
import { normalizarAbaAplicacao, type AbaAplicacao } from "@/constantes/navegacao";
import { RELACOES_SUPABASE, TABELAS_SUPABASE } from "@/constantes/supabase";
import { ETAPAS_APROVACAO_OFICIAIS, NOMES_ETAPAS_CURTOS, criarConfiguracaoAprovacaoPadrao, NOME_ETAPA_FINANCEIRA } from "@/constantes/fluxo-aprovacao";
import { CHAVES_ARMAZENAMENTO_LOCAL, EVENTOS_APLICACAO } from "@/constantes/armazenamento-local";
import React, { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/contextos/ContextoAutenticacao";
import { requisicaoApi } from "@/servicos/api";
import {
  addRecord,
  checkSupabaseStatus,
  deleteRecord,
  getProfiles,
  getRecords,
  saveRecordsToSupabase,
  updateRecord,
  updateUserProfile,
} from "@/servicos/armazenamento";
import { supabase } from "@/servicos/supabase";
import {
  ApprovalConfig,
  ApprovalWorkflow,
  IARecord,
  StatusAuditoria,
  StatusUso,
  UserProfile,
} from "@/tipos";
import { generateSystemAlerts } from "@/utilitarios/alertas";
import { useNotifications } from "./useNotificacoes";

export function useAplicacao() {
  const { user, profile, loading: authLoading, refreshProfile, signOut } = useAuth();
  const isCurrentUserAdmin = usuarioEhAdmin(profile);
  const isCurrentUserModerator = usuarioEhModerador(profile);
  const isCurrentUserPrivileged = usuarioEhPrivilegiado(profile);
  const [activeTab, setActiveTab] = useState<AbaAplicacao>(() =>
    normalizarAbaAplicacao(localStorage.getItem(CHAVES_ARMAZENAMENTO_LOCAL.ABA_ATIVA)),
  ); // inicia no perfil ou aba salva
  const [records, setRecords] = useState<IARecord[]>([]);
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
  const [approvalConfig, setApprovalConfig] = useState<ApprovalConfig>(() => criarConfiguracaoAprovacaoPadrao());
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [supabaseStatus, setSupabaseStatus] = useState<"online" | "offline" | "checking">("checking");
  const [selectedRecord, setSelectedRecord] = useState<IARecord | null>(null);

  // Efeitos para persistência de estado (evita perder foco em reconstruções do código / live reload)
  useEffect(() => {
    localStorage.setItem(CHAVES_ARMAZENAMENTO_LOCAL.ABA_ATIVA, activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (selectedRecord) {
      localStorage.setItem(CHAVES_ARMAZENAMENTO_LOCAL.REGISTRO_SELECIONADO, selectedRecord.id);
    } else {
      localStorage.removeItem(CHAVES_ARMAZENAMENTO_LOCAL.REGISTRO_SELECIONADO);
    }
  }, [selectedRecord]);

  useEffect(() => {
    if (records.length > 0 && !selectedRecord) {
      const savedId = localStorage.getItem(CHAVES_ARMAZENAMENTO_LOCAL.REGISTRO_SELECIONADO);
      if (savedId) {
        const found = records.find(r => r.id === savedId);
        if (found) {
          setSelectedRecord(found);
        }
      }
    } else if (selectedRecord && records.length > 0) {
      const found = records.find(r => r.id === selectedRecord.id);
      if (found && JSON.stringify(found) !== JSON.stringify(selectedRecord)) {
        setSelectedRecord(found);
      }
    }
  }, [records, selectedRecord]);
  const [originTab, setOriginTab] = useState<AbaAplicacao | null>("inventory");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const isDarkMode = false; // Modo escuro removido - apenas modo claro

  // Estados e lógicas para o sistema integrado de Alertas
  const [alertsToken, setAlertsToken] = useState(0);
  const triggerAlertsRefresh = () => setAlertsToken(prev => prev + 1);
  const [alertFilter, setAlertFilter] = useState<"all" | "critical" | "warning" | "info" | "resolved">("all");

  const systemAlerts = useMemo(() => {
    return generateSystemAlerts(records, workflows, profile, supabaseStatus);
  }, [records, workflows, profile, supabaseStatus, alertsToken]);

  const activeUnreadAlertsCount = useMemo(() => {
    return systemAlerts.filter(a => a.status === "Ativo").length;
  }, [systemAlerts]);

  // Contador global de mensagens de chat ainda não visualizadas.
  // A leitura é controlada localmente por conversa e compartilhada com Chat/sidebars via evento.
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const unreadChatRequestRef = React.useRef<Promise<void> | null>(null);

  const refreshUnreadChatCount = () => {
    if (!user?.id) {
      setUnreadChatCount(0);
      return Promise.resolve();
    }
    if (unreadChatRequestRef.current) return unreadChatRequestRef.current;

    const request = (async () => {
      try {
        const { data, error } = await supabase
          .from(TABELAS_SUPABASE.MENSAGENS)
          .select("id,sender_id,recipient_id,created_at")
          .eq("recipient_id", user.id)
          .order("created_at", { ascending: false })
          .limit(500);

        if (error) {
          console.warn("Não foi possível atualizar o contador de mensagens não lidas:", error);
          return;
        }

        let seenMap: Record<string, string> = {};
        try {
          const stored = localStorage.getItem(`${CHAVES_ARMAZENAMENTO_LOCAL.MAPA_CHAT_VISUALIZADO_PREFIXO}${user.id}`);
          seenMap = stored ? JSON.parse(stored) : {};
        } catch {
          seenMap = {};
        }

        const porRemetente: Record<string, any[]> = {};
        (data || []).forEach((msg: any) => {
          if (!msg.sender_id || msg.sender_id === user.id) return;
          if (!porRemetente[msg.sender_id]) porRemetente[msg.sender_id] = [];
          porRemetente[msg.sender_id].push(msg);
        });

        let total = 0;
        Object.entries(porRemetente).forEach(([senderId, recebidas]) => {
          const lastSeenId = seenMap[senderId];
          if (!lastSeenId) {
            total += recebidas.length;
            return;
          }

          const indiceVista = recebidas.findIndex((msg: any) => msg.id === lastSeenId);
          total += indiceVista === -1 ? recebidas.length : indiceVista;
        });

        setUnreadChatCount(total);
      } catch (error) {
        console.warn("Falha ao calcular mensagens não lidas:", error);
      }
    })();

    unreadChatRequestRef.current = request;
    return request.finally(() => {
      if (unreadChatRequestRef.current === request) unreadChatRequestRef.current = null;
    });
  };

  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const { toasts, addToast, removeToast } = useNotifications();

  // Dark mode removido - garantir que a classe dark nunca seja aplicada
  useEffect(() => { document.documentElement.classList.remove("dark"); }, []);

  const [isSyncing, setIsSyncing] = useState(false);
  const refreshRecordsRequestRef = React.useRef<Promise<void> | null>(null);

  const loadApprovalData = async () => {
    try {
      let configData: any[] | null = null;
      try {
        const configRes = await requisicaoApi(ROTAS_API.WORKFLOW_CONFIG);
        if (configRes.ok) {
          configData = await configRes.json();
        }
      } catch (err) {
        console.warn("API de config indisponível, tentando Supabase direto:", err);
      }

      if (!configData) {
        const { data: dbConfigData } = await supabase
          .from(TABELAS_SUPABASE.CONFIGURACAO_APROVACAO)
          .select("*")
          .order("step_number");
        configData = dbConfigData;
      }

      const FIXED_NAMES = NOMES_ETAPAS_CURTOS;

      if (configData && configData.length > 0) {
        setApprovalConfig({
          steps: configData.map((c: any) => ({
            stepNumber: c.step_number,
            roleName: FIXED_NAMES[c.step_number] || c.role_name || `Etapa ${c.step_number}`,
            userId: c.assigned_user_id,
            userName: c.assigned_user_name,
            isOpinionOnly: c.is_opinion_only || false,
          }))
        });
      }

      let wfData: any[] | null = null;
      try {
        const listRes = await requisicaoApi(ROTAS_API.WORKFLOW_LIST);
        if (listRes.ok) {
          wfData = await listRes.json();
        }
      } catch (err) {
        console.warn("API de workflows indisponível, tentando Supabase direto:", err);
      }

      if (!wfData) {
        // Obter do supabase diretamente
        const { data: dbWf } = await supabase
          .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
          .select(`*, ${RELACOES_SUPABASE.ETAPAS_DO_FLUXO}`);
        
        if (!dbWf || dbWf.length === 0 || dbWf[0].steps === undefined) {
          const { data: rawWfs } = await supabase.from(TABELAS_SUPABASE.FLUXOS_APROVACAO).select("*");
          const { data: rawSteps } = await supabase.from(TABELAS_SUPABASE.ETAPAS_APROVACAO).select("*");
          if (rawWfs) {
            wfData = rawWfs.map(w => ({
              ...w,
              steps: (rawSteps || []).filter((s: any) => s.workflow_id === w.id)
            }));
          }
        } else {
          wfData = dbWf;
        }
      }

      if (wfData) {
        setWorkflows(wfData.map((wf: any) => ({
          iaRecordId: wf.ia_record_id,
          currentStep: wf.current_step,
          finalStatus: wf.final_status,
          completedAt: wf.completed_at,
          steps: (wf.steps || []).map((s: any) => ({
            stepNumber: s.step_number,
            roleName: FIXED_NAMES[s.step_number] || s.role_name || `Etapa ${s.step_number}`,
            assignedUserId: s.assigned_user_id,
            assignedUserName: s.assigned_user_name,
            status: s.status,
            comment: s.comment,
            decidedAt: s.decided_at,
            isOpinionOnly: s.is_opinion_only,
          }))
        })));
      }
    } catch (e) {
      console.warn("Erro ao carregar dados de aprovação:", e);
    }
  };

  const refreshRecords = () => {
    if (refreshRecordsRequestRef.current) return refreshRecordsRequestRef.current;

    const request = (async () => {
      setIsSyncing(true);
      try {
        const isOnline = await checkSupabaseStatus();
        setSupabaseStatus(isOnline ? "online" : "offline");
      
        const isAdmin = usuarioEhAdmin(profile);
        const isModerator = usuarioEhModerador(profile);
        const isPrivileged = isAdmin || isModerator;
      
        const data = await getRecords(user?.id, isPrivileged, profile?.setor, profile?.role);
        setRecords(data);
      
        // Sempre buscar perfis para que o chat e outros componentes tenham os dados correspondentes
        const usersData = await getProfiles();
        if (isPrivileged) {
          setProfiles(usersData);
        } else {
          const userSector = profile?.setor?.toLowerCase().trim();
          const filteredUsers = usersData.filter(p => {
            const isUserAdmin = usuarioEhAdmin(p);
            const isSameSector = p.setor && userSector && p.setor.toLowerCase().trim() === userSector;
            return isUserAdmin || isSameSector;
          });
          setProfiles(filteredUsers);
        }

        // Carregar dados de conformidade e fluxos ativos de aprovação
        await loadApprovalData();
      } catch (error) {
        console.error("Erro ao atualizar registros:", error);
      } finally {
        setIsSyncing(false);
      }
    })();

    refreshRecordsRequestRef.current = request;
    return request.finally(() => {
      if (refreshRecordsRequestRef.current === request) refreshRecordsRequestRef.current = null;
    });
  };

  useEffect(() => {
    if (user?.id && profile) refreshRecords();
  }, [user?.id, profile?.role, profile?.setor]);

  useEffect(() => {
    if (!user?.id) return;

    const updatePresence = async () => {
      try {
        await updateUserProfile(user.id, { last_seen: new Date().toISOString() });
      } catch (e) {
        console.warn("Falha no heartbeat de presença:", e);
      }
    };

    updatePresence();
    const interval = window.setInterval(updatePresence, 60000);

    return () => {
      window.clearInterval(interval);
    };
  }, [user?.id]);

  useEffect(() => {
    const handleOnline = () => setSupabaseStatus("online");
    const handleOffline = () => setSupabaseStatus("offline");
    
    // Set initial status based on browser connectivity
    if (navigator.onLine) {
      setSupabaseStatus("online");
    } else {
      setSupabaseStatus("offline");
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Refs to always keep current values inside real-time event listeners
  const activeTabRef = React.useRef(activeTab);
  const profileRef = React.useRef(profile);
  const profilesRef = React.useRef(profiles);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  useEffect(() => {
    if (!user?.id) return;

    refreshUnreadChatCount();
    const handleChatSeen = () => refreshUnreadChatCount();
    window.addEventListener(EVENTOS_APLICACAO.CHAT_LEITURA_ATUALIZADA, handleChatSeen);

    return () => {
      window.removeEventListener(EVENTOS_APLICACAO.CHAT_LEITURA_ATUALIZADA, handleChatSeen);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;

    // 1. Escutador de novas mensagens no chat
    const messageChannel = supabase
      .channel("global-chat-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: TABELAS_SUPABASE.MENSAGENS },
        async (payload) => {
          const msg = payload.new as any;
          if (!msg || msg.sender_id === user.id) return;

          if (msg.recipient_id === user.id) {
            refreshUnreadChatCount();
          }

          const currentTab = activeTabRef.current;
          let shouldNotify = false;

          if (currentTab !== "chat") {
            // Se não está no chat, notifica sobre mensagens públicas ou privadas direcionadas para si
            if (!msg.is_private) {
              shouldNotify = true;
            } else if (msg.recipient_id === user.id) {
              shouldNotify = true;
            }
          } else {
            // Se está na tela do chat, notifica apenas se for mensagem privada direcionada e o remetente não for o chat ativo atual
            if (msg.is_private && msg.recipient_id === user.id) {
              const activeChatWith = localStorage.getItem(CHAVES_ARMAZENAMENTO_LOCAL.CHAT_ATIVO_COM);
              if (activeChatWith !== msg.sender_id) {
                shouldNotify = true;
              }
            }
          }

          if (shouldNotify) {
            try {
              const cachedSender = profilesRef.current.find((item) => item.id === msg.sender_id);
              let senderName = cachedSender?.full_name;

              if (!senderName) {
                const { data: senderProf } = await supabase
                  .from(TABELAS_SUPABASE.PERFIS)
                  .select("full_name")
                  .eq("id", msg.sender_id)
                  .single();
                senderName = senderProf?.full_name;
              }

              addToast({
                title: `Chat: ${senderName || "Colega"}`,
                message: msg.content.length > 60 ? `${msg.content.slice(0, 60)}...` : msg.content,
                type: "chat",
                actionLabel: "Ver Mensagem",
                onAction: () => {
                  sessionStorage.setItem(CHAVES_ARMAZENAMENTO_LOCAL.CHAT_ALVO_NOTIFICACAO, msg.sender_id);
                  setActiveTab("chat");
                  window.setTimeout(() => {
                    window.dispatchEvent(new CustomEvent(EVENTOS_APLICACAO.CHAT_ABRIR_CONVERSA, {
                      detail: { userId: msg.sender_id },
                    }));
                  }, 0);
                }
              });
            } catch (err) {
              console.error("Erro ao buscar remetente:", err);
            }
          }
        }
      )
      .subscribe();

    // 2. Escutador de avaliações de IA de interesse
    const recordChannel = supabase
      .channel("global-records-notifications")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: TABELAS_SUPABASE.REGISTROS_IA },
        async (payload) => {
          const recordRaw = payload.new as any;
          if (!recordRaw || !recordRaw.data) return;

          const updatedRec = recordRaw.data as IARecord;
          updatedRec.id = recordRaw.id; // Garante ID correto

          setRecords(prevRecords => {
            const oldRec = prevRecords.find(r => r.id === updatedRec.id);
            if (oldRec) {
              const statusAuditoriaChanged = oldRec.statusAuditoria !== updatedRec.statusAuditoria;
              const statusUsoChanged = oldRec.statusUso !== updatedRec.statusUso;

              if (statusAuditoriaChanged || statusUsoChanged) {
                const currentProfile = profileRef.current;
                
                // Notificar se a IA editada pertence ao mesmo setor do usuário
                const isRelevantForMe = 
                  updatedRec.unidadeSetor?.toLowerCase().trim() === currentProfile?.setor?.toLowerCase().trim();

                const isUpdatedByMe = usuarioEhAdmin(currentProfile) && 
                  (activeTabRef.current === "admin" || activeTabRef.current === "sectors");

                if (isRelevantForMe && !isUpdatedByMe) {
                  let text = "";
                  if (statusAuditoriaChanged && statusUsoChanged) {
                    text = `Auditoria: "${updatedRec.statusAuditoria}" e Uso: "${updatedRec.statusUso}".`;
                  } else if (statusAuditoriaChanged) {
                    text = `Auditoria atualizada para "${updatedRec.statusAuditoria}".`;
                  } else {
                    text = `Status de uso atualizado para "${updatedRec.statusUso}".`;
                  }

                  setTimeout(() => {
                    addToast({
                      title: `IA Avaliada: ${updatedRec.nomeFerramenta}`,
                      message: text,
                      type: updatedRec.statusAuditoria === StatusAuditoria.APROVADO ? "success" : "info",
                      actionLabel: "Analisar",
                      onAction: () => {
                        setSelectedRecord(updatedRec);
                        setActiveTab("report");
                      }
                    });
                  }, 50);
                }
              }
              return prevRecords.map(r => r.id === updatedRec.id ? updatedRec : r);
            }
            return prevRecords;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(recordChannel);
    };
  }, [user?.id]);

  const handleSync = async () => {
    if (supabaseStatus !== "online") {
      alert("Supabase está offline. Verifique suas chaves de API.");
      return;
    }
    
    setIsSyncing(true);
    try {
      console.log("Forçando sincronização manual...");
      const isAdmin = isCurrentUserAdmin;
      await saveRecordsToSupabase(records, user?.id, isAdmin);
      await refreshRecords();
      alert("✅ Sincronização concluída com sucesso!");
    } catch (error: any) {
      console.error("Erro na sincronização manual:", error);
      alert(`❌ Erro na sincronização: ${error.message || "Erro desconhecido"}. Verifique o SQL do Supabase.`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleEdit = (record: IARecord) => {
    setSelectedRecord(record);
    setActiveTab("new");
  };

  const handleView = (record: IARecord) => {
    setOriginTab(activeTab);
    setSelectedRecord(record);
    setActiveTab("report");
  };

  const handleDelete = async (id: string) => {
    // Optimistic update
    const previousRecords = [...records];
    setRecords(prev => prev.filter(r => r.id !== id));
    
    try {
      await deleteRecord(id);
      await refreshRecords();
      if (selectedRecord?.id === id) {
        setSelectedRecord(null);
      }
    } catch (error) {
      console.error("Erro ao excluir:", error);
      setRecords(previousRecords);
      alert("Houve um erro ao excluir o registro. Por favor, tente novamente.");
    }
  };

  const handleCancelRequest = async (recordId: string) => {
    try {
      const record = records.find(r => r.id === recordId);
      if (!record) {
        alert("Registro não encontrado.");
        return;
      }

      const now = new Date().toISOString();

      const updatedRecord: IARecord = {
        ...record,
        statusUso: StatusUso.CANCELADA,
        updatedAt: now,
        historico: [
          ...(record.historico || []),
          {
            date: now,
            action: "Solicitação cancelada pelo solicitante",
            user: profile?.full_name || user?.email || "Solicitante",
            message: "A solicitação foi cancelada diretamente pelo solicitante através do inventário."
          }
        ]
      };

      const { error: recordError } = await supabase
        .from(TABELAS_SUPABASE.REGISTROS_IA)
        .update({
          data: updatedRecord,
          status_uso: StatusUso.CANCELADA,
          updated_at: now
        })
        .eq("id", recordId);

      if (recordError) {
        throw recordError;
      }

      const { error: workflowError } = await supabase
        .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
        .update({
          final_status: "cancelado",
          completed_at: now
        })
        .eq("ia_record_id", recordId);

      if (workflowError) {
        console.warn("Aviso ao atualizar workflow cancelado:", workflowError);
      }

      await refreshRecords();

      alert("Solicitação cancelada com sucesso.");
    } catch (error) {
      console.error("Erro ao cancelar solicitação:", error);
      alert("Houve um erro ao cancelar a solicitação. Por favor, tente novamente.");
    }
  };

  const handleSave = async (record: IARecord) => {
    const isNew = !records.find(r => r.id === record.id);
    const isAdmin = isCurrentUserAdmin;
    
    try {
      if (isNew) {
        await addRecord(record, user?.id, isAdmin);
        // Criar workflow de aprovação automaticamente e de forma consistente no Backend com fallback se falhar conexao
        try {
          const { data, error: sessionErr } = await supabase.auth.getSession();
          if (sessionErr) throw new Error(sessionErr.message);
          const session = data?.session;
          if (!session?.access_token) {
            throw new Error("Sessão ou token de acesso de autenticação não encontrado.");
          }
          
          let success = false;
          try {
            const initRes = await requisicaoApi(ROTAS_API.WORKFLOW_INIT, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session.access_token}`
              },
              body: JSON.stringify({ recordId: record.id })
            });
            
            if (initRes.ok) {
              success = true;
            } else {
              const errBody = await initRes.json().catch(() => ({}));
              console.warn("Retorno de erro na inicialização do workflow:", errBody);
            }
          } catch (fetchErr) {
            console.warn("Falha de conexão com a API de inicialização de workflow. Usando fallback direto:", fetchErr);
          }

          if (!success) {
            // Callback direto no supabase
            const { data: existingWf } = await supabase
              .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
              .select("id, current_step, final_status")
              .eq("ia_record_id", record.id)
              .maybeSingle();

            let targetWf = existingWf;
            let needsSteps = false;

            if (existingWf) {
              const { data: existingSteps } = await supabase
                .from(TABELAS_SUPABASE.ETAPAS_APROVACAO)
                .select("id")
                .eq("workflow_id", existingWf.id);

              if (!existingSteps || existingSteps.length === 0) {
                needsSteps = true;
              }
            } else {
              const { data: newWf, error: newWfErr } = await supabase
                .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
                .insert({
                  ia_record_id: record.id,
                  current_step: 1,
                  final_status: "pendente",
                })
                .select("id, current_step, final_status")
                .single();

              if (newWfErr || !newWf) {
                throw new Error(`Não foi possível inicializar o fluxo de aprovação local: ${newWfErr?.message || "Erro desconhecido"}`);
              }
              targetWf = newWf;
              needsSteps = true;
            }

            if (needsSteps && targetWf) {
              const { data: configRows } = await supabase
                .from(TABELAS_SUPABASE.CONFIGURACAO_APROVACAO)
                .select("*")
                .order("step_number");

              const defaultSteps = ETAPAS_APROVACAO_OFICIAIS.map((etapa) => ({
                step_number: etapa.stepNumber,
                role_name: etapa.roleName,
                is_opinion_only: etapa.isOpinionOnly,
              }));

              const stepsToInsert = (configRows && configRows.length > 0)
                ? configRows.map((c: any) => ({
                    workflow_id: targetWf.id,
                    ia_record_id: record.id,
                    step_number: c.step_number,
                    role_name: c.role_name,
                    assigned_user_id: c.assigned_user_id || null,
                    assigned_user_name: c.assigned_user_name || null,
                    status: "aguardando",
                    comment: null,
                    is_opinion_only: c.is_opinion_only || false,
                    decided_at: null,
                  }))
                : defaultSteps.map(s => ({
                    workflow_id: targetWf.id,
                    ia_record_id: record.id,
                    step_number: s.step_number,
                    role_name: s.role_name,
                    assigned_user_id: null,
                    assigned_user_name: null,
                    status: "aguardando",
                    comment: null,
                    is_opinion_only: s.is_opinion_only,
                    decided_at: null,
                  }));

              await supabase.from(TABELAS_SUPABASE.ETAPAS_APROVACAO).insert(stepsToInsert);
            }

            // Atualizar status de uso para Em avaliação
            const { data: iaRecord } = await supabase
              .from(TABELAS_SUPABASE.REGISTROS_IA)
              .select("data")
              .eq("id", record.id)
              .single();

            if (iaRecord?.data) {
              const recordData = iaRecord.data as any;
              const updatedData = {
                ...recordData,
                statusUso: "Em avaliação",
              };

              await supabase
                .from(TABELAS_SUPABASE.REGISTROS_IA)
                .update({
                  data: updatedData,
                  status_uso: "Em avaliação",
                  updated_at: new Date().toISOString()
                })
                .eq("id", record.id);
            }
          }
        } catch (wfErr) {
          console.error("Erro ao criar workflow:", wfErr);
          throw wfErr;
        }
      } else {
        await updateRecord(record, user?.id, isAdmin);
      }
      await refreshRecords();
      setActiveTab("inventory");
      setSelectedRecord(null);
    } catch (error: any) {
      console.error("Erro ao salvar registro:", error);
      alert(`⚠️ Erro ao salvar: ${error.message || "Erro desconhecido"}. Verifique o console ou a estrutura do banco.`);
    }
  };

  const handleSaveApprovalConfig = async (config: ApprovalConfig) => {
    const stepsToSave = config.steps.map((step) => ({
      ...step,
      roleName: ETAPAS_APROVACAO_OFICIAIS.find((etapa) => etapa.stepNumber === step.stepNumber)?.roleName || step.roleName,
    }));

    try {
      const response = await requisicaoApi(ROTAS_API.WORKFLOW_CONFIG, {
        method: "PUT",
        body: JSON.stringify({ steps: stepsToSave }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.mensagem || "Não foi possível salvar os responsáveis do fluxo.");
      }

      const savedRows = Array.isArray(payload) ? payload : [];
      const persistedConfig: ApprovalConfig = {
        steps: savedRows.length > 0
          ? savedRows.map((row: any) => ({
              stepNumber: Number(row.step_number),
              roleName: NOMES_ETAPAS_CURTOS[Number(row.step_number)] || row.role_name,
              userId: row.assigned_user_id || undefined,
              userName: row.assigned_user_name || undefined,
              isOpinionOnly: Boolean(row.is_opinion_only),
            }))
          : config.steps,
      };

      // A tela passa a refletir exatamente o que foi persistido no banco.
      setApprovalConfig(persistedConfig);
      await loadApprovalData();
    } catch (e) {
      console.error("Erro ao salvar config de aprovação:", e);
      throw e;
    }
  };

  const handleUpdateStatus = async (recordId: string, status: any, comment?: string, extraFields?: any) => {
    const record = records.find(r => r.id === recordId);
    if (!record) return;

    // Verificar se o usuário atual é o responsável designado para a etapa atual, um admin ou moderador
    const wf = workflows.find(w => w.iaRecordId === recordId);
    const currentStepNum = wf ? wf.currentStep : 1;
    const configStep = approvalConfig?.steps?.find(s => s.stepNumber === currentStepNum);
    const wfStep = wf?.steps?.find(s => s.stepNumber === currentStepNum);
    const assignedUserId = configStep?.userId || wfStep?.assignedUserId;

    const isAssignedToMe = assignedUserId === user?.id;

    if (!assignedUserId) {
      alert("Esta etapa ainda não possui responsável definido. Configure o fluxo antes de aprovar ou negar.");
      return;
    }

    if (!isAssignedToMe) {
      alert("Apenas o responsável designado para esta etapa pode aprovar ou negar.");
      return;
    }

    const decision = status === StatusAuditoria.APROVADO ? "aprovado" : "negado";

    try {
      const { data, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) {
        throw new Error(`Erro ao recuperar sessão: ${sessionErr.message}`);
      }
      const session = data?.session;
      
      let success = false;
      let result: any = null;

      try {
        const response = await requisicaoApi(ROTAS_API.WORKFLOW_DECIDE, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({ recordId, decision, comment, coordinatorData: extraFields })
        });

        if (response.ok) {
          result = await response.json();
          success = true;
        } else {
          const errRes = await response.json().catch(() => ({}));
          console.warn("O servidor retornou erro na decisão:", errRes);
          if (errRes.error) {
            alert(`⚠️ ${errRes.error}`);
            return;
          }
        }
      } catch (err) {
        console.warn("Falha de conexão com a API de decisão do workflow. Iniciando fallback local no Supabase:", err);
        if (currentStepNum === 2) {
          throw new Error("A Etapa 2 — TI exige conexão com o backend para validar se existem perguntas aguardando resposta. Tente novamente quando a API estiver disponível.");
        }
      }

      if (!success) {
        const wfData = await supabase
          .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
          .select("id, current_step, final_status")
          .eq("ia_record_id", recordId)
          .maybeSingle();

        let activeWf = wfData.data;
        if (!activeWf) {
          throw new Error("Workflow ativo não encontrado no Supabase.");
        }

        const { data: stepRow } = await supabase
          .from(TABELAS_SUPABASE.ETAPAS_APROVACAO)
          .select("id, is_opinion_only, assigned_user_id, assigned_user_name")
          .eq("workflow_id", activeWf.id)
          .eq("step_number", activeWf.current_step)
          .maybeSingle();

        if (!stepRow) {
          throw new Error("Etapa do fluxo não encontrada diretamente no banco.");
        }

        const decisionStatus = decision === "aprovado" ? "aprovado" : "negado";
        const fullName = (session?.user as any)?.user_metadata?.full_name || session?.user?.email || "Avaliador";

        await supabase
          .from(TABELAS_SUPABASE.ETAPAS_APROVACAO)
          .update({
            status: decisionStatus,
            comment: comment || null,
            decided_at: new Date().toISOString(),
            assigned_user_id: stepRow.assigned_user_id || user?.id,
            assigned_user_name: stepRow.assigned_user_name || fullName,
          })
          .eq("id", stepRow.id);

        const { data: allSteps } = await supabase
          .from(TABELAS_SUPABASE.ETAPAS_APROVACAO)
          .select("step_number")
          .eq("workflow_id", activeWf.id);

        const stepNumbers = (allSteps || []).map((step: any) => Number(step.step_number));
        const maxStep = stepNumbers.length > 0 ? Math.max(...stepNumbers) : 5;

        const currentStepNumber = Number(activeWf.current_step);
        const nextStep = currentStepNumber + 1;
        const isFinalStep = currentStepNumber === maxStep;
        const isFinancialStep = currentStepNumber === maxStep || configStep?.roleName === NOME_ETAPA_FINANCEIRA;

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

          if (nextStep >= 4) {
            newStatusUso = "Em teste/piloto";
          } else {
            newStatusUso = "Em avaliação";
          }

          workflowUpdatePayload = {
            current_step: nextStep,
            final_status: "pendente"
          };
        }

        await supabase
          .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
          .update(workflowUpdatePayload)
          .eq("id", activeWf.id);

        const { data: iaRecord } = await supabase
          .from(TABELAS_SUPABASE.REGISTROS_IA)
          .select("data")
          .eq("id", recordId)
          .single();

        if (iaRecord?.data) {
          const recordData = iaRecord.data as any;
          let actionLabel = decision === "aprovado"
            ? `Etapa ${currentStepNumber}/${maxStep} aprovada por ${fullName}`
            : `Etapa ${currentStepNumber}/${maxStep} negada por ${fullName}`;

          if (decision === "negado" && isFinancialStep) {
            actionLabel = `Direção Financeira: parecer desfavorável. Fluxo concluído com aprovação da Presidência.`;
          }

          const updatedData = {
            ...recordData,
            ...(extraFields || {}),
            statusAuditoria: newAuditStatus,
            statusUso: newStatusUso,
            observacoesGeraisOriginais: recordData.observacoesGeraisOriginais || recordData.observacoesGerais || "",
            historico: [{
              date: new Date().toISOString(),
              user: fullName,
              action: actionLabel,
              message: comment || actionLabel
            }, ...(recordData.historico || [])]
          };

          const updatePayload: any = {
            data: updatedData,
            status_uso: newStatusUso,
          };

          const currentDateStr = new Date().toISOString().split("T")[0];

          if (decision === "negado" && isFinancialStep) {
            updatePayload.status_uso = "Aprovado";
            updatedData.statusUso = "Aprovado";
            updatedData.statusAuditoria = "Aprovado";
            updatePayload.observacoes_gerais = comment || "Direção Financeira: parecer desfavorável. Fluxo concluído com aprovação da Presidência.";
          } else if (decision === "negado") {
            updatePayload.status_uso = "Não aprovado";
            updatePayload.parecer_tecnico = "IA indeferida no fluxo de aprovacão.";
            updatePayload.data_aprovacao = currentDateStr;
            if (comment) {
              updatePayload.observacoes_gerais = comment;
            }

            updatedData.statusUso = "Não aprovado";
            updatedData.statusAuditoria = "Negado";
            updatedData.parecerTecnico = "IA indeferida no fluxo de aprovação.";
            updatedData.dataAprovacao = currentDateStr;
          } else if (decision === "aprovado" && isFinalStep) {
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

          await supabase
            .from(TABELAS_SUPABASE.REGISTROS_IA)
            .update(updatePayload)
            .eq("id", recordId);
        }

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

        result = {
          finalStatus,
          message: responseMessage
        };
      }

      const newAuditStatus = result.finalStatus === "aprovado" 
        ? StatusAuditoria.APROVADO 
        : result.finalStatus === "negado" 
          ? StatusAuditoria.NEGADO 
          : StatusAuditoria.PENDENTE;

      const newStatusUso = result.finalStatus === "aprovado"
        ? StatusUso.APROVADO
        : result.finalStatus === "negado"
          ? StatusUso.NAO_APROVADO
          : StatusUso.EM_AVALIACAO;

      const updatedRecord = {
        ...record,
        statusAuditoria: newAuditStatus,
        statusUso: newStatusUso,
      };

      setRecords(prev => prev.map(r => r.id === recordId ? updatedRecord : r));

      if (result.finalStatus === "aprovado") {
        addToast({ title: "IA Aprovada!", message: result.message, type: "success" });
      } else if (result.finalStatus === "negado") {
        addToast({ title: "IA Indeferida", message: result.message, type: "warning" });
      } else {
        addToast({ title: "Etapa Concluída", message: result.message, type: "info" });
      }

      await refreshRecords();
    } catch (error: any) {
      console.error("Erro ao atualizar status:", error);
      alert(`⚠️ Erro ao atualizar status: ${error.message || "Erro de conexão com o servidor"}`);
      await refreshRecords();
    }
  };

  const handleResetStatus = async (recordId: string, newStatus: StatusUso, reason: string) => {
    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) {
        throw new Error(`Erro ao recuperar sessão: ${sessionErr.message}`);
      }
      const session = sessionData?.session;

      let apiSuccess = false;
      if (session?.access_token) {
        const res = await requisicaoApi(ROTAS_API.WORKFLOW_RESET_STATUS, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ recordId, newStatus, reason })
        });
        if (res.ok) {
          apiSuccess = true;
        } else {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Erro HTTP ${res.status} ao redefinir status.`);
        }
      }

      if (!apiSuccess) {
        // Fallback local via Supabase diretamente
        const { data: iaRecord, error: fetchErr } = await supabase
          .from(TABELAS_SUPABASE.REGISTROS_IA)
          .select("*")
          .eq("id", recordId)
          .single();

        if (fetchErr || !iaRecord) {
          throw new Error(fetchErr?.message || "Registro de IA não encontrado");
        }

        const recordData = iaRecord.data ? { ...iaRecord.data } : {};
        const fullName = (session?.user as any)?.user_metadata?.full_name || session?.user?.email || "Usuário";
        const now = new Date().toISOString();

        let newAuditStatus = StatusAuditoria.PENDENTE;
        if (newStatus === StatusUso.APROVADO || newStatus === StatusUso.APROVADO_COM_RESTRICOES) {
          newAuditStatus = StatusAuditoria.APROVADO;
        } else if (newStatus === StatusUso.NAO_APROVADO || newStatus === StatusUso.SUSPENSO) {
          newAuditStatus = StatusAuditoria.NEGADO;
        }

        const updatedRecord = {
          ...recordData,
          statusUso: newStatus,
          statusAuditoria: newAuditStatus,
          dataAprovacao: null,
          parecerTecnico: "",
          parecerTI: "",
          parecerDiretoria: "",
          parecerPresidencia: "",
          etapasAprovacao: [],
          updatedAt: now,
          historico: [
            ...(recordData.historico || []),
            {
              date: now,
              action: "Status redefinido",
              user: fullName,
              message: `Status alterado para "${newStatus}". Justificativa: ${reason}`
            }
          ]
        };

        // 1. Atualizar ia_records
        const { error: updateErr } = await supabase
          .from(TABELAS_SUPABASE.REGISTROS_IA)
          .update({
            data: updatedRecord,
            status_uso: newStatus,
            status: newAuditStatus,
            updated_at: now
          })
          .eq("id", recordId);

        if (updateErr) {
          await supabase
            .from(TABELAS_SUPABASE.REGISTROS_IA)
            .update({
              data: updatedRecord,
              status_uso: newStatus,
              updated_at: now
            })
            .eq("id", recordId);
        }

        let targetFinalStatus = "pendente";
        if (newAuditStatus === StatusAuditoria.APROVADO) {
          targetFinalStatus = "aprovado";
        } else if (newAuditStatus === StatusAuditoria.NEGADO) {
          targetFinalStatus = "negado";
        }

        // 2. Reiniciar approval_workflows e approval_steps
        const { data: wfs } = await supabase
          .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
          .select("id")
          .eq("ia_record_id", recordId);

        if (wfs && wfs.length > 0) {
          const wfIds = wfs.map(w => w.id);
          // Voltar workflows para a etapa 1 e status correto
          await supabase
            .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
            .update({
              current_step: 1,
              final_status: targetFinalStatus,
              completed_at: targetFinalStatus === "pendente" ? null : new Date().toISOString()
            })
            .in("id", wfIds);

          // Resetar TODAS as etapas para 'aguardando' e limpar os comentários/decisões anteriores
          await supabase
            .from(TABELAS_SUPABASE.ETAPAS_APROVACAO)
            .update({
              status: "aguardando",
              comment: null,
              decided_at: null
            })
            .in("workflow_id", wfIds);
        } else {
          // Criar workflow do zero se não existia
          const { data: newWf } = await supabase
            .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
            .insert({
              ia_record_id: recordId,
              current_step: 1,
              final_status: targetFinalStatus
            })
            .select("id")
            .single();

          if (newWf) {
            const { data: configRows } = await supabase
              .from(TABELAS_SUPABASE.CONFIGURACAO_APROVACAO)
              .select("*")
              .order("step_number");

            const defaultSteps = ETAPAS_APROVACAO_OFICIAIS.map((etapa) => ({
              step_number: etapa.stepNumber,
              role_name: etapa.roleName,
              is_opinion_only: etapa.isOpinionOnly,
            }));

            const stepsToInsert = (configRows && configRows.length > 0)
              ? configRows.map((c: any) => ({
                  workflow_id: newWf.id,
                  ia_record_id: recordId,
                  step_number: c.step_number,
                  role_name: c.role_name,
                  assigned_user_id: c.assigned_user_id || null,
                  assigned_user_name: c.assigned_user_name || null,
                  status: "aguardando",
                  comment: null,
                  is_opinion_only: c.is_opinion_only || false,
                  decided_at: null,
                }))
              : defaultSteps.map(s => ({
                  workflow_id: newWf.id,
                  ia_record_id: recordId,
                  step_number: s.step_number,
                  role_name: s.role_name,
                  assigned_user_id: null,
                  assigned_user_name: null,
                  status: "aguardando",
                  comment: null,
                  is_opinion_only: s.is_opinion_only,
                  decided_at: null,
                }));

            await supabase.from(TABELAS_SUPABASE.ETAPAS_APROVACAO).insert(stepsToInsert);
          }
        }
      }

      addToast({ 
        title: "Status Redefinido", 
        message: "Status e todas as etapas de aprovação foram redefinidos com sucesso.", 
        type: "success" 
      });

      await refreshRecords();
    } catch (error: any) {
      console.error("Erro ao redefinir status:", error);
      alert(`Erro: ${error.message || "Erro desconhecido ao redefinir status"}`);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: "admin" | "moderator" | "user") => {
    // Check if it's a real GUID/UUID (Fallback names are not UUIDs)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    
    if (!isUuid) {
      alert(`⚠️ Não foi possível atualizar: Este usuário ainda não possui uma conta de acesso ao sistema (perfil incompleto). Apenas usuários que já fizeram login pelo menos uma vez podem ser tornados administradores.`);
      return;
    }

    // Guard against self-demotion to avoid losing access to admin panel accidentally
    if (userId === user?.id && newRole === "user") {
      const confirmSelf = window.confirm("⚠️ Você está prestes a remover seus próprios privilégios de administrador. Você perderá acesso a este painel. Deseja continuar?");
      if (!confirmSelf) return;
    }

    // Optimistic update
    const previousProfiles = [...profiles];
    setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole } : p));

    try {
      console.log(`🚀 Solicitando alteração de cargo para usuário ${userId} para: ${newRole}`);
      
      // Get the session token for authentication
      const { data, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) {
        throw new Error(`Erro ao recuperar sessão: ${sessionErr.message}`);
      }
      const session = data?.session;
      
      const response = await requisicaoApi(ROTAS_API.ADMIN_ATUALIZAR_ROLE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ userId, newRole })
      });

      let result;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        result = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Erro do servidor (${response.status}): O servidor não retornou JSON. Verifique se as rotas de API estão configuradas.`);
      }

      if (!response.ok) {
        throw new Error(result.error || "Falha na comunicação com o servidor");
      }
      
      if (result.success && result.profile) {
        console.log(`✅ Alteração persistida via API para ${userId}`);
        setProfiles(prev => prev.map(p => p.id === userId ? result.profile : p));
      } else {
        throw new Error("Resposta inesperada do servidor.");
      }
      
      // Full refresh to ensure consistency across all data
      if (userId === user?.id) {
        await refreshProfile();
      }
      await refreshRecords();
      const roleLabel = newRole === "admin" ? "ADMINISTRADOR" : newRole === "moderator" ? "MODERADOR" : "USUÁRIO COMUM";
      alert(`✅ Sucesso! O usuário agora tem acesso de ${roleLabel}.`);
    } catch (error: any) {
      console.error("❌ Erro fatal ao atualizar role do usuário:", error);
      // Rollback
      setProfiles(previousProfiles);
      alert(`Erro: ${error.message || "Erro desconhecido ao atualizar permissões"}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const { data, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) {
        throw new Error(`Erro ao recuperar sessão: ${sessionErr.message}`);
      }
      const session = data?.session;
      const response = await requisicaoApi(ROTAS_API.ADMIN_EXCLUIR_USUARIO, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ userId })
      });

      let result;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        result = await response.json();
      } else {
        await response.text(); // consume body anyway
        throw new Error(`Erro do servidor (${response.status}). Verifique se as rotas de API do backend estão ativas no ambiente de produção.`);
      }

      if (!response.ok) {
        throw new Error(result.error || "Falha ao apagar usuário");
      }

      setProfiles(prev => prev.filter(p => p.id !== userId));
      alert("✅ Usuário apagado com sucesso.");
    } catch (error: any) {
      console.error("Erro ao apagar usuário:", error);
      alert(`⚠️ Erro ao apagar: ${error.message}`);
    }
  };
  return {
    user,
    profile,
    authLoading,
    isCurrentUserAdmin,
    isCurrentUserPrivileged,
    activeTab,
    setActiveTab,
    records,
    workflows,
    approvalConfig,
    profiles,
    supabaseStatus,
    selectedRecord,
    setSelectedRecord,
    originTab,
    isSidebarOpen,
    setIsSidebarOpen,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    isDarkMode,
    triggerAlertsRefresh,
    systemAlerts,
    activeUnreadAlertsCount,
    unreadChatCount,
    toasts,
    removeToast,
    isSyncing,
    handleSync,
    handleEdit,
    handleView,
    handleDelete,
    handleCancelRequest,
    handleSave,
    handleSaveApprovalConfig,
    handleUpdateStatus,
    handleResetStatus,
    handleUpdateUserRole,
    handleDeleteUser,
    refreshRecords,
    signOut,
  };
}
