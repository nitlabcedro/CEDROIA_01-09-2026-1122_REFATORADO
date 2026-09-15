import type { ApprovalPageProps } from "./aprovacoes.tipos";
import { interpretarComentarioAprovacao, obterObservacoesOriginais } from "./aprovacoes.utilitarios";
import { NOMES_ETAPAS_CURTOS, NOMES_ETAPAS_EXIBICAO } from "@/constantes/fluxo-aprovacao";
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { CustomDropdown } from "@/componentes/comuns/MenuSuspenso";
import {
  CheckCircle2,
  XCircle,
  Users,
  Search,
  ShieldCheck,
  Clock,
  Save,
  Check,
  Info,
  ClipboardCheck,
  FileText,
  Sliders,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  HelpCircle,
  Plus,
  Trash2,
  Send,
  Loader2,
  RefreshCw,
  X,
  Building2,
  BriefcaseBusiness,
  UserRound,
  Eye,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { IARecord, StatusAuditoria, UserProfile, ApprovalConfig, ApprovalWorkflow, SolicitacaoInformacoesTI } from "@/tipos";
import { criarSolicitacaoInformacoesTI, listarInteracoesTI } from "@/servicos/interacoes-ti";
import { obterStatusGeralDoRegistro } from "@/utilitarios/status-solicitacao";
import { obterMensagemErroUsuario } from "@/utilitarios/mensagens-erro";

const FIXED_STEP_NAMES = NOMES_ETAPAS_CURTOS;
const DISPLAY_STEP_NAMES = NOMES_ETAPAS_EXIBICAO;

export default function ApprovalPage({
  records,
  profiles,
  workflows = [],
  approvalConfig,
  currentUserId,
  onUpdateStatus,
  onSaveApprovalConfig,
  onViewRecord,
  isAdmin
}: ApprovalPageProps) {
  const [activeTab, setActiveTab] = useState<"queue" | "config">("queue");
  const [workflowConfig, setWorkflowConfig] = useState<ApprovalConfig["steps"]>(
    (approvalConfig?.steps ?? [
    { stepNumber: 1, roleName: FIXED_STEP_NAMES[1], isOpinionOnly: false },
    { stepNumber: 2, roleName: FIXED_STEP_NAMES[2], isOpinionOnly: false },
    { stepNumber: 3, roleName: FIXED_STEP_NAMES[3], isOpinionOnly: false },
    { stepNumber: 4, roleName: FIXED_STEP_NAMES[4], isOpinionOnly: false },
    { stepNumber: 5, roleName: FIXED_STEP_NAMES[5], isOpinionOnly: true }]).
    map((s) => ({
      ...s,
      roleName: FIXED_STEP_NAMES[s.stepNumber] || s.roleName
    }))
  );

  // Sincronizar estado ao carregar assincronamente do servidor
  useEffect(() => {
    if (approvalConfig?.steps && approvalConfig.steps.length > 0) {
      setWorkflowConfig(
        approvalConfig.steps.map((s) => ({
          ...s,
          roleName: FIXED_STEP_NAMES[s.stepNumber] || s.roleName
        }))
      );
    }
  }, [approvalConfig]);
  const [workflowSaved, setWorkflowSaved] = useState(false);
  const [workflowSaveError, setWorkflowSaveError] = useState<string | null>(null);
  const [approvalSearchInput, setApprovalSearchInput] = useState("");
  const [approvalSearchTerm, setApprovalSearchTerm] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setApprovalSearchTerm(approvalSearchInput);
    }, 300);

    return () => clearTimeout(timer);
  }, [approvalSearchInput]);

  const [queueFilter, setQueueFilter] = useState<"pending" | "my_turn" | "all">("my_turn");
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [expandedResponsibleStep, setExpandedResponsibleStep] = useState<number | null>(null);

  useEffect(() => {
    setExpandedResponsibleStep(null);
  }, [selectedRecordId, queueFilter]);

  // Custom states for interactive analysis form
  const [analysisModal, setAnalysisModal] = useState<{isOpen: boolean;record: IARecord | null;}>({ isOpen: false, record: null });
  const [auditComment, setAuditComment] = useState("");

  const [interacoesTi, setInteracoesTi] = useState<SolicitacaoInformacoesTI[]>([]);
  const [carregandoInteracoesTi, setCarregandoInteracoesTi] = useState(false);
  const [erroInteracoesTi, setErroInteracoesTi] = useState("");
  const [modalPerguntasTiAberto, setModalPerguntasTiAberto] = useState(false);
  const [novasPerguntasTi, setNovasPerguntasTi] = useState<string[]>([""]);
  const [enviandoPerguntasTi, setEnviandoPerguntasTi] = useState(false);
  const interacoesTiRequestRef = React.useRef<string | null>(null);

  const [showPainelExecutivo, setShowPainelExecutivo] = useState(false);

  // State to manage expanding/collapsing sections of the requester visualization
  const [showDetailedFolders, setShowDetailedFolders] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    solicitante: true,
    identificacao: true,
    objetivo: false,
    dados: false,
    integracao: false,
    conformidade: false,
    observacoes: false
  });

  // O modal mobile possui acordeoes independentes para manter a leitura compacta.
  // O desktop continua usando expandedSections sem qualquer mudanca de comportamento.
  const [expandedMobileSections, setExpandedMobileSections] = useState<Record<string, boolean>>({
    solicitante: false,
    identificacao: false,
    objetivo: false
  });

  const renderValue = (val: any, mode: "informado" | "preenchido" | "registrada" = "informado") => {
    const fallbackMap = {
      informado: "Não informado",
      preenchido: "Não preenchido na solicitação",
      registrada: "Sem informação registrada"
    };
    const fallback = fallbackMap[mode];
    if (val === undefined || val === null || Array.isArray(val) && val.length === 0 || String(val).trim() === "") {
      return <span className="aprovacoes__texto">{fallback}</span>;
    }
    if (Array.isArray(val)) {
      return val.join(", ");
    }
    const str = String(val).trim();
    if (str.toLowerCase() === "null" || str.toLowerCase() === "undefined" || str === "") {
      return <span className="aprovacoes__texto">{fallback}</span>;
    }
    return str;
  };

  useEffect(() => {
    if (analysisModal.isOpen && analysisModal.record) {
      const record = analysisModal.record;
      setShowDetailedFolders(false);
      setAuditComment("");
      setExpandedMobileSections({
        solicitante: false,
        identificacao: false,
        objetivo: false
      });

      // setTiInfra("Compatível / Cloud nativa");
      // setTiSeguranca("Conforme");
      // setTiIntegracao("Não / Plataforma autônoma");
      // setTiAmbiente("Cloud externa");
      // setTiControleAcesso("Adequado");
      // setTiLogs("Possui logs");
      // setTiAcao("Não");
    }
  }, [analysisModal.record, analysisModal.isOpen]);

  const toggleSection = (sec: string) => {
    setExpandedSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  const approvalEligibleProfiles = useMemo(() => {
    return profiles
      .filter((p) => {
        const status = p.status?.toLowerCase().trim();
        // Contas autorizadas podem ser responsáveis pelo fluxo.
        // Perfis antigos sem status explícito continuam disponíveis para não
        // quebrar cadastros já existentes.
        return !status || status === "autorizado";
      })
      .sort((a, b) => {
        const prioridade = (role?: string) => {
          const normalizado = role?.toLowerCase().trim();
          if (normalizado === "admin") return 0;
          if (normalizado === "moderator") return 1;
          return 2;
        };

        const diferenca = prioridade(a.role) - prioridade(b.role);
        if (diferenca !== 0) return diferenca;
        return (a.full_name || "").localeCompare(b.full_name || "", "pt-BR");
      });
  }, [profiles]);

  const currentSteps = useMemo(() => {
    const rawSteps = approvalConfig?.steps && approvalConfig.steps.length > 0 ?
    approvalConfig.steps :
    [
    { stepNumber: 1, roleName: FIXED_STEP_NAMES[1], isOpinionOnly: false, userId: "", userName: "" },
    { stepNumber: 2, roleName: FIXED_STEP_NAMES[2], isOpinionOnly: false, userId: "", userName: "" },
    { stepNumber: 3, roleName: FIXED_STEP_NAMES[3], isOpinionOnly: false, userId: "", userName: "" },
    { stepNumber: 4, roleName: FIXED_STEP_NAMES[4], isOpinionOnly: false, userId: "", userName: "" },
    { stepNumber: 5, roleName: FIXED_STEP_NAMES[5], isOpinionOnly: true, userId: "", userName: "" }];


    return rawSteps.map((s) => ({
      ...s,
      roleName: FIXED_STEP_NAMES[s.stepNumber] || s.roleName || `Etapa ${s.stepNumber}`
    }));
  }, [approvalConfig]);

  // Encontra se o usuário logado está configurado como responsável para as etapas finais (Presidência / Direção Financeira)
  const isFinalApprovalUser = useMemo(() => {
    return currentSteps.some((step) =>
    (step.stepNumber === 4 || step.stepNumber === 5) &&
    step.userId === currentUserId
    );
  }, [currentSteps, currentUserId]);

  // Força o filtro "Minha vez" para usuários das etapas finais
  useEffect(() => {
    if (isFinalApprovalUser && queueFilter !== "my_turn") {
      setQueueFilter("my_turn");
    }
  }, [isFinalApprovalUser, queueFilter]);

  // Encontra o fluxo de processo real para cada IA
  const getRecordWf = (recordId: string) => {
    return workflows.find((wf) => wf.iaRecordId === recordId);
  };
  const getRecordStatus = (record: IARecord) =>
    obterStatusGeralDoRegistro(record, getRecordWf(record.id));
  const recordEstaPendente = (record: IARecord) => {
    const status = getRecordStatus(record);
    return status === "Em análise" || status === "Em teste";
  };

  const carregarInteracoesTi = useCallback(async (recordId: string) => {
    if (interacoesTiRequestRef.current === recordId) return;
    interacoesTiRequestRef.current = recordId;
    try {
      setCarregandoInteracoesTi(true);
      const dados = await listarInteracoesTI(recordId);
      setInteracoesTi(dados);
      setErroInteracoesTi("");
    } catch (error: unknown) {
      console.error("Erro ao carregar interações da TI:", error);
      setErroInteracoesTi(obterMensagemErroUsuario(error, "aprovacao"));
    } finally {
      if (interacoesTiRequestRef.current === recordId) {
        interacoesTiRequestRef.current = null;
      }
      setCarregandoInteracoesTi(false);
    }
  }, []);

  useEffect(() => {
    const record = analysisModal.record;
    if (!analysisModal.isOpen || !record) {
      setInteracoesTi([]);
      setErroInteracoesTi("");
      setModalPerguntasTiAberto(false);
      return;
    }

    const workflow = workflows.find((item) => item.iaRecordId === record.id);
    const etapaAtual = workflow ? workflow.currentStep : 1;
    if (etapaAtual !== 2) {
      setInteracoesTi([]);
      setErroInteracoesTi("");
      return;
    }

    carregarInteracoesTi(record.id);
    const intervalo = window.setInterval(() => {
      if (document.visibilityState === "visible") carregarInteracoesTi(record.id);
    }, 30000);
    return () => window.clearInterval(intervalo);
  }, [analysisModal.isOpen, analysisModal.record?.id, workflows, carregarInteracoesTi]);

  const abrirModalPerguntasTi = () => {
    setNovasPerguntasTi([""]);
    setErroInteracoesTi("");
    setModalPerguntasTiAberto(true);
  };

  const enviarPerguntasTi = async (recordId: string) => {
    const perguntasValidas = novasPerguntasTi.map((item) => item.trim()).filter(Boolean);
    if (perguntasValidas.length === 0) {
      setErroInteracoesTi("Adicione pelo menos uma pergunta antes de enviar.");
      return;
    }

    try {
      setEnviandoPerguntasTi(true);
      setErroInteracoesTi("");
      await criarSolicitacaoInformacoesTI(recordId, perguntasValidas);
      setModalPerguntasTiAberto(false);
      setNovasPerguntasTi([""]);
      await carregarInteracoesTi(recordId);
    } catch (error: unknown) {
      console.error("Erro ao enviar perguntas ao solicitante:", error);
      setErroInteracoesTi(obterMensagemErroUsuario(error, "aprovacao"));
    } finally {
      setEnviandoPerguntasTi(false);
    }
  };

  const filteredRecords = useMemo(() => {
    let list = records.filter((r) => {
      const status = getRecordStatus(r);
      return status !== "Cancelada" && status !== "Não aprovada";
    });

    // Se o usuário logado pertence às etapas finais do fluxo, ele SÓ pode ver as IAs que estão aguardando estritamente a sua aprovação
    if (isFinalApprovalUser) {
      list = list.filter((r) => {
        const isPending = recordEstaPendente(r);
        if (!isPending) return false;

        const wf = getRecordWf(r.id);
        const isWfFinished = wf && (wf.finalStatus === "aprovado" || wf.finalStatus === "negado" || wf.finalStatus === "cancelado");
        if (isWfFinished) return false;

        const currentStepNum = wf ? wf.currentStep : 1;
        // Deve estar exatamente na etapa dele (4 ou 5)
        if (currentStepNum !== 4 && currentStepNum !== 5) return false;

        const stepDef = currentSteps.find((s) => s.stepNumber === currentStepNum);
        const wfStep = wf?.steps?.find((s) => s.stepNumber === currentStepNum);
        const stepUserId = stepDef?.userId || wfStep?.assignedUserId;

        // O usuário logado deve ser o responsável designado por esta etapa
        return stepUserId === currentUserId;
      });
    }

    // Filtro de busca textual
    list = list.filter((r) => {
      const term = approvalSearchTerm.toLowerCase().trim();
      if (!term) return true;

      const wf = getRecordWf(r.id);
      const currentStepNum = wf ? wf.currentStep : 1;
      const stepDef = currentSteps.find((s) => s.stepNumber === currentStepNum);
      const stageName = stepDef?.roleName || "";

      const matchesSearch =
      r.nomeFerramenta.toLowerCase().includes(term) ||
      r.unidadeSetor.toLowerCase().includes(term) ||
      r.id.toLowerCase().includes(term) ||
      r.responsavelPreenchimento && r.responsavelPreenchimento.toLowerCase().includes(term) ||
      stageName.toLowerCase().includes(term);

      return matchesSearch;
    });

    // Filtros de abas somente para usuários comuns (ou não restritos das etapas finais)
    if (!isFinalApprovalUser) {
      if (queueFilter === "pending") {
        list = list.filter(recordEstaPendente);
      } else if (queueFilter === "my_turn") {
        list = list.filter((r) => {
          const isPending = recordEstaPendente(r);
          if (!isPending) return false;

          const wf = getRecordWf(r.id);
          const isWfFinished = wf && (wf.finalStatus === "aprovado" || wf.finalStatus === "negado" || wf.finalStatus === "cancelado");
          if (isWfFinished) return false;

          const currentStepNum = wf ? wf.currentStep : 1;
          const stepDef = currentSteps.find((s) => s.stepNumber === currentStepNum);

          const wfStep = wf?.steps?.find((s) => s.stepNumber === currentStepNum);
          const stepUserId = stepDef?.userId || wfStep?.assignedUserId;

          const currentUserProfile = profiles.find((p) => p.id === currentUserId);
          const isUserAdmin = isAdmin;
          const isUserModerator = currentUserProfile?.role?.toLowerCase().trim() === "moderator";
          const isUserPrivileged = isUserAdmin || isUserModerator;

          const isStepUnassigned = !stepUserId;
          const isAssignedToMe = stepUserId === currentUserId;

          return isAssignedToMe || isStepUnassigned && isUserPrivileged;
        });
      }
    }

    return list;
  }, [records, queueFilter, approvalSearchTerm, workflows, currentSteps, currentUserId, profiles, isAdmin, isFinalApprovalUser]);

  const stats = useMemo(() => {
    const total = records.length;
    const activeRecords = records.filter(recordEstaPendente);

    // IAs sob responsabilidade direta do logado
    const myTurnCount = activeRecords.filter((r) => {
      const isPending = recordEstaPendente(r);
      if (!isPending) return false;
      const wf = workflows.find((w) => w.iaRecordId === r.id);
      const isWfFinished = wf && (wf.finalStatus === "aprovado" || wf.finalStatus === "negado" || wf.finalStatus === "cancelado");
      if (isWfFinished) return false;

      const currentStepNum = wf ? wf.currentStep : 1;
      const stepDef = currentSteps.find((s) => s.stepNumber === currentStepNum);

      const wfStep = wf?.steps?.find((s) => s.stepNumber === currentStepNum);
      const stepUserId = stepDef?.userId || wfStep?.assignedUserId;

      const currentUserProfile = profiles.find((p) => p.id === currentUserId);
      const isUserAdmin = isAdmin;
      const isUserModerator = currentUserProfile?.role?.toLowerCase().trim() === "moderator";
      const isUserPrivileged = isUserAdmin || isUserModerator;

      const isStepUnassigned = !stepUserId;
      const isAssignedToMe = stepUserId === currentUserId;

      return isAssignedToMe || isStepUnassigned && isUserPrivileged;
    }).length;

    const totalPending = isFinalApprovalUser ?
    myTurnCount :
    activeRecords.length;

    return { total, myTurnCount, totalPending };
  }, [records, workflows, currentSteps, currentUserId, profiles, isAdmin, isFinalApprovalUser]);

  return (
    <div id="aprovacoes-conteudo" data-componente="pagina-aprovacoes" className="pagina-aprovacoes aprovacao-container cedro-page-premium">
      {/* MOBILE REUSABLE CLEAN LAYOUT */}
      <div className="aprovacoes__grupo-aprovacao-de-sistemas">
        {/* Título e Subtítulo */}
        <div className="aprovacao-cabecalho aprovacoes__grupo-aprovacao-de-sistemas-2">
          <h1 className="aprovacoes__titulo-principal-aprovacao-de-sistemas">
            Aprovação de sistemas
          </h1>
          <div className="aprovacoes__grupo-minha-vez-pendentes"><div className="cedro-mini-stat"><span>Minha vez</span><strong>{stats.myTurnCount.toString().padStart(2, "0")}</strong></div><div className="cedro-mini-stat cedro-mini-stat-amber"><span>Pendentes</span><strong>{stats.totalPending.toString().padStart(2, "0")}</strong></div></div>
        </div>

        {/* Aba Fila de Aprovação (simulada ou visual) */}
        {/* <div className="aprovacoes__grupo-fila-de-aprovacao">
          <button className="aprovacoes__botao-fila-de-aprovacao">
            Fila de aprovação
          </button>
        </div> */}

        {/* Card Fila de Aprovação */}
        <div className="aprovacao-fila cedro-card-premium aprovacoes__grupo-solicitacoes-na-fila">
          <div>
            <h2 className="aprovacoes__titulo-secao-solicitacoes-na-fila">Solicitações na Fila</h2>
          </div>

          {/* Filtros compactos - Minha vez, Pendentes, Todos */}
          {!isFinalApprovalUser ?
          <div className="aprovacao-filtros cedro-segmented aprovacoes__grupo">
              {[
            { label: "Minha vez", value: "my_turn" },
            { label: "Pendentes", value: "pending" },
            { label: "Todos", value: "all" }].
            map((opt) =>
            <button
              key={opt.value}
              onClick={() => {
                setQueueFilter(opt.value as any);
                setSelectedRecordId(null);
              }}
              className={`aprovacoes__botao ${
              queueFilter === opt.value ?
              "aprovacoes__botao-2" :
              "aprovacoes__botao-3"}`
              }>
              
                  {opt.label}
                </button>
            )}
            </div> :

          <div className="aprovacoes__grupo-apenas-solicitacoes-aguardando">
              <span className="aprovacoes__texto-apenas-solicitacoes-aguardando">
                Apenas solicitações aguardando sua decisão
              </span>
            </div>
          }

          {/* Campo de Busca */}
          <div className="aprovacoes__grupo-2">
            <Search className="aprovacoes__icone-search" size={15} />
            <input
              type="text"
              placeholder="Buscar ferramenta, ID, setor..."
              value={approvalSearchInput}
              onChange={(e) => setApprovalSearchInput(e.target.value)}
              className="aprovacoes__campo-buscar-ferramenta-id-setor" />
            
          </div>

          {/* Lista de cards */}
          <div className="aprovacoes__grupo-3">
            {filteredRecords.length > 0 ?
            filteredRecords.map((record) => {
              const wf = getRecordWf(record.id);
              const currentStepNum = wf ? wf.currentStep : 1;
              const activeStepDef = currentSteps.find((s) => s.stepNumber === currentStepNum);
              const wfStep = wf?.steps?.find((s) => s.stepNumber === currentStepNum);
              const stepUserId = activeStepDef?.userId || wfStep?.assignedUserId;

              const currentUserProfile = profiles.find((p) => p.id === currentUserId);
              const isUserAdmin = isAdmin;
              const isUserModerator = currentUserProfile?.role?.toLowerCase().trim() === "moderator";
              const isUserPrivileged = isUserAdmin || isUserModerator;

              const isStepUnassigned = !stepUserId;
              const isAssignedToMe = stepUserId === currentUserId;
              const statusGeral = getRecordStatus(record);
              const isWfFinished = statusGeral === "Aprovada" || statusGeral === "Não aprovada" || statusGeral === "Cancelada";
              const isMyTurn = !isWfFinished && isAssignedToMe && recordEstaPendente(record);

              const dateStr = record.createdAt ? record.createdAt.slice(0, 10) : "";
              const formattedDate = dateStr ?
              dateStr.split("-").reverse().join("/") :
              "Sem data";

              return (
                <div
                  key={record.id}
                  className="aprovacao-item-fila aprovacoes__grupo-4">
                  
                    {/* ID e Status */}
                    <div className="aprovacoes__grupo-5">
                      <span className="aprovacoes__texto-2">
                        {record.id}
                      </span>
                      <span className={`aprovacoes__texto-3 ${
                    statusGeral === "Aprovada" ?
                    "aprovacoes__texto-4" :
                    statusGeral === "Não aprovada" || statusGeral === "Cancelada" ?
                    "aprovacoes__texto-5" :
                    "aprovacoes__texto-6"}`
                    }>
                        {statusGeral}
                      </span>
                    </div>

                    {/* Titulo */}
                    <div>
                      <h3 className="aprovacoes__titulo-bloco">
                        {record.nomeFerramenta}
                      </h3>
                      <p className="aprovacoes__descricao">
                        {record.unidadeSetor} • {record.responsavelPreenchimento}
                      </p>
                    </div>

                    {/* Metadados: Etapa do fluxo e Data */}
                    <div className="aprovacoes__grupo-cadastrada-em">
                      {wf && !isWfFinished &&
                    <p className="aprovacoes__descricao-etapa-atual">
                          Etapa Atual: <span className="aprovacoes__texto-7">{currentStepNum}. {activeStepDef?.roleName || "Avaliação"}</span>
                        </p>
                    }
                      <p>
                        Cadastrada em: <span className="aprovacoes__texto-8">{formattedDate}</span>
                      </p>
                    </div>

                    {/* Botões de Ação */}
                    <div className="aprovacoes__grupo-ver-detalhes">
                      <button
                      onClick={() => onViewRecord(record)}
                      className="aprovacoes__botao-ver-detalhes">
                      
                        Ver detalhes
                      </button>

                      {isMyTurn &&
                    <button
                      onClick={() => {
                        setAnalysisModal({ isOpen: true, record });
                        setAuditComment("");
                        setShowPainelExecutivo(false);

                        // setTiInfra("Compatível / Cloud nativa");
                        // setTiSeguranca("Conforme");
                        // setTiIntegracao("Não / Plataforma autônoma");
                        // setTiAmbiente("Cloud externa");
                        // setTiControleAcesso("Adequado");
                        // setTiLogs("Possui logs");
                        // setTiAcao("Não");
                      }}
                      className="aprovacoes__botao-registrar-parecer">
                      
                          Registrar parecer
                        </button>
                    }
                    </div>

                  </div>);

            }) :

            <div className="aprovacoes__grupo-nenhuma-solicitacao-encontrada">
                <p className="aprovacoes__descricao-nenhuma-solicitacao-encontrada">Nenhuma solicitação encontrada.</p>
              </div>
            }
          </div>

        </div>
      </div>

      {/* DESKTOP COMPLETE VIEW */}
      <div className="aprovacoes__grupo-aprovacao-de-sistemas-3">
        {/* Header */}
        {/* <div className="aprovacoes__grupo-aprovacao-de-sistemas-4 aprovacao-cabecalho">
          <div className="aprovacao-cabecalho__texto">
            <span className="aprovacao-cabecalho__sobretitulo">Governança de IA</span>
            <h1 className="aprovacoes__titulo-principal-aprovacao-de-sistemas-2">
              Aprovação de IAs
            </h1>
            <p className="aprovacao-cabecalho__descricao">
              Acompanhe a fila de avaliação, registre pareceres e gerencie o fluxo de aprovação.
            </p>
          </div>

          <div className="aprovacoes__grupo-na-minha-vez aprovacao-indicadores">
            <div className="aprovacoes__grupo-na-minha-vez-2 aprovacao-indicador aprovacao-indicador--minha-vez">
              <span className="aprovacao-indicador__icone"><Users size={22} /></span>
              <div>
                <p className="aprovacoes__descricao-na-minha-vez">Na minha vez</p>
                <p className="aprovacoes__descricao-2">{stats.myTurnCount}</p>
              </div>
            </div>
            <div className="aprovacoes__grupo-pendentes aprovacao-indicador aprovacao-indicador--pendentes">
              <span className="aprovacao-indicador__icone"><Clock size={22} /></span>
              <div>
                <p className="aprovacoes__descricao-na-minha-vez">Pendentes</p>
                <p className="aprovacoes__descricao-3">{stats.totalPending}</p>
              </div>
            </div>
          </div>
        </div> */}

        {/* Tabs Menu Navigation */}
        <div className="aprovacoes__grupo-fila-de-aprovacao-2 aprovacao-abas-barra">
          <div className="cedro-abas aprovacao-abas" role="tablist" aria-label="Seções da aprovação">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "queue"}
              onClick={() => setActiveTab("queue")}
              className={`cedro-aba ${activeTab === "queue" ? "cedro-aba--ativa" : ""} aprovacoes__botao-fila-de-aprovacao-2 ${
              activeTab === "queue" ?
              "aprovacoes__botao-fila-de-aprovacao-3" :
              "aprovacoes__botao-fila-de-aprovacao-4"}`
              }>
              
              Fila de aprovação
            </button>
            
            {isAdmin &&
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "config"}
              onClick={() => setActiveTab("config")}
              className={`cedro-aba ${activeTab === "config" ? "cedro-aba--ativa" : ""} aprovacoes__botao-fila-de-aprovacao-2 ${
              activeTab === "config" ?
              "aprovacoes__botao-fila-de-aprovacao-3" :
              "aprovacoes__botao-configurar-fluxo"}`
              }>
              
                Configurar fluxo
              </button>
            }
          </div>
        </div>

        <AnimatePresence mode="wait">
          <div>
            
            {activeTab === "queue" && (() => {
              const activeRecord = (() => {
                if (filteredRecords.length === 0) return null;
                const found = filteredRecords.find((r) => r.id === selectedRecordId);
                if (found) return found;
                // Only do automatic fallback to first item on initial load/when search is not active
                if (approvalSearchInput.trim() !== "") {
                  return null;
                }
                return filteredRecords[0];
              })();

              return (
                <div className="aprovacoes__grupo-6 aprovacao-layout">
                  {/* COLUNA ESQUERDA: Fila de Solicitações (col-span-5) */}
                  <div className="aprovacoes__grupo-fila-de-aprovacao-3 aprovacao-layout__fila aprovacao-fila">
                    <div>
                      <h2 className="aprovacoes__titulo-secao-fila-de-aprovacao">
                        Fila de aprovação
                      </h2>
                    </div>

                    {/* Filtros compactos - Minha vez, Pendentes, Todos */}
                    {!isFinalApprovalUser ?
                    <div className="aprovacoes__grupo-7">
                        {[
                      { label: "Minha vez", value: "my_turn" },
                      { label: "Pendentes", value: "pending" },
                      { label: "Todos", value: "all" }].
                      map((opt) =>
                      <button
                        key={opt.value}
                        onClick={() => {
                          setQueueFilter(opt.value as any);
                          setSelectedRecordId(null);
                        }}
                        className={`aprovacoes__botao-4 ${
                        queueFilter === opt.value ?
                        "aprovacoes__botao-5" :
                        "aprovacoes__botao-fila-de-aprovacao-4"}`
                        }>
                        
                            {opt.label}
                          </button>
                      )}
                      </div> :

                    <div className="aprovacoes__grupo-apenas-solicitacoes-aguardando-2">
                        <span className="aprovacoes__texto-apenas-solicitacoes-aguardando-2">
                          Apenas solicitações aguardando sua decisão
                        </span>
                      </div>
                    }

                    {/* Barra de busca compacta */}
                    <div className="aprovacoes__grupo-2">
                      <Search
                        className="aprovacoes__icone-search-2"
                        size={14} />
                      
                      <input
                        type="text"
                        placeholder="Buscar ferramenta, ID, setor..."
                        value={approvalSearchInput}
                        onChange={(e) => {
                          setApprovalSearchInput(e.target.value);
                        }}
                        className="aprovacoes__campo-buscar-ferramenta-id-setor-2" />
                      
                    </div>

                    {/* Lista de Registros */}
                    <div className="aprovacoes__grupo-8">
                      {filteredRecords.length > 0 ?
                      filteredRecords.map((record) => {
                        const isSelected =
                        activeRecord && record.id === activeRecord.id;
                        const wf = getRecordWf(record.id);
                        const currentStepNum = wf ? wf.currentStep : 1;

                        const activeStepDef = currentSteps.find(
                          (s) => s.stepNumber === currentStepNum
                        );
                        const wfStep = wf?.steps?.find(
                          (s) => s.stepNumber === currentStepNum
                        );
                        const stepUserId =
                        activeStepDef?.userId || wfStep?.assignedUserId;

                        const currentUserProfile = profiles.find(
                          (p) => p.id === currentUserId
                        );
                        const isUserAdmin = isAdmin;
                        const isUserModerator =
                        currentUserProfile?.role?.toLowerCase().trim() ===
                        "moderator";
                        const isUserPrivileged =
                        isUserAdmin || isUserModerator;

                        const isStepUnassigned = !stepUserId;
                        const isAssignedToMe = stepUserId === currentUserId;
                        const statusGeral = getRecordStatus(record);
                        const isWfFinished =
                        statusGeral === "Aprovada" ||
                        statusGeral === "Não aprovada" ||
                        statusGeral === "Cancelada";
                        const isMyTurn =
                        !isWfFinished &&
                        isAssignedToMe &&
                        recordEstaPendente(record);

                        return (
                          <div
                            key={record.id}
                            onClick={() => setSelectedRecordId(record.id)}
                            className={`aprovacoes__grupo-9 ${
                            isSelected ?
                            "aprovacoes__grupo-10" :
                            isMyTurn ?
                            "aprovacoes__grupo-11" :
                            "aprovacoes__grupo-12"}`
                            }>
                            
                              <div className="aprovacoes__grupo-13">
                                <span className="aprovacoes__texto-9">
                                  {record.id}
                                </span>
                                <span
                                className={`aprovacoes__texto-10 ${
                                statusGeral === "Aprovada" ?
                                "aprovacoes__texto-11" :
                                statusGeral === "Não aprovada" || statusGeral === "Cancelada" ?
                                "aprovacoes__texto-12" :
                                "aprovacoes__texto-13"}`
                                }>
                                
                                  {statusGeral}
                                </span>
                              </div>

                              <h3 className="aprovacoes__titulo-bloco-2">
                                {record.nomeFerramenta}
                              </h3>

                              <div className="aprovacoes__grupo-14">
                                <span className="aprovacoes__texto-14">
                                  {record.unidadeSetor} •{" "}
                                  {record.responsavelPreenchimento}
                                </span>
                                <span className="aprovacoes__texto-15">
                                  {new Date(
                                  record.createdAt
                                ).toLocaleDateString()}
                                </span>
                              </div>
                            </div>);

                      }) :

                      <div className="aprovacoes__grupo-nenhuma-solicitacao-pendente">
                          <p className="aprovacoes__descricao-nenhuma-solicitacao-pendente">
                            Nenhuma solicitação pendente
                          </p>
                        </div>
                      }
                    </div>
                  </div>

                  {/* COLUNA DIREITA: Detalhes e Fluxo de Aprovação (col-span-7) */}
                  <div
                    className="aprovacoes__grupo-15 aprovacao-layout__detalhes aprovacao-detalhes">














                    
                    {activeRecord ?
                    (() => {
                      const record = activeRecord;
                      const wf = getRecordWf(record.id);
                      const currentStepNum = wf ? wf.currentStep : 1;
                      const activeStepDef = currentSteps.find(
                        (s) => s.stepNumber === currentStepNum
                      );

                      const wfStep = wf?.steps?.find(
                        (s) => s.stepNumber === currentStepNum
                      );
                      const stepUserId =
                      activeStepDef?.userId || wfStep?.assignedUserId;
                      const displayedRoleName =
                      activeStepDef?.roleName || wfStep?.roleName || "N/A";
                      const displayedUserName =
                      activeStepDef?.userName || wfStep?.assignedUserName;

                      const currentUserProfile = profiles.find(
                        (p) => p.id === currentUserId
                      );
                      const isUserAdmin = isAdmin;
                      const isUserModerator =
                      currentUserProfile?.role?.toLowerCase().trim() ===
                      "moderator";
                      const isUserPrivileged = isUserAdmin || isUserModerator;

                      const isStepUnassigned = !stepUserId;
                      const isAssignedToMe = stepUserId === currentUserId;
                      const statusGeral = getRecordStatus(record);
                      const isWfFinished =
                      statusGeral === "Aprovada" ||
                      statusGeral === "Não aprovada" ||
                      statusGeral === "Cancelada";
                      const isMyTurn =
                      !isWfFinished &&
                      isAssignedToMe &&
                      recordEstaPendente(record);

                      const latestDecision = record.historico?.find(
                        (h) =>
                        h.action &&
                        !h.action.includes("Criação") &&
                        !h.action.includes("Atualização")
                      );

                      return (
                        <>
                            {/* Pane Header */}
                            <div className="aprovacoes__grupo-16 aprovacao-detalhes__cabecalho">
                              <div>
                                <span className="aprovacoes__texto-9">
                                  {record.id}
                                </span>
                                <h2 className="aprovacoes__titulo-secao">
                                  {record.nomeFerramenta}
                                </h2>
                                <p className="aprovacoes__descricao-4">
                                  {record.unidadeSetor} •{" "}
                                  {record.responsavelPreenchimento}
                                </p>
                              </div>

                              <div className="aprovacoes__grupo-17">
                                {isMyTurn ?
                              <button
                                onClick={() => {
                                  setAnalysisModal({
                                    isOpen: true,
                                    record
                                  });
                                  setAuditComment("");
                                  setShowPainelExecutivo(false);

                                  // setTiInfra("Compatível / Cloud nativa");
                                  // setTiSeguranca("Conforme");
                                  // setTiIntegracao(
                                  //   "Não / Plataforma autônoma",
                                  // );
                                  // setTiAmbiente("Cloud externa");
                                  // setTiControleAcesso("Adequado");
                                  // setTiLogs("Possui logs");
                                  // setTiAcao("Não");
                                }}
                                type="button"
                                className="grupo-interativo aprovacoes__botao-6">
                                
                                    <span className="aprovacoes__texto-16" />

                                    <span className="aprovacoes__texto-17">
                                      <ClipboardCheck
                                    size={18}
                                    strokeWidth={2.4} />
                                  
                                    </span>

                                    <span className="aprovacoes__texto-registrar-parecer">
                                      Registrar parecer
                                    </span>
                                  </button> :

                              <div className="aprovacoes__grupo-18">
                                    <Clock
                                  size={12}
                                  className="aprovacoes__icone-clock" />
                                
                                    <span>
                                      {statusGeral}
                                    </span>
                                  </div>
                              }

                                <button
                                type="button"
                                onClick={() => onViewRecord(record)}
                                className="aprovacoes__botao-ver-ficha">
                                
                                  Ver ficha
                                </button>
                              </div>
                            </div>

                            {/* Metadata Summary Info Line */}
                            <div className="aprovacoes__grupo-19 aprovacao-detalhes__metadados">
                              <div>
                                <p className="aprovacoes__descricao-setor">
                                  Setor
                                </p>
                                <p className="aprovacoes__descricao-5">
                                  {record.unidadeSetor}
                                </p>
                              </div>
                              <div>
                                <p className="aprovacoes__descricao-setor">
                                  Solicitante
                                </p>
                                <p className="aprovacoes__descricao-5">
                                  {record.responsavelPreenchimento}
                                </p>
                              </div>
                              <div>
                                <p className="aprovacoes__descricao-setor">
                                  Data Cadastro
                                </p>
                                <p className="aprovacoes__descricao-6">
                                  {new Date(
                                  record.createdAt
                                ).toLocaleDateString()}
                                </p>
                              </div>
                              <div>
                                <p className="aprovacoes__descricao-setor">
                                  Status
                                </p>
                                <p className="aprovacoes__descricao-7">
                                  {getRecordStatus(record)}
                                </p>
                              </div>
                            </div>

                            {/* O último parecer é apresentado no histórico/fluxo quando aplicável. */}

                            {/* Seção: Fluxo de Governança (Horizontal Stepper) */}
                            <div className="aprovacoes__grupo-status-de-aprovacao aprovacao-status">
                              <h3 className="aprovacoes__titulo-bloco-status-de-aprovacao">
                                Status de aprovação
                              </h3>

                              <div className="aprovacoes__grupo-20 aprovacao-fluxo-etapas">
                                {/* Thin connection line behind */}
                                <div className="aprovacoes__grupo-21" />

                                {currentSteps.map((step) => {
                                const wfStep = wf?.steps?.find(
                                  (s) => s.stepNumber === step.stepNumber
                                );
                                const hasWfStepDecision =
                                wfStep && wfStep.status !== "aguardando";

                                const isFailed = hasWfStepDecision ?
                                wfStep.status === "negado" :
                                record.statusAuditoria ===
                                StatusAuditoria.NEGADO &&
                                step.stepNumber === currentStepNum;

                                const isPassed =
                                !isFailed && (
                                hasWfStepDecision ?
                                wfStep.status === "aprovado" ||
                                wfStep.status === "opiniao" :
                                record.statusAuditoria ===
                                StatusAuditoria.APROVADO ||
                                !wfStep &&
                                step.stepNumber < currentStepNum);

                                const isCurrent =
                                step.stepNumber === currentStepNum &&
                                record.statusAuditoria ===
                                StatusAuditoria.PENDENTE && (
                                !wfStep || wfStep.status === "aguardando");

                                return (
                                  <div
                                    key={step.stepNumber}
                                    className={`aprovacoes__grupo-22 aprovacao-fluxo-etapas__item ${
                                      isPassed ? "aprovacao-fluxo-etapas__item--concluido" :
                                      isFailed ? "aprovacao-fluxo-etapas__item--negado" :
                                      isCurrent ? "aprovacao-fluxo-etapas__item--atual" :
                                      "aprovacao-fluxo-etapas__item--pendente"
                                    }`}>
                                    
                                      <div
                                      title={`${step.stepNumber}. ${step.roleName}`}
                                      className={`aprovacoes__grupo-23 ${
                                      isPassed ?
                                      "aprovacoes__grupo-24" :
                                      isFailed ?
                                      "aprovacoes__grupo-25" :
                                      isCurrent ?
                                      "aprovacoes__grupo-26" :
                                      "aprovacoes__grupo-27"}`
                                      }>
                                      
                                        {step.stepNumber}
                                      </div>

                                      <span className="aprovacoes__texto-18">
                                        {DISPLAY_STEP_NAMES[step.stepNumber] || step.roleName}
                                      </span>
                                      <span className={`aprovacao-fluxo-etapas__status ${
                                        isPassed ? "aprovacao-fluxo-etapas__status--concluido" :
                                        isFailed ? "aprovacao-fluxo-etapas__status--negado" :
                                        isCurrent ? "aprovacao-fluxo-etapas__status--atual" :
                                        "aprovacao-fluxo-etapas__status--pendente"
                                      }`}>
                                        {isPassed ? "Concluído" : isFailed ? "Negado" : isCurrent ? "Em avaliação" : "Pendente"}
                                      </span>
                                    </div>);

                              })}
                              </div>
                            </div>

                            {/* Seção: Responsáveis pelo processo (accordion compacto) */}
                            <div className="aprovacoes__grupo-status-de-aprovacao aprovacao-responsaveis-secao">
                              <div className="aprovacao-responsaveis-secao__cabecalho">
                                <div>
                                  <h3 className="aprovacoes__titulo-bloco-status-de-aprovacao">
                                    Responsáveis pelo processo
                                  </h3>
                                  <p className="aprovacao-responsaveis-secao__descricao">
                                    Clique em uma etapa para consultar o responsável, a data e o parecer registrado.
                                  </p>
                                </div>
                              </div>

                              <div className="aprovacoes__grupo-28 aprovacao-responsaveis aprovacao-responsaveis--acordeao">
                                {currentSteps.map((step) => {
                                  const wfStep = wf?.steps?.find(
                                    (s) => s.stepNumber === step.stepNumber
                                  );

                                  const signerName =
                                    wfStep?.assignedUserName ||
                                    step.userName ||
                                    "Usuário livre";

                                  const decidedAt = wfStep?.decidedAt;
                                  const opinion = wfStep?.comment;
                                  const parsedOpinion = opinion ? interpretarComentarioAprovacao(opinion) : null;
                                  const isExpanded = expandedResponsibleStep === step.stepNumber;
                                  const isRejected = wfStep?.status === "negado";
                                  const isCompleted =
                                    !isRejected &&
                                    (wfStep?.status === "aprovado" ||
                                      wfStep?.status === "opiniao" ||
                                      (!wfStep && step.stepNumber < currentStepNum));
                                  const isCurrentStep =
                                    !isWfFinished &&
                                    step.stepNumber === currentStepNum &&
                                    !isCompleted &&
                                    !isRejected;

                                  const statusLabel = isRejected
                                    ? "Negado"
                                    : isCompleted
                                    ? "Concluído"
                                    : isCurrentStep
                                    ? "Em avaliação"
                                    : "Pendente";

                                  const statusClass = isRejected
                                    ? "negado"
                                    : isCompleted
                                    ? "concluido"
                                    : isCurrentStep
                                    ? "atual"
                                    : "pendente";

                                  return (
                                    <div
                                      key={step.stepNumber}
                                      className={`aprovacao-responsavel-acordeao ${
                                        isExpanded ? "aprovacao-responsavel-acordeao--aberto" : ""
                                      }`}
                                    >
                                      <button
                                        type="button"
                                        className="aprovacao-responsavel-acordeao__cabecalho"
                                        onClick={() =>
                                          setExpandedResponsibleStep((current) =>
                                            current === step.stepNumber ? null : step.stepNumber
                                          )
                                        }
                                        aria-expanded={isExpanded}
                                      >
                                        <span className={`aprovacao-responsavel-acordeao__numero aprovacao-responsavel-acordeao__numero--${statusClass}`}>
                                          {step.stepNumber}
                                        </span>

                                        <span className="aprovacao-responsavel-acordeao__identificacao">
                                          <strong>{DISPLAY_STEP_NAMES[step.stepNumber] || step.roleName}</strong>
                                          <span>Etapa {step.stepNumber} do fluxo de aprovação</span>
                                        </span>

                                        <span className={`aprovacao-responsavel-acordeao__status aprovacao-responsavel-acordeao__status--${statusClass}`}>
                                          {statusLabel}
                                        </span>

                                        <span className="aprovacao-responsavel-acordeao__seta" aria-hidden="true">
                                          {isExpanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                                        </span>
                                      </button>

                                      {isExpanded && (
                                        <div className="aprovacao-responsavel-acordeao__conteudo">
                                          <div className="aprovacao-responsavel-acordeao__metadados">
                                            <div className="aprovacao-responsavel-acordeao__dado">
                                              <span>Responsável</span>
                                              <strong>{signerName}</strong>
                                            </div>

                                            <div className="aprovacao-responsavel-acordeao__dado">
                                              <span>Decisão da etapa</span>
                                              <strong>{statusLabel}</strong>
                                            </div>

                                            {decidedAt && (
                                              <div className="aprovacao-responsavel-acordeao__dado">
                                                <span>Data</span>
                                                <strong>{new Date(decidedAt).toLocaleDateString()}</strong>
                                              </div>
                                            )}
                                          </div>

                                          {parsedOpinion?.criteria && parsedOpinion.criteria.length > 0 && (
                                            <div className="aprovacao-responsavel-acordeao__criterios">
                                              {parsedOpinion.criteria.map((criterion, criterionIndex) => (
                                                <div
                                                  key={`${step.stepNumber}-${criterion.label}-${criterionIndex}`}
                                                  className="aprovacao-responsavel-acordeao__criterio"
                                                >
                                                  <span>{criterion.label}</span>
                                                  <strong>{criterion.value}</strong>
                                                </div>
                                              ))}
                                            </div>
                                          )}

                                          {parsedOpinion?.parecer ? (
                                            <div className="aprovacao-responsavel-acordeao__parecer">
                                              <div className="aprovacao-responsavel-acordeao__parecer-titulo">
                                                <MessageSquare size={15} />
                                                <span>Parecer técnico justificado</span>
                                              </div>
                                              <p>{parsedOpinion.parecer}</p>
                                            </div>
                                          ) : (
                                            <div className="aprovacao-responsavel-acordeao__vazio">
                                              <Clock size={16} />
                                              <div>
                                                <strong>{isCurrentStep ? "Aguardando parecer" : "Sem parecer registrado"}</strong>
                                                <span>
                                                  {isCurrentStep
                                                    ? "A etapa está atualmente em avaliação."
                                                    : "Nenhuma decisão foi registrada nesta etapa."}
                                                </span>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </>);

                    })() :

                    <div className="aprovacoes__grupo-39">
                        <ShieldCheck
                        size={40}
                        className="aprovacoes__icone-shieldcheck" />
                      
                        <div>
                          <h3 className="aprovacoes__titulo-bloco-nenhum-protocolo-ativo">
                            Nenhum protocolo ativo
                          </h3>
                          <p className="aprovacoes__descricao-selecione-uma-solicitacao-da-f">
                            Selecione uma solicitação da fila à esquerda para
                            analisar
                          </p>
                        </div>
                      </div>
                    }
                  </div>
                </div>);

            })()}

            {activeTab === "config" && isAdmin &&
            <div className="aprovacoes__grupo-40 aprovacao-configuracao">
                <div className="aprovacoes__grupo-fila-de-aprovacao-2 aprovacao-configuracao__cabecalho">
                  <div>
                    <h3 className="aprovacoes__titulo-bloco-definir-responsaveis-pelas-eta">Definir responsáveis pelas etapas</h3>
                    <p className="aprovacao-configuracao__descricao">Selecione os usuários responsáveis por cada etapa fixa do fluxo de aprovação.</p>
                  </div>
                  {workflowSaved &&
                <span className="aprovacoes__texto-configuracao-salva">✓ Configuração salva</span>
                }
                  {workflowSaveError &&
                <span className="aprovacoes__texto-configuracao-erro">{workflowSaveError}</span>
                }
                </div>

                <div className="aprovacoes__grupo-41 aprovacao-configuracao__grade">
                  {workflowConfig.map((step, idx) =>
                <div key={step.stepNumber} className="aprovacoes__grupo-42 aprovacao-configuracao__etapa">
                      <div className="aprovacoes__grupo-43">
                        <div className="aprovacoes__grupo-44">
                          {step.stepNumber}
                        </div>
                        <div className="configuracao-fluxo__etapa-identificacao">
                          <strong className="configuracao-fluxo__etapa-nome">
                            {DISPLAY_STEP_NAMES[step.stepNumber] || FIXED_STEP_NAMES[step.stepNumber] || step.roleName}
                          </strong>
                          <span className="configuracao-fluxo__etapa-legenda">Etapa fixa do fluxo</span>
                        </div>
                      </div>

                      <div className="aprovacoes__grupo-usuario-responsavel-admin-mode">
                        <label className="aprovacoes__rotulo-usuario-responsavel-admin-mode">Usuário responsável pela etapa</label>
                        <CustomDropdown
                      value={step.userId ?? ""}
                      onChange={(val) => {
                        const selectedProfile = approvalEligibleProfiles.find((p) => p.id === val);
                        const updated = [...workflowConfig];
                        updated[idx] = {
                          ...updated[idx],
                          userId: val || undefined,
                          userName: selectedProfile?.full_name || undefined
                        };
                        setWorkflowConfig(updated);
                        setWorkflowSaved(false);
                      }}
                      placeholder="— Selecione uma conta autorizada —"
                      options={approvalEligibleProfiles.map((p) => {
                        const roleLabel =
                          p.role === "admin"
                            ? "Administrador"
                            : p.role === "moderator"
                              ? "Moderador"
                              : "Colaborador";

                        const detalhes = [roleLabel, p.cargo, p.setor]
                          .filter(Boolean)
                          .join(" • ");

                        return {
                          value: p.id,
                          label: detalhes ? `${p.full_name} — ${detalhes}` : p.full_name,
                        };
                      })}
                      size="md" />
                    
                        {approvalEligibleProfiles.length === 0 &&
                    <p className="aprovacoes__descricao-nenhum-administrador-ou-modera">
                            Nenhuma conta autorizada foi encontrada. Verifique o status dos usuários na Administração IA.
                          </p>
                    }
                      </div>
                    </div>
                )}
                </div>

                <div className="aprovacoes__grupo-45 aprovacao-configuracao__rodape">
                  <button
                  onClick={async () => {
                    if (!onSaveApprovalConfig) return;

                    const stepsProtegidos = workflowConfig.map((step) => ({
                      ...step,
                      roleName: FIXED_STEP_NAMES[step.stepNumber] || step.roleName,
                    }));

                    setWorkflowConfig(stepsProtegidos);
                    setWorkflowSaved(false);
                    setWorkflowSaveError(null);

                    try {
                      await onSaveApprovalConfig({ steps: stepsProtegidos });
                      setWorkflowSaved(true);
                      setTimeout(() => setWorkflowSaved(false), 4000);
                    } catch (error) {
                      console.error("Erro ao salvar responsáveis do fluxo:", error);
                      setWorkflowSaveError(obterMensagemErroUsuario(error, "aprovacao"));
                    }
                  }}
                  className={`aprovacoes__botao-7 ${
                  workflowSaved ?
                  "aprovacoes__botao-8" :
                  "aprovacoes__botao-9"}`
                  }>
                  
                    {workflowSaved ?
                  <>
                        <CheckCircle2 size={16} />
                        Fluxo configurado com sucesso!
                      </> :

                  <>
                        <Save size={16} />
                        Salvar Configuração de Etapas
                      </>
                  }
                  </button>
                </div>
              </div>
            }
          </div>
        </AnimatePresence>
      </div>

      {/* Analysis & Decision Modal Overlay */}
      <AnimatePresence>
        {analysisModal.isOpen && analysisModal.record && (() => {
          const record = analysisModal.record;
          const wf = getRecordWf(record.id);
          const currentStepNum = wf ? wf.currentStep : 1;
          const activeStepDef = currentSteps.find((s) => s.stepNumber === currentStepNum);

          const prevSteps = (wf?.steps || []).
          filter((s) => s.stepNumber < currentStepNum && s.status !== "aguardando").
          sort((a, b) => a.stepNumber - b.stepNumber);

          const activeWfStep = wf?.steps?.find((s) => s.stepNumber === currentStepNum);
          const activeEvaluatorName = activeWfStep?.assignedUserName || activeStepDef?.assignedUserName || "Qualquer usuário";

          const solicitacaoTiPendente = interacoesTi.find((item) => item.status === "aguardando_resposta");
          const possuiSolicitacaoTiPendente = currentStepNum === 2 && Boolean(solicitacaoTiPendente);

          const renderPainelInteracoesTi = (compacto = false) => {
            if (currentStepNum !== 2) return null;

            return (
              <div className={`aprovacao-interacoes-ti aprovacoes__grupo-46 ${compacto ? "aprovacoes__grupo-47" : "aprovacoes__grupo-48"}`}>
                <div className="aprovacoes__grupo-49">
                  <div>
                    <div className="aprovacoes__grupo-17">
                      <HelpCircle size={16} className="aprovacoes__descricao-etapa-atual" />
                      <h4 className="aprovacoes__titulo-item-comunicacao-com-o-solicitante">
                        Comunicação com o solicitante
                      </h4>
                    </div>
                    <p className="aprovacoes__descricao-crie-perguntas-especificas-par">
                      Crie perguntas específicas para esta solicitação. A etapa permanece na TI até o usuário responder toda a rodada.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={abrirModalPerguntasTi}
                    disabled={Boolean(solicitacaoTiPendente) || carregandoInteracoesTi}
                    className="aprovacoes__botao-solicitar-informacoes">
                    
                    <Plus size={14} />
                    Solicitar informações
                  </button>
                </div>

                {carregandoInteracoesTi && interacoesTi.length === 0 ?
                <div className="aprovacoes__grupo-carregando-interacoes-da-ti">
                    <Loader2 size={14} className="aprovacoes__icone-loader2" />
                    Carregando interações da TI...
                  </div> :
                interacoesTi.length === 0 ?
                <div className="aprovacoes__grupo-nenhuma-rodada-de-perguntas-re">
                    Nenhuma rodada de perguntas registrada para esta solicitação.
                  </div> :

                <div className="aprovacoes__grupo-50">
                    {[...interacoesTi].reverse().map((interacao) => {
                    const aguardando = interacao.status === "aguardando_resposta";
                    return (
                      <div
                        key={interacao.id}
                        className={`aprovacoes__grupo-51 ${aguardando ? "aprovacoes__grupo-52" : "aprovacoes__grupo-53"}`}>
                        
                          <div className="aprovacoes__grupo-54">
                            <div>
                              <p className="aprovacoes__descricao-rodada">
                                Rodada {interacao.numeroRodada}
                              </p>
                              <p className="aprovacoes__descricao-8">
                                {interacao.perguntas.length} pergunta(s) • {new Date(interacao.criadoEm).toLocaleDateString()}
                              </p>
                            </div>
                            <span className={`aprovacoes__texto-23 ${aguardando ? "aprovacoes__texto-24" : "aprovacoes__texto-25"}`}>
                              {aguardando ? "Aguardando resposta" : "Resposta recebida"}
                            </span>
                          </div>

                          <div className="aprovacoes__grupo-55">
                            {interacao.perguntas.map((pergunta) =>
                          <div key={pergunta.id} className="aprovacoes__grupo-56">
                                <div className="aprovacoes__grupo-57">
                                  <span className="aprovacoes__texto-26">
                                    {String(pergunta.ordem).padStart(2, "0")}
                                  </span>
                                  <div className="aprovacoes__grupo-58">
                                    <p className="aprovacoes__descricao-11">
                                      {pergunta.pergunta}
                                    </p>
                                    {pergunta.resposta?.trim() ?
                                <div className="aprovacoes__grupo-resposta-do-solicitante">
                                        <p className="aprovacoes__descricao-resposta-do-solicitante">Resposta do solicitante</p>
                                        <p className="aprovacoes__descricao-12">
                                          {pergunta.resposta}
                                        </p>
                                      </div> :

                                <p className="aprovacoes__descricao-aguardando-resposta-do-solicit">
                                        Aguardando resposta do solicitante.
                                      </p>
                                }
                                  </div>
                                </div>
                              </div>
                          )}
                          </div>
                        </div>);

                  })}
                  </div>
                }

                {solicitacaoTiPendente &&
                <div className="aprovacoes__grupo-etapa-aguardando-o-solicitante">
                    <p className="aprovacoes__descricao-etapa-aguardando-o-solicitante">
                      Etapa aguardando o solicitante
                    </p>
                    <p className="aprovacoes__descricao-aprovar-e-negar-ficam-bloquead">
                      Aprovar e negar ficam bloqueados até que todas as respostas desta rodada sejam enviadas.
                    </p>
                  </div>
                }

                {erroInteracoesTi &&
                <div className="aprovacoes__grupo-59">
                    <p className="aprovacoes__descricao-13">{erroInteracoesTi}</p>
                    <button
                    type="button"
                    onClick={() => carregarInteracoesTi(record.id)}
                    className="aprovacoes__botao-tentar-novamente"
                    title="Tentar novamente">
                    
                      <RefreshCw size={13} />
                    </button>
                  </div>
                }
              </div>);

          };

          const handleDecisionSubmit = (status: StatusAuditoria) => {
            if (currentStepNum === 2 && possuiSolicitacaoTiPendente) {
              setErroInteracoesTi("Aguarde o solicitante responder todas as perguntas antes de concluir a Etapa 2 — TI.");
              return;
            }

            let finalComment = "";
            let extraFields: any = undefined;

            if (currentStepNum === 1) {
              finalComment =
              `Etapa: NIT\n` +
              `Parecer Técnico Justificado: ${
              auditComment || "Nenhum parecer complementar informado."}`;

            } else if (currentStepNum === 2) {
              finalComment =
              `Etapa: TI\n` +
              `Parecer Técnico Justificado: ${
              auditComment || "Nenhum parecer complementar informado."}`;

            } else if (currentStepNum === 3) {
              finalComment =
              `Etapa: Período de Teste\n` +
              `Relatório do Período de Testes: ${
              auditComment || "Nenhuma observação informada."}`;

            } else {
              // Etapas 4 e 5
              finalComment =
              auditComment || (
              status === StatusAuditoria.APROVADO ?
              "Parecer estratégico aprovado na íntegra." :
              "Recusado.");
            }

            onUpdateStatus(record.id, status, finalComment, extraFields);

            setAnalysisModal({
              isOpen: false,
              record: null
            });

            setAuditComment("");
          };

          return (
            <>
              {/* LAYOUT DESKTOP */}
              <div className="cedro-modal-overlay aprovacao-modal aprovacao-modal-desktop aprovacoes__grupo-60">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setAnalysisModal({ isOpen: false, record: null })}
                  className="aprovacoes__elemento" />
                
                <motion.div
                  id="modalAprovacao"
                  initial={{ scale: 0.95, opacity: 0, y: 15 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 15 }}
                  className="aprovacao-modal-painel aprovacoes__elemento-modalaprovacao">
                  
                {/* Barra superior de marca Cedro */}
                <div className="aprovacoes__grupo-61" />

                {/* CABEÇALHO DO POPUP (Full-width) */}
                <div className="aprovacao-cabecalho aprovacoes__grupo-62">
                  <div className="aprovacoes__grupo-63">
                    <div className="aprovacao-identificacao">
                      <div className="aprovacoes__grupo-64">
                        <span className="aprovacoes__texto-27">
                          {wf ? `Etapa ${wf.currentStep} de ${currentSteps.length}` : "Etapa inicial"}
                        </span>
                        <span className={`aprovacoes__texto-28 ${
                          record.status === "Aprovado" ?
                          "aprovacoes__texto-29" :
                          record.status === "Rejeitado" || record.status === "Negado" ?
                          "aprovacoes__texto-30" :
                          "aprovacoes__texto-31"}`
                          }>
                          {record.status || "Pendente"}
                        </span>
                      </div>

                      <h2 className="aprovacoes__titulo-secao-2">
                        {renderValue(record.nomeFerramenta)}
                      </h2>

                      <p className="aprovacoes__descricao-id-protocolo-avaliador">
                        ID/Protocolo: <span className="aprovacoes__texto-32">{record.id}</span> • Avaliador: <span className="aprovacoes__texto-33">
                          {(() => {
                              const activeWfStep = wf?.steps?.find((s) => s.stepNumber === currentStepNum);
                              return activeWfStep?.assignedUserName || activeStepDef?.assignedUserName || "Qualquer usuário";
                            })()}
                        </span>
                      </p>
                    </div>

                    <div className="aprovacoes__grupo-tipo-de-ia-tecnologia">
                      <div className="aprovacoes__grupo-tipo-de-ia-tecnologia-2">
                        <p className="aprovacoes__descricao-tipo-de-ia-tecnologia">Tipo de IA / Tecnologia</p>
                        <p className="aprovacoes__descricao-14" title={record.tipoIA?.join(', ')}>
                          {record.tipoIA && record.tipoIA.length > 0 ? record.tipoIA[0] : "Não mapeado"}
                        </p>
                      </div>
                      <div className="aprovacoes__grupo-tipo-de-ia-tecnologia-2">
                        <p className="aprovacoes__descricao-tipo-de-ia-tecnologia">Setor Solicitante</p>
                        <p className="aprovacoes__descricao-15" title={record.unidadeSetor}>
                          {renderValue(record.unidadeSetor)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Botão de Fechar */}
                  <button
                      className="btn-cancelar-aprovacao aprovacoes__botao-10"
                      onClick={() => setAnalysisModal({ isOpen: false, record: null })}>
                      
                    <XCircle size={20} />
                  </button>
                </div>

                {/* PRINCIPAL CORPO SCROLLABLE (Grid em duas colunas) */}
                <div className="aprovacao-conteudo rolagem-personalizada aprovacoes__grupo-65">
                  
                  {/* COLUNA ESQUERDA: HISTÓRICO E RESUMO DA SOLICITAÇÃO */}
                  <div className="aprovacao-resumo aprovacoes__grupo-66">
                    
                    

                    {/* Card 3: Resumo da solicitação */}
                    <div className="aprovacao-card-solicitacao aprovacoes__grupo-resumo-da-solicitacao">
                      <h5 className="aprovacoes__elemento-resumo-da-solicitacao">Resumo da Solicitação</h5>
                      
                      <div className="aprovacoes__grupo-setor-solicitante">
                        <div className="aprovacao-resumo__linha">
                          <span className="aprovacao-resumo__icone" aria-hidden="true">
                            <Building2 size={16} />
                          </span>
                          <div className="aprovacao-resumo__conteudo">
                            <p className="aprovacoes__descricao-setor-solicitante">Setor Solicitante</p>
                            <p className="aprovacoes__descricao-16">{renderValue(record.unidadeSetor, "preenchido")}</p>
                          </div>
                        </div>
                        <div className="aprovacao-resumo__linha aprovacoes__grupo-cargo">
                          <span className="aprovacao-resumo__icone" aria-hidden="true">
                            <BriefcaseBusiness size={16} />
                          </span>
                          <div className="aprovacao-resumo__conteudo">
                            <p className="aprovacoes__descricao-setor-solicitante">Cargo</p>
                            <p className="aprovacoes__descricao-17">{renderValue(record.cargo, "preenchido")}</p>
                          </div>
                        </div>
                        <div className="aprovacao-resumo__linha aprovacoes__grupo-cargo">
                          <span className="aprovacao-resumo__icone" aria-hidden="true">
                            <UserRound size={16} />
                          </span>
                          <div className="aprovacao-resumo__conteudo">
                            <p className="aprovacoes__descricao-setor-solicitante">Solicitante</p>
                            <p className="aprovacoes__descricao-18">{renderValue(record.responsavelPreenchimento, "preenchido")}</p>
                          </div>
                        </div>
                      </div>

                      <button
                          type="button"
                          onClick={() => setShowDetailedFolders(!showDetailedFolders)}
                          className="aprovacoes__botao-11">
                        <span className="aprovacao-resumo__botao-conteudo">
                          <Eye size={14} />
                          <span>{showDetailedFolders ? "Ocultar Detalhes" : "Ver Detalhes da Solicitação"}</span>
                          {showDetailedFolders ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </span>
                      </button>

                      {/* Pastas Sanfonadas sob demanda */}
                      {showDetailedFolders &&
                        <div className="aprovacoes__grupo-67">
                          {/* Identidade IA Folder */}
                          <div className={`aprovacoes__grupo-68 ${
                          expandedSections.identificacao ?
                          "aprovacoes__grupo-69" :
                          "aprovacoes__grupo-70"}`
                          }>
                            <button
                              type="button"
                              onClick={() => toggleSection("identificacao")}
                              className={`aprovacoes__botao-12 ${
                              expandedSections.identificacao ?
                              "aprovacoes__botao-13" :
                              "aprovacoes__botao-14"}`
                              }>
                              
                              <span className="aprovacoes__texto-1-identificacao-da-ia">
                                <Sliders size={14} className={expandedSections.identificacao ? "aprovacoes__descricao-etapa-atual" : "aprovacoes__descricao-responsavel"} /> 1. Identificação da IA
                              </span>
                              {expandedSections.identificacao ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            {expandedSections.identificacao &&
                            <div className="aprovacoes__grupo-71">
                                <div>
                                  <p className="aprovacoes__descricao-nome-da-ferramenta">Nome da Ferramenta</p>
                                  <p className="aprovacoes__descricao-19">{renderValue(record.nomeFerramenta, "preenchido")}</p>
                                </div>

                                <div className="aprovacoes__grupo-tipo-de-ia-tecnologia-3">
                                  <p className="aprovacoes__descricao-tipo-de-ia-tecnologia-2">Tipo de IA / Tecnologia</p>
                                  <div className="aprovacoes__grupo-72">
                                    {record.tipoIA && record.tipoIA.length > 0 ?
                                  record.tipoIA.map((t: string) =>
                                  <span key={t} className="aprovacoes__texto-34">{t}</span>
                                  ) :

                                  <span className="aprovacoes__texto-mapeamento-nao-preenchido">Mapeamento não preenchido</span>
                                  }
                                  </div>
                                </div>
                              </div>
                            }
                          </div>

                          {/* Objetivo Folder */}
                          <div className={`aprovacoes__grupo-68 ${
                          expandedSections.objetivo ?
                          "aprovacoes__grupo-69" :
                          "aprovacoes__grupo-70"}`
                          }>
                            <button
                              type="button"
                              onClick={() => toggleSection("objetivo")}
                              className={`aprovacoes__botao-12 ${
                              expandedSections.objetivo ?
                              "aprovacoes__botao-13" :
                              "aprovacoes__botao-14"}`
                              }>
                              
                              <span className="aprovacoes__texto-1-identificacao-da-ia">
                                <Info size={14} className={expandedSections.objetivo ? "aprovacoes__descricao-etapa-atual" : "aprovacoes__descricao-responsavel"} /> 2. Finalidade e Objetivos
                              </span>
                              {expandedSections.objetivo ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            {expandedSections.objetivo &&
                            <div className="aprovacoes__grupo-71">
                                <div>
                                  <p className="aprovacoes__descricao-tipo-de-ia-tecnologia-2">Descrição da Atividade</p>
                                  <p className="aprovacoes__descricao-20">
                                    {record.descricaoAtividade ? `"${record.descricaoAtividade}"` : <span className="aprovacoes__texto-mapeamento-nao-preenchido">Não preenchido</span>}
                                  </p>
                                </div>
                                <div className="aprovacoes__grupo-tipo-de-ia-tecnologia-3">
                                  <p className="aprovacoes__descricao-tipo-de-ia-tecnologia-2">Objetivos / Finalidade</p>
                                  <div className="aprovacoes__grupo-73">
                                    {record.objetivos && record.objetivos.length > 0 ?
                                  record.objetivos.map((t: string) =>
                                  <span key={t} className="aprovacoes__texto-35">{t}</span>
                                  ) :

                                  <span className="aprovacoes__texto-mapeamento-nao-preenchido">Não preenchido na solicitação</span>
                                  }
                                  </div>
                                </div>
                                <div className="aprovacoes__grupo-tipo-de-ia-tecnologia-3">
                                  <p className="aprovacoes__descricao-tipo-de-ia-tecnologia-2">Benefícios Esperados</p>
                                  <p className="aprovacoes__descricao-20">
                                    {record.beneficiosEsperados ? `"${record.beneficiosEsperados}"` : <span className="aprovacoes__texto-mapeamento-nao-preenchido">Não preenchido</span>}
                                  </p>
                                </div>
                              </div>
                            }
                          </div>
                        </div>
                        }
                    </div>

                    {/* Card 2: Histórico de pareceres — etapas operacionais */}
                    {currentStepNum < 4 && (() => {
                        const prevSteps = (wf?.steps || []).
                        filter((s) => s.stepNumber < currentStepNum && s.status !== "aguardando").
                        sort((a, b) => a.stepNumber - b.stepNumber);

                        if (prevSteps.length === 0) return null;

                        return (
                          <div className="aprovacao-historico aprovacoes__grupo-resumo-da-solicitacao">
                          <h5 className="aprovacoes__elemento-resumo-da-solicitacao">Histórico de Pareceres</h5>
                          <div className="aprovacoes__grupo-74">
                            {prevSteps.map((s) => {
                                const parsed = interpretarComentarioAprovacao(s.comment);

                                return (
                                  <div
                                    key={s.stepNumber}
                                    className="aprovacao-historico-item aprovacoes__grupo-75"
                                    data-etapa={s.stepNumber}>
                                    
                                  <div className="aprovacoes__grupo-76" />
                                  <div className="aprovacoes__grupo-77">
                                    <div>
                                      <p className="aprovacoes__descricao-etapa">
                                        Etapa {s.stepNumber} • {s.roleName}
                                      </p>
                                      <p className="aprovacoes__descricao-21">
                                        {parsed.parecer || s.comment || "(Sem parecer informado)"}
                                      </p>
                                      <p className="aprovacoes__descricao-por">
                                        Por: {s.assignedUserName || "Aprovação Livre"}
                                      </p>
                                    </div>

                                    <span
                                        className={`aprovacoes__texto-36 ${
                                        s.status === "negado" ?
                                        "aprovacoes__texto-37" :
                                        "aprovacoes__texto-4"}`
                                        }>
                                        
                                      {s.status === "negado" ? "Indeferido" : "Aprovado"}
                                    </span>
                                  </div>
                                </div>);

                              })}
                          </div>
                        </div>);

                      })()}
                  </div>

                  {/* COLUNA DIREITA: FORMULÁRIOS DAS ETAPAS DE DECISÃO */}
                  <div className="aprovacao-etapa aprovacoes__grupo-40">
                    {currentStepNum === 1 &&
                      <div className="aprovacoes__grupo-78">
                        {/* FORMULÁRIO DA ETAPA 1 — COORDENADOR NIT - PREMIUM CEDRO */}
                        <div className="aprovacoes__grupo-79">
                          {/* Detalhe estético superior de acordo com a marca Cedro */}
                          <div className="aprovacoes__grupo-80" />

                          {/* Cabeçalho premium da etapa */}
                          <div className="aprovacoes__grupo-81">
                            <div>
                              <div className="aprovacoes__grupo-etapa-1">
                                <span className="aprovacoes__texto-etapa-1">
                                  Etapa 1
                                </span>
                                <span className="aprovacoes__texto-nit">
                                  NIT
                                </span>
                              </div>

                              <h3 className="aprovacoes__titulo-bloco-formulario-nit">
                                Formulário —  NIT
                              </h3>
                            </div>

                             <div className="aprovacoes__grupo-tipo-de-analise">
                              <p className="aprovacoes__descricao-tipo-de-analise">
                                Tipo de análise
                              </p>
                              <p className="aprovacoes__descricao-triagem-e-filtragem">
                                Triagem e Filtragem
                              </p>
                            </div>
                          </div>

                        </div>
                      </div>
                      }

                    {currentStepNum === 2 &&
                      <div className="aprovacoes__grupo-78">
                        {/* FORMULÁRIO DA ETAPA 2 — GERENTE TI - PREMIUM CEDRO */}
                        <div className="aprovacoes__grupo-79">
                          {/* Detalhe estético superior de acordo com a marca Cedro */}
                          <div className="aprovacoes__grupo-80" />

                          {/* Cabeçalho premium da etapa */}
                          <div className="aprovacoes__grupo-81">
                            <div>
                              <div className="aprovacoes__grupo-etapa-1">
                                <span className="aprovacoes__texto-etapa-1">
                                  Etapa 2
                                </span>
                                <span className="aprovacoes__texto-nit">
                                  TI
                                </span>
                              </div>

                              <h3 className="aprovacoes__titulo-bloco-formulario-nit">
                                Formulário — TI 
                              </h3>
                            </div>

                            <div className="aprovacoes__grupo-tipo-de-analise">
                              <p className="aprovacoes__descricao-tipo-de-analise">
                                Tipo de análise
                              </p>
                              <p className="aprovacoes__descricao-triagem-e-filtragem">
                                Técnica
                              </p>
                            </div>
                          </div>

                          {renderPainelInteracoesTi()}

                        </div>
                      </div>
                      }

                    {/* Etapas de decisão / Formulários dinâmicos baseados no tipo de etapa */}
                    {currentStepNum === 3 &&
                      <div className="aprovacoes__grupo-78">
                        {/* FORMULÁRIO DA ETAPA 3 — PERÍODO DE TESTE - PREMIUM CEDRO */}
                        <div className="aprovacoes__grupo-79">
                          {/* Detalhe estético superior de acordo com a marca Cedro */}
                          <div className="aprovacoes__grupo-80" />

                          {/* Cabeçalho premium da etapa */}
                          <div className="aprovacoes__grupo-81">
                            <div>
                              <div className="aprovacoes__grupo-etapa-1">
                                <span className="aprovacoes__texto-etapa-1">
                                  Etapa 3
                                </span>
                                <span className="aprovacoes__texto-nit">
                                  Período de Teste
                                </span>
                              </div>

                              <h3 className="aprovacoes__titulo-bloco-formulario-nit">
                                Avaliação do Período de Teste
                              </h3>
                            </div>

                            <div className="aprovacoes__grupo-tipo-de-analise">
                              <p className="aprovacoes__descricao-tipo-de-analise">
                                Tipo de análise
                              </p>
                              <p className="aprovacoes__descricao-triagem-e-filtragem">
                                Homologação Experimental
                              </p>
                            </div>
                          </div>

                          {/* Campo Observações */}
                          <div className="aprovacao-parecer aprovacoes__grupo-usuario-responsavel-admin-mode">
                            <label className="aprovacoes__rotulo-relatorio-geral-do-periodo-de-">
                              Relatório Geral do Período de Teste e Observações
                            </label>
                            <p className="aprovacoes__descricao-insira-detalhes-adicionais-sob">
                              Insira detalhes adicionais sobre o período de teste e as condições técnicas observadas na ferramenta durante a simulação prática (opcional).
                            </p>
                            <textarea
                              id="campoRelatorioPeriodoTeste"
                              value={auditComment}
                              onChange={(e) => setAuditComment(e.target.value)}
                              placeholder="Registre observações técnicas relativas aos testes realizados com a Inteligência Artificial..."
                              className="aprovacao-campo-parecer" />
                            
                          </div>


                        </div>
                      </div>
                      }

                        {/* Etapas 4 e 5 — decisão executiva baseada no histórico já registrado */}
                        {currentStepNum === 4 || currentStepNum === 5 ?
                      <div className="aprovacoes__grupo-78 aprovacao-executiva">
                            <div className="aprovacoes__grupo-79 aprovacao-executiva__painel">
                              <div className="aprovacoes__grupo-80" />

                              <div className="aprovacoes__grupo-81 aprovacao-executiva__cabecalho">
                                <div>
                                  <div className="aprovacoes__grupo-etapa-1">
                                    <span className="aprovacoes__texto-etapa-1">
                                      Etapa {currentStepNum}
                                    </span>
                                    <span className="aprovacoes__texto-nit">
                                      {currentStepNum === 4 ? "Presidência" : "Financeiro"}
                                    </span>
                                  </div>

                                  <h3 className="aprovacoes__titulo-bloco-formulario-nit">
                                    {currentStepNum === 4 ? "Decisão da Presidência" : "Decisão Financeira"}
                                  </h3>
                                </div>

                                <div className="aprovacoes__grupo-tipo-de-analise">
                                  <p className="aprovacoes__descricao-tipo-de-analise">
                                    Tipo de análise
                                  </p>
                                  <p className="aprovacoes__descricao-triagem-e-filtragem">
                                    Decisão Executiva
                                  </p>
                                </div>
                              </div>

                              <section className="aprovacao-executiva__historico" aria-label="Histórico de pareceres das etapas anteriores">
                                <div className="aprovacao-executiva__historico-cabecalho">
                                  <div className="aprovacao-executiva__historico-icone" aria-hidden="true">
                                    <FileText size={18} />
                                  </div>
                                  <div>
                                    <h4 className="aprovacao-executiva__historico-titulo">Histórico de Pareceres</h4>
                                    <p className="aprovacao-executiva__historico-subtitulo">Etapas anteriores do fluxo de aprovação</p>
                                  </div>
                                </div>

                                <div className="aprovacao-executiva__historico-lista">
                                  {prevSteps.length > 0 ? prevSteps.map((s) => {
                                    const parsed = interpretarComentarioAprovacao(s.comment);
                                    const isNegado = s.status === "negado";
                                    const parecer = parsed.parecer || s.comment || "(Sem parecer informado)";

                                    return (
                                      <article
                                        key={s.stepNumber}
                                        className={`aprovacao-executiva__parecer ${isNegado ? "aprovacao-executiva__parecer--negado" : "aprovacao-executiva__parecer--aprovado"}`}
                                        data-etapa={s.stepNumber}>
                                        <div className="aprovacao-executiva__parecer-topo">
                                          <div className="aprovacao-executiva__parecer-identificacao">
                                            <span className="aprovacao-executiva__parecer-numero">{s.stepNumber}</span>
                                            <div>
                                              <strong>{s.roleName}</strong>
                                              <span>{s.assignedUserName || "Aprovação Livre"}</span>
                                            </div>
                                          </div>
                                          <span className={`aprovacao-executiva__parecer-status ${isNegado ? "aprovacao-executiva__parecer-status--negado" : "aprovacao-executiva__parecer-status--aprovado"}`}>
                                            {isNegado ? "Indeferido" : "Aprovado"}
                                          </span>
                                        </div>

                                        <div className="aprovacao-executiva__parecer-conteudo">
                                          <span className="aprovacao-executiva__parecer-rotulo">Parecer registrado</span>
                                          <p>{parecer}</p>
                                        </div>
                                      </article>
                                    );
                                  }) : (
                                    <div className="aprovacao-executiva__historico-vazio">Nenhum parecer anterior registrado.</div>
                                  )}
                                </div>
                              </section>
                            </div>
                          </div> :
                      currentStepNum !== 3 ? (
                      /* Parecer de Texto Livre Comum a Todos (exceto Etapa 3 que é embutido e Etapas 4/5 que não necessitam de explicações) */
                      <div className="aprovacao-parecer aprovacoes__grupo-83">
                            {currentStepNum === 2 ?
                        <>
                                <label className="aprovacoes__rotulo-parecer-tecnico-justificado">
                                  <FileText size={14} /> Parecer Técnico Justificado
                                </label>
                              </> :

                        <label className="aprovacoes__rotulo-parecer-tecnico-justificado-2">
                                <MessageSquare size={14} className="aprovacoes__descricao-etapa-atual" /> Parecer Técnico Justificado
                              </label>
                        }
                            <textarea
                          id="campoParecerTecnico"
                          value={auditComment}
                          onChange={(e) => setAuditComment(e.target.value)}
                          placeholder={
                          currentStepNum === 1 ?
                          "Registre o parecer técnico justificado do Coordenador NIT..." :
                          "Descreva aqui sua justificativa técnica detalhada corporativa. Seus argumentos de parecer fundamentarão documentalmente o histórico desta IA no banco do Cedro..."
                          }
                          className="aprovacao-campo-parecer"
                          required />
                        
                          </div>) :
                      null}
                    </div>
                  </div>

                  {/* Ações / Botões Finais de Aprovar ou Negar no Final do Formulário */}
                  <div className="aprovacao-acoes aprovacao-acoes--desktop">
                    <button
                      id="btnCancelarAprovacao"
                      onClick={() => setAnalysisModal({ isOpen: false, record: null })}
                      className="botao-aprovacao botao-aprovacao--cancelar">
                      
                      Cancelar
                    </button>
                    <div className="aprovacao-acoes__grupo">
                        <button
                        id="btnNegarEtapa"
                        onClick={() => handleDecisionSubmit(StatusAuditoria.NEGADO)}
                        disabled={possuiSolicitacaoTiPendente}
                        className="botao-aprovacao botao-aprovacao--negar">
                        
                          <XCircle size={14} /> Negar Etapa
                        </button>
                        <button
                        id="btnAprovarEtapa"
                        onClick={() => handleDecisionSubmit(StatusAuditoria.APROVADO)}
                        disabled={possuiSolicitacaoTiPendente}
                        className="botao-aprovacao botao-aprovacao--aprovar">
                        
                          <CheckCircle2 size={14} /> Aprovar Etapa
                        </button>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* LAYOUT MOBILE */}
              <div className="cedro-modal-overlay aprovacao-modal aprovacao-modal-mobile aprovacoes__grupo-84">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setAnalysisModal({ isOpen: false, record: null })}
                  className="aprovacoes__elemento-2" />
                
                <motion.div
                  id="modalAprovacaoMobile"
                  initial={{ y: "100%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: "100%", opacity: 0 }}
                  transition={{ type: "spring", damping: 25, stiffness: 200 }}
                  className="aprovacao-modal-painel aprovacoes__elemento-modalaprovacaomobile">
                  
                  {/* Barra superior de marca Cedro */}
                  <div className="aprovacoes__grupo-61" />

                  {/* CABEÇALHO MOBILE */}
                  <div className="aprovacao-cabecalho aprovacoes__grupo-85">
                    <div className="aprovacoes__grupo-fila-de-aprovacao-2">
                      <div className="aprovacoes__grupo-17">
                        <span className="aprovacoes__texto-etapa-de">
                          ETAPA {wf ? wf.currentStep : 1} DE {currentSteps.length}
                        </span>
                        <span className={`aprovacoes__texto-38 ${
                        record.status === "Aprovado" ?
                        "aprovacoes__texto-39" :
                        record.status === "Rejeitado" || record.status === "Negado" ?
                        "aprovacoes__texto-40" :
                        "aprovacoes__texto-41"}`
                        }>
                          {record.status || "PENDENTE"}
                        </span>
                      </div>

                      <button
                        onClick={() => setAnalysisModal({ isOpen: false, record: null })}
                        className="aprovacoes__botao-15">
                        
                        <X size={18} />
                      </button>
                    </div>

                    <div className="aprovacoes__grupo-86">
                      {renderValue(record.nomeFerramenta)}
                    </div>

                    <p className="aprovacoes__descricao-id-protocolo">
                      ID/Protocolo: <span className="aprovacoes__texto-42">{record.id}</span>
                      <span className="aprovacoes__texto-43">•</span>
                      Avaliador: <span className="aprovacoes__texto-44">{activeEvaluatorName}</span>
                    </p>
                  </div>

                  {/* ÁREA DE CONTEÚDO COM SCROLL */}
                  <div className="aprovacao-conteudo rolagem-personalizada aprovacoes__grupo-87">
                    {currentStepNum === 1 &&
                    <div className="aprovacoes__grupo-nit">
                        <p className="aprovacoes__descricao-nit">
                          NIT
                        </p>
                        <div className="aprovacoes__grupo-tipo-de-analise-2">
                          <p className="aprovacoes__descricao-tipo-de-analise">
                            Tipo de análise
                          </p>
                          <p className="aprovacoes__descricao-triagem-e-filtragem">
                            Triagem e Filtragem
                          </p>
                        </div>
                      </div>
                    }

                    {currentStepNum === 3 &&
                    <div className="aprovacao-etapa aprovacoes__grupo-nit">
                        <p className="aprovacoes__descricao-nit">
                          Avaliação do Período de Teste
                        </p>
                        <div className="aprovacoes__grupo-tipo-de-analise-2">
                          <p className="aprovacoes__descricao-tipo-de-analise">
                            Tipo de análise
                          </p>
                          <p className="aprovacoes__descricao-triagem-e-filtragem">
                            Homologação Experimental
                          </p>
                        </div>
                      </div>
                    }
                    
                    {/* HISTÓRICO DE PARECERES */}
                    {prevSteps.length > 0 &&
                    <div className="aprovacao-historico aprovacoes__grupo-historico-de-pareceres">
                        <h5 className="aprovacoes__elemento-historico-de-pareceres">Histórico de Pareceres</h5>
                        <div className="aprovacoes__grupo-88">
                          {prevSteps.map((s, idx) => {
                          const parsed = interpretarComentarioAprovacao(s.comment);
                          const isNegado = s.status === "negado";
                          return (
                            <div key={s.stepNumber} className="aprovacao-historico-item aprovacoes__grupo-89" data-etapa={s.stepNumber}>
                                {/* Marcador circular */}
                                <div className={`aprovacoes__grupo-90 ${isNegado ? "aprovacoes__grupo-91" : "aprovacoes__grupo-92"}`}>
                                  {isNegado ? <XCircle size={14} /> : <Check size={14} />}
                                </div>
                                
                                {/* Linha vertical conectando itens */}
                                {idx < prevSteps.length - 1 &&
                              <div className="aprovacoes__grupo-93" />
                              }

                                <div className="aprovacoes__grupo-94">
                                  <div>
                                    <p className="aprovacoes__descricao-etapa-2">
                                      Etapa {s.stepNumber} • {s.roleName}
                                    </p>
                                    <p className="aprovacoes__descricao-23">
                                      {parsed.parecer || s.comment || "(Sem parecer informado)"}
                                    </p>
                                    <p className="aprovacoes__descricao-por-2">
                                      Por: {s.assignedUserName || "Aprovação Livre"}
                                    </p>
                                  </div>

                                  <span className={`aprovacoes__texto-45 ${
                                isNegado ?
                                "aprovacoes__texto-46" :
                                "aprovacoes__texto-47"}`
                                }>
                                    {isNegado ? "INDEFERIDO" : "APROVADO"}
                                  </span>
                                </div>
                              </div>);

                        })}
                        </div>
                      </div>
                    }

                    {/* SEÇÕES RECOLHÍVEIS */}
                    {/* 1. Solicitante */}
                    <div className="aprovacoes__grupo-95">
                      <button
                        type="button"
                        onClick={() => setExpandedMobileSections((prev) => ({ ...prev, solicitante: !prev.solicitante }))}
                        className="aprovacoes__botao-16">
                        
                        <div className="aprovacoes__grupo-1-solicitante">
                          <Users size={16} className="aprovacoes__icone-users" />
                          <span className="aprovacoes__texto-1-solicitante">1. Solicitante</span>
                        </div>
                        {expandedMobileSections.solicitante ? <ChevronUp size={16} className="aprovacoes__descricao-etapa-atual" /> : <ChevronDown size={16} className="aprovacoes__descricao-etapa-atual" />}
                      </button>
                      {expandedMobileSections.solicitante &&
                      <div className="aprovacoes__grupo-solicitante">
                          <div>
                            <p className="aprovacoes__descricao-tipo-de-ia-tecnologia">Solicitante</p>
                            <p className="aprovacoes__descricao-24">{renderValue(record.responsavelPreenchimento, "preenchido")}</p>
                          </div>
                          <div className="aprovacoes__grupo-tipo-de-ia-tecnologia-3">
                            <p className="aprovacoes__descricao-tipo-de-ia-tecnologia">Cargo</p>
                            <p className="aprovacoes__descricao-25">{renderValue(record.cargo, "preenchido")}</p>
                          </div>
                          <div className="aprovacoes__grupo-tipo-de-ia-tecnologia-3">
                            <p className="aprovacoes__descricao-tipo-de-ia-tecnologia">Setor Solicitante</p>
                            <p className="aprovacoes__descricao-26">{renderValue(record.unidadeSetor, "preenchido")}</p>
                          </div>
                        </div>
                      }
                    </div>

                    {/* 2. Identificação da IA */}
                    <div className="aprovacoes__grupo-95">
                      <button
                        type="button"
                        onClick={() => setExpandedMobileSections((prev) => ({ ...prev, identificacao: !prev.identificacao }))}
                        className="aprovacoes__botao-16">
                        
                        <div className="aprovacoes__grupo-1-solicitante">
                          <Sliders size={16} className="aprovacoes__icone-users" />
                          <span className="aprovacoes__texto-1-solicitante">2. Identificação da IA</span>
                        </div>
                        {expandedMobileSections.identificacao ? <ChevronUp size={16} className="aprovacoes__descricao-etapa-atual" /> : <ChevronDown size={16} className="aprovacoes__descricao-etapa-atual" />}
                      </button>
                      {expandedMobileSections.identificacao &&
                      <div className="aprovacoes__grupo-solicitante">
                          <div>
                            <p className="aprovacoes__descricao-tipo-de-ia-tecnologia">Nome da Ferramenta</p>
                            <p className="aprovacoes__descricao-26">{renderValue(record.nomeFerramenta, "preenchido")}</p>
                          </div>
                          <div className="aprovacoes__grupo-tipo-de-ia-tecnologia-3">
                            <p className="aprovacoes__descricao-tipo-de-ia-tecnologia">Tipo de IA / Tecnologia</p>
                            <div className="aprovacoes__grupo-72">
                              {record.tipoIA && record.tipoIA.length > 0 ?
                            record.tipoIA.map((t: string) =>
                            <span key={t} className="aprovacoes__texto-48">{t}</span>
                            ) :

                            <span className="aprovacoes__texto-mapeamento-nao-preenchido">Mapeamento não preenchido</span>
                            }
                            </div>
                          </div>
                        </div>
                      }
                    </div>

                    {/* 3. Finalidade e Objetivos */}
                    <div className="aprovacoes__grupo-95">
                      <button
                        type="button"
                        onClick={() => setExpandedMobileSections((prev) => ({ ...prev, objetivo: !prev.objetivo }))}
                        className="aprovacoes__botao-16">
                        
                        <div className="aprovacoes__grupo-1-solicitante">
                          <Info size={16} className="aprovacoes__icone-users" />
                          <span className="aprovacoes__texto-1-solicitante">3. Finalidade e Objetivos</span>
                        </div>
                        {expandedMobileSections.objetivo ? <ChevronUp size={16} className="aprovacoes__descricao-etapa-atual" /> : <ChevronDown size={16} className="aprovacoes__descricao-etapa-atual" />}
                      </button>
                      {expandedMobileSections.objetivo &&
                      <div className="aprovacoes__grupo-solicitante">
                          <div>
                            <p className="aprovacoes__descricao-tipo-de-ia-tecnologia">Descrição da Atividade</p>
                            <p className="aprovacoes__descricao-27">
                              {record.descricaoAtividade ? `"${record.descricaoAtividade}"` : <span className="aprovacoes__texto-mapeamento-nao-preenchido">Não preenchido</span>}
                            </p>
                          </div>
                          <div className="aprovacoes__grupo-tipo-de-ia-tecnologia-3">
                            <p className="aprovacoes__descricao-tipo-de-ia-tecnologia">Objetivos / Finalidade</p>
                            <div className="aprovacoes__grupo-96">
                              {record.objetivos && record.objetivos.length > 0 ?
                            record.objetivos.map((t: string) =>
                            <span key={t} className="aprovacoes__texto-35">{t}</span>
                            ) :

                            <span className="aprovacoes__texto-mapeamento-nao-preenchido">Não preenchido na solicitação</span>
                            }
                            </div>
                          </div>
                          <div className="aprovacoes__grupo-tipo-de-ia-tecnologia-3">
                            <p className="aprovacoes__descricao-tipo-de-ia-tecnologia">Benefícios Esperados</p>
                            <p className="aprovacoes__descricao-27">
                              {record.beneficiosEsperados ? `"${record.beneficiosEsperados}"` : <span className="aprovacoes__texto-mapeamento-nao-preenchido">Não preenchido</span>}
                            </p>
                          </div>
                        </div>
                      }
                    </div>

                    {/* FORMULÁRIO DA ETAPA ATUAL */}
                    <div className="aprovacoes__grupo-historico-de-pareceres aprovacao-formulario-mobile">
                      <p className="aprovacoes__descricao-formulario-de-decisao">
                        Formulário de Decisão
                      </p>

                      {currentStepNum === 2 && renderPainelInteracoesTi(true)}

                      {/* Parecer Técnico textarea */}
                      <div className="aprovacao-parecer aprovacoes__grupo-97">
                        <label className="aprovacoes__rotulo-parecer-tecnico-justificado-2">
                          <MessageSquare size={14} className="aprovacoes__descricao-etapa-atual" /> {currentStepNum === 3 ? "Relatório Geral do Período de Teste e Observações" : "Parecer Técnico Justificado"}
                        </label>
                        <textarea
                          id="campoParecerTecnicoMobile"
                          value={auditComment}
                          onChange={(e) => setAuditComment(e.target.value)}
                          placeholder={
                          currentStepNum === 1 ?
                          "Registre o parecer técnico justificado do Coordenador NIT..." :
                          currentStepNum === 3 ?
                          "Registre o relatório geral do período de teste e as observações..." :
                          "Descreva aqui sua justificativa técnica detalhada corporativa. Seus argumentos de parecer fundamentarão documentalmente o histórico desta IA no banco do Cedro..."
                          }
                          className="aprovacao-campo-parecer"
                          required />
                        
                      </div>
                    </div>
                  </div>

                  {/* RODAPÉ FIXO COM BOTÕES */}
                  <div className="aprovacao-acoes aprovacao-acoes--mobile">
                      <div className="aprovacao-acoes__coluna">
                        <div className="aprovacao-acoes__grupo aprovacao-acoes__grupo--mobile">
                          <button
                          id="btnNegarEtapaMobile"
                          onClick={() => handleDecisionSubmit(StatusAuditoria.NEGADO)}
                          disabled={possuiSolicitacaoTiPendente}
                          className="botao-aprovacao botao-aprovacao--negar botao-aprovacao--mobile">
                          
                            <XCircle size={16} /> Negar etapa
                          </button>
                          <button
                          id="btnAprovarEtapaMobile"
                          onClick={() => handleDecisionSubmit(StatusAuditoria.APROVADO)}
                          disabled={possuiSolicitacaoTiPendente}
                          className="botao-aprovacao botao-aprovacao--aprovar botao-aprovacao--mobile">
                          
                            <CheckCircle2 size={16} /> Aprovar etapa
                          </button>
                        </div>
                        <button
                        id="btnCancelarAprovacaoMobile"
                        onClick={() => setAnalysisModal({ isOpen: false, record: null })}
                        className="botao-aprovacao botao-aprovacao--cancelar-mobile">
                        
                          Cancelar
                        </button>
                      </div>
                  </div>
                </motion.div>
              </div>
              <AnimatePresence>
                {modalPerguntasTiAberto && currentStepNum === 2 &&
                <div className="cedro-modal-overlay aprovacoes__grupo-98">
                    <motion.button
                    type="button"
                    aria-label="Fechar criação de perguntas"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setModalPerguntasTiAberto(false)}
                    className="aprovacoes__elemento-fechar-criacao-de-perguntas" />
                  

                    <motion.section
                    initial={{ opacity: 0, y: 18, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 14, scale: 0.97 }}
                    className="cedro-modal-painel aprovacoes__elemento-3">
                    
                      <div className="aprovacoes__grupo-99" />
                      <header className="aprovacoes__cabecalho-etapa-2-ti">
                        <div>
                          <p className="aprovacoes__descricao-etapa-2-ti">
                            Etapa 2 — TI
                          </p>
                          <h3 className="aprovacoes__titulo-bloco-solicitar-informacoes-ao-usuar">
                            Solicitar informações ao usuário
                          </h3>
                          <p className="aprovacoes__descricao-escreva-somente-as-perguntas-n">
                            Escreva somente as perguntas necessárias para esta solicitação. O usuário receberá uma notificação persistente até responder todas.
                          </p>
                        </div>
                        <button
                        type="button"
                        onClick={() => setModalPerguntasTiAberto(false)}
                        className="aprovacoes__botao-17">
                        
                          <X size={17} />
                        </button>
                      </header>

                      <div className="aprovacoes__grupo-100">
                        {novasPerguntasTi.map((pergunta, indice) =>
                      <div key={indice} className="aprovacoes__grupo-101">
                            <div className="aprovacoes__grupo-102">
                              <span className="aprovacoes__texto-49">
                                {String(indice + 1).padStart(2, "0")}
                              </span>
                              <div className="aprovacoes__grupo-58">
                                <label className="aprovacoes__rotulo-pergunta">
                                  Pergunta
                                </label>
                                <textarea
                              value={pergunta}
                              onChange={(event) => {
                                const atualizadas = [...novasPerguntasTi];
                                atualizadas[indice] = event.target.value;
                                setNovasPerguntasTi(atualizadas);
                              }}
                              placeholder="Digite a pergunta que deve ser respondida pelo solicitante..."
                              className="aprovacoes__campo-texto-digite-a-pergunta-que-deve-ser"
                              autoFocus={indice === novasPerguntasTi.length - 1} />
                            
                              </div>
                              {novasPerguntasTi.length > 1 &&
                          <button
                            type="button"
                            onClick={() => setNovasPerguntasTi((anteriores) => anteriores.filter((_, posicao) => posicao !== indice))}
                            className="aprovacoes__botao-remover-pergunta"
                            title="Remover pergunta">
                            
                                  <Trash2 size={14} />
                                </button>
                          }
                            </div>
                          </div>
                      )}

                        <button
                        type="button"
                        onClick={() => setNovasPerguntasTi((anteriores) => [...anteriores, ""])}
                        disabled={novasPerguntasTi.length >= 20}
                        className="aprovacoes__botao-adicionar-pergunta">
                        
                          <Plus size={14} />
                          Adicionar pergunta
                        </button>

                        {erroInteracoesTi &&
                      <div className="aprovacoes__grupo-103">
                            {erroInteracoesTi}
                          </div>
                      }
                      </div>

                      <footer className="aprovacoes__rodape-cancelar">
                        <button
                        type="button"
                        onClick={() => setModalPerguntasTiAberto(false)}
                        disabled={enviandoPerguntasTi}
                        className="aprovacoes__botao-cancelar">
                        
                          Cancelar
                        </button>
                        <button
                        type="button"
                        onClick={() => enviarPerguntasTi(record.id)}
                        disabled={enviandoPerguntasTi || novasPerguntasTi.every((item) => !item.trim())}
                        className="aprovacoes__botao-18">
                        
                          {enviandoPerguntasTi ? <Loader2 size={14} className="aprovacoes__icone-loader2" /> : <Send size={14} />}
                          {enviandoPerguntasTi ? "Enviando..." : "Enviar ao solicitante"}
                        </button>
                      </footer>
                    </motion.section>
                  </div>
                }
              </AnimatePresence>
            </>);

        })()}
      </AnimatePresence>
    </div>);

}
