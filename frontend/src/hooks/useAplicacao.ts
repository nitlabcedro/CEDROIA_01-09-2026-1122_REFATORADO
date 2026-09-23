import { ROTAS_API, rotaExcluirRegistro } from "@/constantes/api";
import {
  INTERVALO_HEARTBEAT_PRESENCA_MS,
  registrarPollingComVisibilidade,
} from "@/utilitarios/polling-visibilidade";
import { usuarioEhAdmin, usuarioEhModerador, usuarioEhPrivilegiado } from "@/utilitarios/permissoes";
import { ABAS_APLICACAO, ROTA_REDEFINIR_SENHA, type AbaAplicacao } from "@/constantes/navegacao";
import { RELACOES_SUPABASE, TABELAS_SUPABASE } from "@/constantes/supabase";
import { ETAPAS_APROVACAO_OFICIAIS, NOMES_ETAPAS_CURTOS, criarConfiguracaoAprovacaoPadrao } from "@/constantes/fluxo-aprovacao";
import { CHAVES_ARMAZENAMENTO_LOCAL, EVENTOS_APLICACAO } from "@/constantes/armazenamento-local";
import React, { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/contextos/ContextoAutenticacao";
import { requisicaoApi } from "@/servicos/api";
import {
  addRecord,
  checkSupabaseStatus,
  getProfiles,
  seedProfilesCache,
  getRecords,
  updateRecord,
  updateUserProfile,
} from "@/servicos/armazenamento";
import {
  calcularTotalMensagensNaoLidas,
  LIMITE_MENSAGENS_CONTAGEM_BADGE,
  mensagemIncrementaBadgeGlobal,
  obterMapaVistoChat,
} from "@/servicos/chat-contagem-nao-lidas";
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
import type { AtribuicaoCadastro } from "@/utilitarios/cadastro-usuario";
import {
  criarUrlNavegacao,
  interpretarUrlNavegacao,
  urlsNavegacaoIguais,
  type ResultadoUrlNavegacao,
} from "@/utilitarios/navegacao";
import {
  criarEstadoHistoricoCedroIA,
  ehEstadoHistoricoCedroIA,
  entradaPrivadaDeSessaoEncerrada,
  obterDirecaoHistorico,
  obterOuCriarIdSessaoNavegacao,
  podeContinuarSaltandoHistorico,
  rotaPrivadaBloqueada,
} from "@/utilitarios/historico-navegacao";
import {
  criarAtualizacaoCoordenada,
  criarControleRespostaRecente,
} from "@/utilitarios/atualizacao-coordenada";
import { obterMensagemErroUsuario } from "@/utilitarios/mensagens-erro";
import { aplicarPapelNaListaPerfis } from "@/utilitarios/perfil-usuario";
import {
  decidirAtualizacaoWorkflows,
  encontrarWorkflowDoRegistro,
  mesclarEtapasEmFluxos,
  normalizarListaWorkflows,
} from "@/utilitarios/workflows-aprovacao";
import { useNotifications } from "./useNotificacoes";

export interface OpcoesNavegarPara {
  registro?: IARecord | null;
  registroId?: string | null;
  substituir?: boolean;
}

export type NavegarPara = (destino: AbaAplicacao, opcoes?: OpcoesNavegarPara) => void;

const ABAS_SOMENTE_ADMIN = new Set<AbaAplicacao>(["sectors", "sectors_mgr"]);
const ABAS_PRIVILEGIADAS = new Set<AbaAplicacao>(["approval_queue", "admin"]);

function abaAplicacaoValida(valor: string | null): valor is AbaAplicacao {
  return Boolean(valor && (ABAS_APLICACAO as readonly string[]).includes(valor));
}

function abaPermitida(
  aba: AbaAplicacao,
  isAdmin: boolean,
  isPrivileged: boolean,
): boolean {
  if (ABAS_SOMENTE_ADMIN.has(aba)) return isAdmin;
  if (ABAS_PRIVILEGIADAS.has(aba)) return isPrivileged;
  return true;
}

export function useAplicacao() {
  const {
    user: usuarioSessao,
    profile: perfilSessao,
    loading: authLoading,
    recuperacaoSenhaEmAndamento,
    refreshProfile,
    signOut,
  } = useAuth();
  const user = recuperacaoSenhaEmAndamento ? null : usuarioSessao;
  const profile = recuperacaoSenhaEmAndamento ? null : perfilSessao;
  const isCurrentUserAdmin = usuarioEhAdmin(profile);
  const isCurrentUserModerator = usuarioEhModerador(profile);
  const isCurrentUserPrivileged = usuarioEhPrivilegiado(profile);
  const rotaInicialRef = React.useRef<ResultadoUrlNavegacao | null>(null);
  if (!rotaInicialRef.current) {
    rotaInicialRef.current = interpretarUrlNavegacao(
      window.location.pathname,
      window.location.search,
    );
  }
  const rotaInicial = rotaInicialRef.current;
  const abaSalva = localStorage.getItem(CHAVES_ARMAZENAMENTO_LOCAL.ABA_ATIVA);
  const abaInicial = rotaInicial.tipo === "aba"
    ? rotaInicial.aba
    : rotaInicial.tipo === "raiz" && abaAplicacaoValida(abaSalva)
      ? abaSalva
      : "dashboard";
  const registroIdInicial = rotaInicial.tipo === "aba" && rotaInicial.registroId
    ? rotaInicial.registroId
    : rotaInicial.tipo === "raiz" && (abaInicial === "report" || abaInicial === "new")
      ? localStorage.getItem(CHAVES_ARMAZENAMENTO_LOCAL.REGISTRO_SELECIONADO)
      : null;

  const [activeTab, setActiveTabInterna] = useState<AbaAplicacao>(abaInicial);
  const [records, setRecords] = useState<IARecord[]>([]);
  const [recordsCarregados, setRecordsCarregados] = useState(false);
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
  const [approvalConfig, setApprovalConfig] = useState<ApprovalConfig>(() => criarConfiguracaoAprovacaoPadrao());
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [profilesCatalog, setProfilesCatalog] = useState<UserProfile[]>([]);
  const [supabaseStatus, setSupabaseStatus] = useState<"online" | "offline" | "checking">("checking");
  const [selectedRecord, setSelectedRecord] = useState<IARecord | null>(null);
  const [registroIdNavegacao, setRegistroIdNavegacao] = useState<string | null>(registroIdInicial);
  const [originTab, setOriginTab] = useState<AbaAplicacao | null>("inventory");
  const activeTabRef = React.useRef(activeTab);
  const recordsRef = React.useRef(records);
  const userRef = React.useRef(user);
  const recuperacaoSenhaRef = React.useRef(recuperacaoSenhaEmAndamento);
  const sessionNavigationIdRef = React.useRef<string | null>(null);
  const navigationIndexRef = React.useRef(
    ehEstadoHistoricoCedroIA(window.history.state)
      ? window.history.state.navigationIndex
      : 0,
  );
  const permissoesRef = React.useRef({
    isAdmin: isCurrentUserAdmin,
    isPrivileged: isCurrentUserPrivileged,
  });

  activeTabRef.current = activeTab;
  recordsRef.current = records;
  userRef.current = user;
  recuperacaoSenhaRef.current = recuperacaoSenhaEmAndamento;
  permissoesRef.current = {
    isAdmin: isCurrentUserAdmin,
    isPrivileged: isCurrentUserPrivileged,
  };

  const aplicarAbaSemHistorico = React.useCallback((
    aba: AbaAplicacao,
    registroId?: string | null,
  ) => {
    activeTabRef.current = aba;
    setActiveTabInterna(aba);
    localStorage.setItem(CHAVES_ARMAZENAMENTO_LOCAL.ABA_ATIVA, aba);

    const usaRegistro = aba === "report" || aba === "new";
    const idNormalizado = usaRegistro ? registroId?.trim() || null : null;
    setRegistroIdNavegacao(idNormalizado);

    if (idNormalizado) {
      localStorage.setItem(CHAVES_ARMAZENAMENTO_LOCAL.REGISTRO_SELECIONADO, idNormalizado);
      setSelectedRecord(recordsRef.current.find((record) => record.id === idNormalizado) ?? null);
    } else if (!usaRegistro) {
      localStorage.removeItem(CHAVES_ARMAZENAMENTO_LOCAL.REGISTRO_SELECIONADO);
      setSelectedRecord(null);
    } else {
      setSelectedRecord(null);
    }
  }, []);

  const navegarPara = React.useCallback<NavegarPara>((
    destino,
    opcoes: OpcoesNavegarPara = {},
  ) => {
    if (recuperacaoSenhaRef.current) return;

    const permitido = abaPermitida(
      destino,
      permissoesRef.current.isAdmin,
      permissoesRef.current.isPrivileged,
    );
    const abaFinal = permitido ? destino : "dashboard";
    const registro = permitido ? opcoes.registro : null;
    const registroId = registro?.id ?? (permitido ? opcoes.registroId : null);
    const urlDestino = criarUrlNavegacao(abaFinal, { registroId });
    const urlAtual = `${window.location.pathname}${window.location.search}`;

    if (abaFinal === "report") {
      setOriginTab(activeTabRef.current === "report" ? "inventory" : activeTabRef.current);
    }

    if (registro !== undefined) {
      setSelectedRecord(registro);
    }
    aplicarAbaSemHistorico(abaFinal, registroId);

    const protegida = Boolean(userRef.current);
    const sessionNavigationId = protegida
      ? sessionNavigationIdRef.current ?? obterOuCriarIdSessaoNavegacao()
      : null;
    if (protegida) sessionNavigationIdRef.current = sessionNavigationId;

    if (!urlsNavegacaoIguais(urlAtual, urlDestino)) {
      const navigationIndex = opcoes.substituir || !permitido
        ? navigationIndexRef.current
        : navigationIndexRef.current + 1;
      const estado = criarEstadoHistoricoCedroIA({
        protegida,
        sessionNavigationId,
        navigationIndex,
        aba: abaFinal,
        registroId,
      });
      if (opcoes.substituir || !permitido) {
        window.history.replaceState(estado, "", urlDestino);
      } else {
        window.history.pushState(estado, "", urlDestino);
      }
      navigationIndexRef.current = navigationIndex;
    } else if (opcoes.substituir) {
      window.history.replaceState(
        criarEstadoHistoricoCedroIA({
          protegida,
          sessionNavigationId,
          navigationIndex: navigationIndexRef.current,
          aba: abaFinal,
          registroId,
        }),
        "",
        urlDestino,
      );
    }
  }, [aplicarAbaSemHistorico]);

  // Persistência reativa também cobre alterações originadas por popstate.
  useEffect(() => {
    localStorage.setItem(CHAVES_ARMAZENAMENTO_LOCAL.ABA_ATIVA, activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (selectedRecord) {
      localStorage.setItem(CHAVES_ARMAZENAMENTO_LOCAL.REGISTRO_SELECIONADO, selectedRecord.id);
    } else if (!registroIdNavegacao) {
      localStorage.removeItem(CHAVES_ARMAZENAMENTO_LOCAL.REGISTRO_SELECIONADO);
    }
  }, [selectedRecord, registroIdNavegacao]);

  const [, setVersaoLocalizacao] = useState(0);
  const saltosHistoricoRef = React.useRef(0);
  const guardaSaltoHistoricoRef = React.useRef<number | null>(null);

  useEffect(() => {
    const limparGuardaSalto = () => {
      if (guardaSaltoHistoricoRef.current !== null) {
        window.clearTimeout(guardaSaltoHistoricoRef.current);
        guardaSaltoHistoricoRef.current = null;
      }
    };

    const normalizarComoPublica = () => {
      limparGuardaSalto();
      saltosHistoricoRef.current = 0;
      aplicarAbaSemHistorico("dashboard");
      window.history.replaceState(
        criarEstadoHistoricoCedroIA({
          protegida: false,
          navigationIndex: navigationIndexRef.current,
        }),
        "",
        "/",
      );
    };

    const normalizarComoRecuperacao = () => {
      limparGuardaSalto();
      saltosHistoricoRef.current = 0;
      aplicarAbaSemHistorico("dashboard");
      window.history.replaceState(
        criarEstadoHistoricoCedroIA({
          protegida: false,
          navigationIndex: navigationIndexRef.current,
        }),
        "",
        ROTA_REDEFINIR_SENHA,
      );
    };

    const tratarPopstate = (evento: PopStateEvent) => {
      limparGuardaSalto();
      const resultado = interpretarUrlNavegacao(
        window.location.pathname,
        window.location.search,
      );
      setVersaoLocalizacao((versao) => versao + 1);

      const estado = evento.state;
      const indiceAnterior = navigationIndexRef.current;
      const direcao = obterDirecaoHistorico(indiceAnterior, estado);
      if (ehEstadoHistoricoCedroIA(estado)) {
        navigationIndexRef.current = estado.navigationIndex;
      }

      if (recuperacaoSenhaRef.current) {
        if (resultado.tipo !== "reset-password") {
          normalizarComoRecuperacao();
        }
        return;
      }

      if (
        resultado.tipo === "aba"
        && entradaPrivadaDeSessaoEncerrada(estado, Boolean(userRef.current))
      ) {
        if (direcao !== 0 && podeContinuarSaltandoHistorico(saltosHistoricoRef.current)) {
          saltosHistoricoRef.current += 1;
          const urlAntesDoSalto = window.location.href;
          const indiceAntesDoSalto = navigationIndexRef.current;
          window.history.go(direcao);
          guardaSaltoHistoricoRef.current = window.setTimeout(() => {
            const estadoAtual = window.history.state;
            if (
              window.location.href === urlAntesDoSalto
              && ehEstadoHistoricoCedroIA(estadoAtual)
              && estadoAtual.navigationIndex === indiceAntesDoSalto
            ) {
              normalizarComoPublica();
            }
          }, 350);
          return;
        }

        normalizarComoPublica();
        return;
      }

      // Uma URL privada nunca é restaurada sem autenticação, mesmo quando o
      // history.state está ausente, é legado ou foi adulterado.
      if (rotaPrivadaBloqueada(
        Boolean(userRef.current),
        resultado.tipo === "aba",
        recuperacaoSenhaRef.current,
      )) {
        normalizarComoPublica();
        return;
      }

      saltosHistoricoRef.current = 0;

      if (resultado.tipo === "reset-password") return;

      if (resultado.tipo === "aba") {
        if (
          !abaPermitida(
            resultado.aba,
            permissoesRef.current.isAdmin,
            permissoesRef.current.isPrivileged,
          )
        ) {
          navegarPara("dashboard", { substituir: true });
          return;
        }
        aplicarAbaSemHistorico(resultado.aba, resultado.registroId);
        return;
      }

      aplicarAbaSemHistorico("dashboard");
    };

    window.addEventListener("popstate", tratarPopstate);
    return () => {
      limparGuardaSalto();
      window.removeEventListener("popstate", tratarPopstate);
    };
  }, [aplicarAbaSemHistorico, navegarPara]);

  const teveUsuarioAutenticadoRef = React.useRef(false);
  const teveRecuperacaoSenhaRef = React.useRef(recuperacaoSenhaEmAndamento);

  useEffect(() => {
    if (authLoading) return;

    const resultado = interpretarUrlNavegacao(
      window.location.pathname,
      window.location.search,
    );

    if (recuperacaoSenhaEmAndamento) {
      teveRecuperacaoSenhaRef.current = true;
      sessionNavigationIdRef.current = null;
      teveUsuarioAutenticadoRef.current = false;
      setRecordsCarregados(false);
      aplicarAbaSemHistorico("dashboard");
      if (resultado.tipo !== "reset-password") {
        window.history.replaceState(
          criarEstadoHistoricoCedroIA({
            protegida: false,
            navigationIndex: navigationIndexRef.current,
          }),
          "",
          ROTA_REDEFINIR_SENHA,
        );
      }
      return;
    }

    if (resultado.tipo === "reset-password") {
      if (!user && teveRecuperacaoSenhaRef.current) {
        teveRecuperacaoSenhaRef.current = false;
        window.history.replaceState(
          criarEstadoHistoricoCedroIA({
            protegida: false,
            navigationIndex: navigationIndexRef.current,
          }),
          "",
          "/",
        );
        setVersaoLocalizacao((versao) => versao + 1);
      }
      return;
    }

    if (!user) {
      sessionNavigationIdRef.current = null;
      if (teveUsuarioAutenticadoRef.current) {
        teveUsuarioAutenticadoRef.current = false;
        setRecordsCarregados(false);
        aplicarAbaSemHistorico("dashboard");
        window.history.replaceState(
          criarEstadoHistoricoCedroIA({
            protegida: false,
            navigationIndex: navigationIndexRef.current,
          }),
          "",
          "/",
        );
      } else if (resultado.tipo === "invalida") {
        window.history.replaceState(
          criarEstadoHistoricoCedroIA({
            protegida: false,
            navigationIndex: navigationIndexRef.current,
          }),
          "",
          "/",
        );
      }
      return;
    }

    teveUsuarioAutenticadoRef.current = true;
    sessionNavigationIdRef.current = obterOuCriarIdSessaoNavegacao();

    if (resultado.tipo === "invalida") {
      navegarPara("dashboard", { substituir: true });
      return;
    }

    const abaDesejada = resultado.tipo === "aba" ? resultado.aba : activeTabRef.current;
    const rotaProtegida = ABAS_SOMENTE_ADMIN.has(abaDesejada) || ABAS_PRIVILEGIADAS.has(abaDesejada);
    if (rotaProtegida && !profile) return;

    if (!abaPermitida(abaDesejada, isCurrentUserAdmin, isCurrentUserPrivileged)) {
      navegarPara("dashboard", { substituir: true });
      return;
    }

    const registroId = resultado.tipo === "aba"
      ? resultado.registroId
      : registroIdNavegacao;
    navegarPara(abaDesejada, { registroId, substituir: true });
  }, [
    activeTab,
    aplicarAbaSemHistorico,
    authLoading,
    isCurrentUserAdmin,
    isCurrentUserPrivileged,
    navegarPara,
    profile,
    recuperacaoSenhaEmAndamento,
    registroIdNavegacao,
    user,
  ]);

  useEffect(() => {
    if (registroIdNavegacao) {
      const encontrado = records.find((record) => record.id === registroIdNavegacao);
      if (encontrado) {
        if (selectedRecord?.id !== encontrado.id || selectedRecord !== encontrado) {
          setSelectedRecord(encontrado);
        }
        return;
      }

      if (recordsCarregados && (activeTab === "report" || activeTab === "new")) {
        navegarPara("inventory", { substituir: true });
      }
      return;
    }

    if (activeTab === "report" && recordsCarregados) {
      navegarPara("inventory", { substituir: true });
      return;
    }

    if (selectedRecord && records.length > 0) {
      const encontrado = records.find((record) => record.id === selectedRecord.id);
      if (encontrado && encontrado !== selectedRecord) {
        setSelectedRecord(encontrado);
      }
    }
  }, [
    activeTab,
    navegarPara,
    records,
    recordsCarregados,
    registroIdNavegacao,
    selectedRecord,
  ]);

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
          .limit(LIMITE_MENSAGENS_CONTAGEM_BADGE);

        if (error) {
          console.warn("Não foi possível atualizar o contador de mensagens não lidas:", error);
          return;
        }

        const stored = localStorage.getItem(
          `${CHAVES_ARMAZENAMENTO_LOCAL.MAPA_CHAT_VISUALIZADO_PREFIXO}${user.id}`,
        );
        const seenMap = obterMapaVistoChat(stored);
        const total = calcularTotalMensagensNaoLidas(data || [], user.id, seenMap);
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
  // Respostas fora de ordem não podem sobrescrever uma leitura mais recente.
  const controleRegistros = React.useRef(criarControleRespostaRecente()).current;
  const controleAprovacoes = React.useRef(criarControleRespostaRecente()).current;
  const executarAtualizacaoRef = React.useRef<() => Promise<void>>(async () => {});
  const atualizacaoCoordenada = React.useRef(
    criarAtualizacaoCoordenada(() => executarAtualizacaoRef.current()),
  ).current;

  const loadApprovalData = async () => {
    const requisicao = controleAprovacoes.iniciar();
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

      if (configData && configData.length > 0 && controleAprovacoes.estaAtual(requisicao)) {
        setApprovalConfig({
          steps: configData.map((c: any) => ({
            stepNumber: Number(c.step_number),
            roleName: FIXED_NAMES[c.step_number] || c.role_name || `Etapa ${c.step_number}`,
            userId: c.assigned_user_id,
            userName: c.assigned_user_name,
            isOpinionOnly: c.is_opinion_only || false,
          }))
        });
      }

      let wfData: any[] | null = null;
      // A leitura direta é filtrada por RLS e devolve [] sem erro: só a API é fonte confiável.
      let origemWorkflowsConfiavel = false;
      try {
        const listRes = await requisicaoApi(ROTAS_API.WORKFLOW_LIST);
        if (listRes.ok) {
          const payload = await listRes.json();
          if (Array.isArray(payload)) {
            wfData = payload;
            origemWorkflowsConfiavel = true;
          }
        } else {
          console.warn(`API de workflows respondeu ${listRes.status}; tentando Supabase direto.`);
        }
      } catch (err) {
        console.warn("API de workflows indisponível, tentando Supabase direto:", err);
      }

      if (!origemWorkflowsConfiavel) {
        // Obter do supabase diretamente
        const { data: dbWf } = await supabase
          .from(TABELAS_SUPABASE.FLUXOS_APROVACAO)
          .select(`*, ${RELACOES_SUPABASE.ETAPAS_DO_FLUXO}`);
        
        if (!dbWf || dbWf.length === 0 || dbWf[0].steps === undefined) {
          const { data: rawWfs } = await supabase.from(TABELAS_SUPABASE.FLUXOS_APROVACAO).select("*");
          const { data: rawSteps } = await supabase.from(TABELAS_SUPABASE.ETAPAS_APROVACAO).select("*");
          wfData = rawWfs ? mesclarEtapasEmFluxos(rawWfs, rawSteps || []) : null;
        } else {
          wfData = dbWf;
        }
      }

      const workflowsCarregados = normalizarListaWorkflows(wfData);
      if (!origemWorkflowsConfiavel && workflowsCarregados.length === 0) {
        console.warn("Nenhum fluxo de aprovação legível; mantendo os fluxos já carregados.");
      }
      if (!controleAprovacoes.estaAtual(requisicao)) return;
      setWorkflows((atuais) =>
        decidirAtualizacaoWorkflows(atuais, workflowsCarregados, origemWorkflowsConfiavel),
      );
    } catch (e) {
      console.warn("Erro ao carregar dados de aprovação:", e);
    }
  };

  const executarAtualizacaoCompleta = async () => {
    const requisicao = controleRegistros.iniciar();
    setIsSyncing(true);
    try {
      const isOnline = await checkSupabaseStatus();
      setSupabaseStatus(isOnline ? "online" : "offline");

      const isAdmin = usuarioEhAdmin(profile);
      const isModerator = usuarioEhModerador(profile);
      const isPrivileged = isAdmin || isModerator;

      const data = await getRecords(user?.id, isPrivileged, profile?.setor, profile?.role);
      if (!controleRegistros.estaAtual(requisicao)) return;
      setRecords(data);

      if (isPrivileged) {
        const usersData = await getProfiles();
        seedProfilesCache(usersData);
        setProfilesCatalog(usersData);
        setProfiles(usersData);
      }

      // Carregar dados de conformidade e fluxos ativos de aprovação
      await loadApprovalData();
    } catch (error) {
      console.error("Erro ao atualizar registros:", error);
    } finally {
      if (controleRegistros.estaAtual(requisicao)) {
        setRecordsCarregados(true);
        setIsSyncing(false);
      }
    }
  };

  executarAtualizacaoRef.current = executarAtualizacaoCompleta;

  /** Leitura de tela: reaproveita a atualização já em andamento. */
  const refreshRecords = () => atualizacaoCoordenada.reaproveitar();

  /**
   * Releitura obrigatória depois de uma escrita. Reaproveitar a requisição em voo
   * devolveria a lista de fluxos lida antes da escrita — é o que deixava a coluna
   * "Etapa atual" sem fluxo logo após criar uma solicitação.
   */
  const atualizarDadosDaAplicacao = () => atualizacaoCoordenada.forcar();

  useEffect(() => {
    if (user?.id && profile) {
      setRecordsCarregados(false);
      refreshRecords();
    }
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

    const controle = registrarPollingComVisibilidade({
      intervaloMs: INTERVALO_HEARTBEAT_PRESENCA_MS,
      executar: () => {
        void updatePresence();
      },
      documento: document,
      executarAoIniciar: true,
    });

    return () => controle.dispose();
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
  const profileRef = React.useRef(profile);
  const profilesRef = React.useRef(profiles);
  const profilesCatalogRef = React.useRef(profilesCatalog);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  useEffect(() => {
    profilesCatalogRef.current = profilesCatalog;
  }, [profilesCatalog]);

  const carregarCatalogoPerfisCompartilhado = React.useCallback(async () => {
    if (profilesCatalogRef.current.length > 0) return;
    const usersData = await getProfiles();
    seedProfilesCache(usersData);
    setProfilesCatalog(usersData);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    if (activeTabRef.current !== "chat") {
      refreshUnreadChatCount();
    }
    const handleChatSeen = () => {
      if (activeTabRef.current !== "chat") {
        refreshUnreadChatCount();
      }
    };
    const handleBadgeFromChat = (event: Event) => {
      const detail = (event as CustomEvent<{ total?: number }>).detail;
      if (activeTabRef.current === "chat" && typeof detail?.total === "number") {
        setUnreadChatCount(detail.total);
      }
    };
    window.addEventListener(EVENTOS_APLICACAO.CHAT_LEITURA_ATUALIZADA, handleChatSeen);
    window.addEventListener(EVENTOS_APLICACAO.CHAT_BADGE_ATUALIZADO, handleBadgeFromChat as EventListener);

    return () => {
      window.removeEventListener(EVENTOS_APLICACAO.CHAT_LEITURA_ATUALIZADA, handleChatSeen);
      window.removeEventListener(EVENTOS_APLICACAO.CHAT_BADGE_ATUALIZADO, handleBadgeFromChat as EventListener);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || activeTab !== "chat") return;
    carregarCatalogoPerfisCompartilhado();
    return () => {
      refreshUnreadChatCount();
    };
  }, [activeTab, user?.id, carregarCatalogoPerfisCompartilhado]);

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

          const currentTab = activeTabRef.current;
          if (
            mensagemIncrementaBadgeGlobal(
              msg,
              user.id,
              currentTab === "chat" ? localStorage.getItem(CHAVES_ARMAZENAMENTO_LOCAL.CHAT_ATIVO_COM) : null,
              localStorage.getItem(CHAVES_ARMAZENAMENTO_LOCAL.CHAT_ATIVO_COM),
            )
          ) {
            if (currentTab !== "chat") {
              setUnreadChatCount((prev) => prev + 1);
            }
          }

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
              const cachedSender =
                profilesCatalogRef.current.find((item) => item.id === msg.sender_id) ||
                profilesRef.current.find((item) => item.id === msg.sender_id);
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
                  navegarPara("chat");
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
                        navegarPara("report", { registro: updatedRec });
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

  const handleEdit = (record: IARecord) => {
    if (!isCurrentUserAdmin) return;
    navegarPara("new", { registro: record });
  };

  const handleView = (record: IARecord) => {
    navegarPara("report", { registro: record });
  };

  const handleDelete = async (id: string) => {
    if (!isCurrentUserAdmin) {
      addToast({
        title: "Acesso negado",
        message: "Somente administradores podem excluir registros.",
        type: "error",
      });
      return;
    }

    // Optimistic update
    const previousRecords = [...records];
    setRecords(prev => prev.filter(r => r.id !== id));
    
    try {
      const response = await requisicaoApi(rotaExcluirRegistro(id), { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || payload.mensagem || "Não foi possível excluir o registro.");
      }
      await atualizarDadosDaAplicacao();
      if (selectedRecord?.id === id) {
        setSelectedRecord(null);
      }
    } catch (error) {
      console.error("Erro ao excluir:", error);
      setRecords(previousRecords);
      addToast({ title: "Não foi possível excluir", message: obterMensagemErroUsuario(error, "inventario"), type: "error" });
    }
  };

  const handleCancelRequest = async (recordId: string) => {
    try {
      const record = records.find(r => r.id === recordId);
      if (!record) {
        addToast({ title: "Registro não encontrado", message: "Atualize os dados e tente novamente.", type: "warning" });
        return;
      }

      const response = await requisicaoApi(ROTAS_API.WORKFLOW_CANCEL, {
        method: "POST",
        body: JSON.stringify({ recordId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || payload.mensagem || "Não foi possível cancelar a solicitação.");
      }

      const agora = payload.workflow?.completed_at || payload.record?.updated_at || new Date().toISOString();
      const dadosServidor = (payload.record?.data && typeof payload.record.data === "object")
        ? payload.record.data
        : {};
      const updatedRecord: IARecord = {
        ...record,
        ...dadosServidor,
        id: recordId,
        ownerId: payload.record?.owner_id ?? record.ownerId,
        statusUso: payload.record?.status_uso || StatusUso.CANCELADA,
        updatedAt: agora,
      };

      setRecords((atuais) =>
        atuais.map((item) => item.id === recordId ? updatedRecord : item),
      );
      setWorkflows((atuais) => {
        const alvo = encontrarWorkflowDoRegistro(atuais, recordId);
        if (!alvo) return atuais;
        return atuais.map((workflow) =>
          workflow === alvo
            ? { ...workflow, finalStatus: "cancelado", completedAt: agora }
            : workflow,
        );
      });
      await atualizarDadosDaAplicacao();

      addToast({ title: "Solicitação cancelada", message: "A solicitação foi cancelada com sucesso.", type: "success" });
    } catch (error) {
      console.error("Erro ao cancelar solicitação:", error);
      addToast({ title: "Não foi possível cancelar", message: obterMensagemErroUsuario(error, "inventario"), type: "error" });
    }
  };

  const handleSave = async (record: IARecord) => {
    const isNew = !records.find(r => r.id === record.id);
    const isAdmin = isCurrentUserAdmin;
    
    try {
      if (isNew) {
        await addRecord(record, user?.id, isAdmin);
        const initRes = await requisicaoApi(ROTAS_API.WORKFLOW_INIT, {
          method: "POST",
          body: JSON.stringify({ recordId: record.id })
        });
        if (!initRes.ok) {
          const errBody = await initRes.json().catch(() => ({}));
          throw new Error(errBody.error || errBody.mensagem || "Não foi possível inicializar o fluxo de aprovação.");
        }
      } else {
        if (!isAdmin) {
          throw new Error("Somente administradores podem editar cadastros.");
        }
        await updateRecord(record, user?.id, isAdmin);
      }
      // Só depois do registro gravado e do fluxo inicializado: registros e
      // fluxos são recarregados juntos, então o Inventário já abre com a etapa atual.
      await atualizarDadosDaAplicacao();
      navegarPara("inventory");
    } catch (error: unknown) {
      console.error("Erro ao salvar registro:", error);
      addToast({ title: "Não foi possível salvar", message: obterMensagemErroUsuario(error, "inventario"), type: "error" });
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
      addToast({
        title: "Sucesso",
        message: "Configuração das etapas salva com sucesso.",
        type: "success",
      });
    } catch (e) {
      console.error("Erro ao salvar config de aprovação:", e);
      throw e;
    }
  };

  const handleUpdateStatus = async (recordId: string, status: any, comment?: string, extraFields?: any) => {
    const record = records.find(r => r.id === recordId);
    if (!record) {
      throw new Error("Registro não encontrado para registrar a decisão.");
    }

    // Verificar se o usuário atual é o responsável designado para a etapa atual, um admin ou moderador
    const wf = encontrarWorkflowDoRegistro(workflows, recordId);
    const currentStepNum = wf ? wf.currentStep : 1;
    const configStep = approvalConfig?.steps?.find(s => s.stepNumber === currentStepNum);
    const wfStep = wf?.steps?.find(s => s.stepNumber === currentStepNum);
    const assignedUserId = configStep?.userId || wfStep?.assignedUserId;

    const isAssignedToMe = assignedUserId === user?.id;

    if (!assignedUserId) {
      throw new Error("Esta etapa ainda não possui responsável definido. Configure o fluxo antes de aprovar ou negar.");
    }

    if (!isAssignedToMe) {
      throw new Error("Apenas o responsável designado para esta etapa pode aprovar ou negar.");
    }

    const decision = status === StatusAuditoria.APROVADO ? "aprovado" : "negado";

    try {
      const response = await requisicaoApi(ROTAS_API.WORKFLOW_DECIDE, {
        method: "POST",
        body: JSON.stringify({ recordId, decision, comment, coordinatorData: extraFields })
      });

      if (!response.ok) {
        const errRes = await response.json().catch(() => ({}));
        throw new Error(errRes.error || ("Não foi possível registrar a decisão (HTTP " + response.status + ")."));
      }

      const result = await response.json();

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

      await atualizarDadosDaAplicacao();
    } catch (error: unknown) {
      console.error("Erro ao atualizar status:", error);
      addToast({ title: "Não foi possível atualizar", message: obterMensagemErroUsuario(error, "aprovacao"), type: "error" });
      await refreshRecords();
      throw error;
    }
  };

  const handleResetStatus = async (recordId: string, newStatus: StatusUso, reason: string) => {
    try {
      const res = await requisicaoApi(ROTAS_API.WORKFLOW_RESET_STATUS, {
        method: "POST",
        body: JSON.stringify({ recordId, newStatus, reason })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || ("Erro HTTP " + res.status + " ao redefinir status."));
      }

      addToast({
        title: "Status Redefinido",
        message: "Status e todas as etapas de aprovação foram redefinidos com sucesso.",
        type: "success"
      });

      await refreshRecords();
    } catch (error: unknown) {
      console.error("Erro ao redefinir status:", error);
      addToast({ title: "Não foi possível redefinir", message: obterMensagemErroUsuario(error, "administracao"), type: "error" });
    }
  };

  const handleUpdateUserAssignments = async (
    userId: string,
    atribuicoes: AtribuicaoCadastro[],
  ) => {
    const response = await requisicaoApi(ROTAS_API.ADMIN_ATUALIZAR_ATRIBUICOES, {
      method: "POST",
      body: JSON.stringify({ userId, atribuicoes }),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(result?.error || "Não foi possível atualizar setor/cargo.");
    }
    if (!result?.profile?.id) {
      throw new Error("Resposta inesperada do servidor.");
    }

    const mesclarAtribuicoes = (perfilAtual: UserProfile) =>
      perfilAtual.id === userId
        ? {
            ...perfilAtual,
            setor: result.profile.setor,
            cargo: result.profile.cargo,
          }
        : perfilAtual;

    setProfiles((atuais) => {
      const atualizados = atuais.map(mesclarAtribuicoes);
      seedProfilesCache(atualizados);
      return atualizados;
    });
    setProfilesCatalog((atuais) => atuais.map(mesclarAtribuicoes));
    addToast({
      title: "Atribuições atualizadas",
      message: "Setor e cargo do usuário foram atualizados.",
      type: "success",
    });
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
        // O cache de perfis precisa receber o papel novo antes do refreshRecords,
        // senão getProfiles devolve a entrada antiga e o botão volta ao rótulo anterior.
        setProfiles(prev => {
          const atualizados = aplicarPapelNaListaPerfis(prev, userId, newRole);
          seedProfilesCache(atualizados);
          return atualizados;
        });
        setProfilesCatalog(prev => aplicarPapelNaListaPerfis(prev, userId, newRole));
      } else {
        throw new Error("Resposta inesperada do servidor.");
      }
      
      // Full refresh to ensure consistency across all data
      if (userId === user?.id) {
        await refreshProfile();
      }
      await refreshRecords();
      const roleLabel = newRole === "admin" ? "ADMINISTRADOR" : newRole === "moderator" ? "MODERADOR" : "USUÁRIO COMUM";
      addToast({ title: "Permissão atualizada", message: `O usuário agora tem acesso de ${roleLabel}.`, type: "success" });
    } catch (error: unknown) {
      console.error("❌ Erro fatal ao atualizar role do usuário:", error);
      // Rollback
      setProfiles(previousProfiles);
      addToast({ title: "Não foi possível atualizar", message: obterMensagemErroUsuario(error, "administracao"), type: "error" });
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
      addToast({ title: "Usuário excluído", message: "O usuário foi excluído com sucesso.", type: "success" });
    } catch (error: unknown) {
      console.error("Erro ao apagar usuário:", error);
      addToast({ title: "Não foi possível excluir", message: obterMensagemErroUsuario(error, "administracao"), type: "error" });
    }
  };
  return {
    user,
    profile,
    authLoading,
    recuperacaoSenhaEmAndamento,
    isCurrentUserAdmin,
    isCurrentUserPrivileged,
    activeTab,
    navegarPara,
    records,
    workflows,
    approvalConfig,
    profiles,
    profilesCatalog,
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
    handleEdit,
    handleView,
    handleDelete,
    handleCancelRequest,
    handleSave,
    handleSaveApprovalConfig,
    handleUpdateStatus,
    handleResetStatus,
    handleUpdateUserAssignments,
    handleUpdateUserRole,
    handleDeleteUser,
    refreshRecords,
    signOut,
  };
}
