/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { criarConfiguracaoAprovacaoPadrao } from "@/constantes/fluxo-aprovacao";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { CustomDropdown } from "@/componentes/comuns/MenuSuspenso";
import { IconeIA } from "@/componentes/comuns/IconeIA";
import {
  CheckCircle2, XCircle, Users, LayoutGrid, Search,
  Filter, MoreHorizontal, ShieldCheck, ShieldX,
  Database, ArrowUpRight, AlertTriangle, Activity,
  ChevronLeft, ChevronRight, Calendar, ArrowRight,
  User, Check, X, Shield, RefreshCw, FolderLock, Trash2, SlidersHorizontal, Edit,
  Building2, KeyRound } from
"lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IARecord,
  StatusAuditoria,
  StatusUso,
  UserProfile,
  ApprovalConfig,
  ApprovalWorkflow } from
"@/tipos";
import { getSectors } from "@/servicos/armazenamento";
import { TextoExibicaoFluxoAprovacao } from "@/componentes/aprovacoes/TextoExibicaoFluxoAprovacao";
import { obterUltimoParecerLimpo as getCleanLastOpinion } from "@/utilitarios/pareceres";
import SystemControls from "./ControlesSistema";
import SectorsManager from "./GerenciadorSetores";
import { AdminDropdownPortal } from "./AdminDropdownPortal";
import { ModalEditarAtribuicoesUsuario } from "./ModalEditarAtribuicoesUsuario";
import type { AtribuicaoCadastro } from "@/utilitarios/cadastro-usuario";
import {
  obterStatusGeralDoRegistro,
  STATUS_GERAIS_OFICIAIS,
  type StatusGeral,
} from "@/utilitarios/status-solicitacao";
import "@/estilos/paginas/administracao-referencia.css";
import "@/estilos/paginas/administracao-usuarios-referencia.css";
import "@/estilos/paginas/administracao-historico-usuario-referencia.css";

const STATUS_REDEFINICAO_ADMIN: StatusUso[] = [
  StatusUso.EM_AVALIACAO,
  StatusUso.APROVADO,
  StatusUso.NAO_APROVADO,
];

function mapearStatusParaRedefinicaoAdmin(
  record: IARecord,
  workflow?: ApprovalWorkflow | null,
): StatusUso {
  const statusGeral = obterStatusGeralDoRegistro(record, workflow);
  if (statusGeral === "Aprovada") return StatusUso.APROVADO;
  if (statusGeral === "Não aprovada") return StatusUso.NAO_APROVADO;
  return StatusUso.EM_AVALIACAO;
}

interface AdminPanelProps {
  records: IARecord[];
  profiles: UserProfile[];
  onUpdateStatus: (recordId: string, status: StatusAuditoria, comment?: string) => void;
  onViewRecord: (record: IARecord) => void;
  onEditRecord?: (record: IARecord) => void;
  onDeleteRecord?: (id: string) => void;
  onUpdateUserAssignments?: (userId: string, atribuicoes: AtribuicaoCadastro[]) => Promise<void>;
  onUpdateUserRole?: (userId: string, newRole: "admin" | "moderator" | "user") => void;
  onDeleteUser?: (userId: string) => void;
  approvalConfig?: ApprovalConfig;
  onSaveApprovalConfig?: (config: ApprovalConfig) => void;
  currentUserId?: string;
  workflows?: ApprovalWorkflow[];
  supabaseStatus?: "online" | "offline" | "checking";
  onResetStatus?: (recordId: string, newStatus: StatusUso, reason: string) => Promise<void>;
  onNavigate?: (tab: string) => void;
}

type AdminTab = "approvals" | "sectors" | "users" | "system_controls";

const ITEMS_PER_PAGE = 8;


export default function AdminPanel({
  records,
  profiles,
  onUpdateStatus,
  onViewRecord,
  onEditRecord,
  onDeleteRecord,
  onUpdateUserAssignments,
  onUpdateUserRole,
  onDeleteUser,
  approvalConfig,
  onSaveApprovalConfig,
  currentUserId,
  workflows = [],
  supabaseStatus = "checking",
  onResetStatus,
  onNavigate
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("approvals");

  useEffect(() => {
    if (activeTab === "system_controls" || activeTab === "sectors") {
      setActiveTab("approvals");
    }
  }, [activeTab]);
  const [approvalFilter, setApprovalFilter] = useState<StatusGeral | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [userSectorFilter, setUserSectorFilter] = useState("all");
  const [userStatusFilter, setUserStatusFilter] = useState<"all" | "conforme" | "pendente">("all");
  const [userRoleFilter, setUserRoleFilter] = useState<"all" | "admin" | "moderator" | "user">("all");
  const [showUserExtraFilters, setShowUserExtraFilters] = useState(false);
  const [usersPageSize, setUsersPageSize] = useState(10);
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [isConfiguringSectors, setIsConfiguringSectors] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLButtonElement | null>(null);
  const [registeredSectorsList, setRegisteredSectorsList] = useState<string[]>([]);
  const [deleteRecordConfirmId, setDeleteRecordConfirmId] = useState<string | null>(null);

  // Setup user status reset and workflow visualization states
  const [viewFlowRecord, setViewFlowRecord] = useState<IARecord | null>(null);
  const [resetStatusRecord, setResetStatusRecord] = useState<IARecord | null>(null);
  const [resetReason, setResetReason] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [selectedNewStatus, setSelectedNewStatus] = useState<StatusUso>(StatusUso.EM_AVALIACAO);

  useEffect(() => {
    if (resetStatusRecord) {
      const workflow = workflows.find((wf) => wf.iaRecordId === resetStatusRecord.id);
      setSelectedNewStatus(mapearStatusParaRedefinicaoAdmin(resetStatusRecord, workflow));
      setResetReason("");
    }
  }, [resetStatusRecord, workflows]);

  useEffect(() => {
    if (!viewFlowRecord && !resetStatusRecord) return;
    const fecharComEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isResetting) return;
      setViewFlowRecord(null);
      setResetStatusRecord(null);
    };
    window.addEventListener("keydown", fecharComEscape);
    return () => window.removeEventListener("keydown", fecharComEscape);
  }, [viewFlowRecord, resetStatusRecord, isResetting]);

  // Load and memoize the active workflow and merged steps for the visual workflow flow tracker
  const activeFlowWf = useMemo(() => {
    if (!viewFlowRecord) return null;
    return workflows?.find((wf) => wf.iaRecordId === viewFlowRecord.id);
  }, [viewFlowRecord, workflows]);

  const currentFlowSteps = useMemo(() => {
    if (!viewFlowRecord) return [];
    const configSteps = approvalConfig?.steps || [];
    return [1, 2, 3, 4, 5].map((sNum) => {
      const cStep = configSteps.find((s) => s.stepNumber === sNum);
      const wfStep = activeFlowWf?.steps?.find((s) => s.stepNumber === sNum);
      return {
        stepNumber: sNum,
        roleName: wfStep?.roleName || cStep?.roleName || `Etapa ${sNum}`,
        assignedUserName: wfStep?.assignedUserName || cStep?.userName || "Não designado",
        status: wfStep?.status || "aguardando",
        comment: wfStep?.comment || "",
        decidedAt: wfStep?.decidedAt || null,
        isOpinionOnly: wfStep?.isOpinionOnly || cStep?.isOpinionOnly || false
      };
    });
  }, [viewFlowRecord, activeFlowWf, approvalConfig]);

  const currentUserRole = useMemo(() => {
    return profiles.find((p) => p.id === currentUserId)?.role || "user";
  }, [profiles, currentUserId]);
  const isCurrentUserAdmin = currentUserRole === "admin";

  // Pagination states
  const [approvalsPage, setApprovalsPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const [sectorsPage, setSectorsPage] = useState(1);

  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [editingAssignmentsUser, setEditingAssignmentsUser] = useState<UserProfile | null>(null);

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const extraFiltersButtonRef = useRef<HTMLButtonElement | null>(null);
  const extraFiltersPanelRef = useRef<HTMLDivElement | null>(null);
  const obterStatusDoRegistro = (record: IARecord) =>
    obterStatusGeralDoRegistro(
      record,
      workflows.find((workflow) => workflow.iaRecordId === record.id),
    );
  const estaEmAndamento = (record: IARecord) => {
    const status = obterStatusDoRegistro(record);
    return status === "Em análise" || status === "Em teste";
  };

  // Close custom context menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  // Fecha a confirmação de exclusão do usuário ao clicar fora do pequeno menu.
  useEffect(() => {
    if (!showDeleteConfirm) return;

    function handleUserDeleteClickOutside(event: MouseEvent) {
      const target = event.target as Element | null;
      if (target?.closest(`[data-user-delete-menu="${showDeleteConfirm}"]`)) return;
      setShowDeleteConfirm(null);
    }

    function handleUserDeleteEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setShowDeleteConfirm(null);
    }

    document.addEventListener("mousedown", handleUserDeleteClickOutside);
    document.addEventListener("keydown", handleUserDeleteEscape);
    return () => {
      document.removeEventListener("mousedown", handleUserDeleteClickOutside);
      document.removeEventListener("keydown", handleUserDeleteEscape);
    };
  }, [showDeleteConfirm]);

  useEffect(() => {
    if (!deleteRecordConfirmId) return;

    const fecharConfirmacao = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest(`[data-delete-record-menu="${deleteRecordConfirmId}"]`)) return;
      setDeleteRecordConfirmId(null);
    };
    const fecharComEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDeleteRecordConfirmId(null);
    };

    document.addEventListener("mousedown", fecharConfirmacao);
    document.addEventListener("keydown", fecharComEscape);
    return () => {
      document.removeEventListener("mousedown", fecharConfirmacao);
      document.removeEventListener("keydown", fecharComEscape);
    };
  }, [deleteRecordConfirmId]);

  useEffect(() => {
    if (!showUserExtraFilters) return;

    const fecharFiltros = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        extraFiltersButtonRef.current?.contains(target) ||
        extraFiltersPanelRef.current?.contains(target)
      ) return;
      setShowUserExtraFilters(false);
    };
    const fecharComEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowUserExtraFilters(false);
    };

    document.addEventListener("mousedown", fecharFiltros);
    document.addEventListener("keydown", fecharComEscape);
    return () => {
      document.removeEventListener("mousedown", fecharFiltros);
      document.removeEventListener("keydown", fecharComEscape);
    };
  }, [showUserExtraFilters]);

  // Fetch real registered sectors to show counts accurately
  useEffect(() => {
    getSectors().
    then((list) => setRegisteredSectorsList(list)).
    catch(() => {});
  }, [records]);

  // Handle pagination reset on filter changes
  useEffect(() => {
    setApprovalsPage(1);
  }, [approvalFilter, searchTerm]);

  useEffect(() => {
    setUsersPage(1);
  }, [searchTerm, userSectorFilter, userStatusFilter, userRoleFilter, usersPageSize]);

  // Statistics for the Administrative Header
  const stats = useMemo(() => {
    const totalCount = records.length;
    const pendingCount = records.filter(estaEmAndamento).length;
    const approvedCount = records.filter((r) => obterStatusDoRegistro(r) === "Aprovada").length;
    const deniedCount = records.filter((r) => obterStatusDoRegistro(r) === "Não aprovada").length;
    const uniqueUsersCount = profiles.length > 0 ? profiles.length : new Set(records.map((r) => r.responsavelPreenchimento)).size;
    const sectorsCount = registeredSectorsList.length > 0 ? registeredSectorsList.length : new Set(records.map((r) => r.unidadeSetor)).size;

    return {
      total: totalCount,
      pending: pendingCount,
      approved: approvedCount,
      denied: deniedCount,
      uniqueUsers: uniqueUsersCount,
      sectors: sectorsCount
    };
  }, [records, profiles, registeredSectorsList, workflows]);

  // Custom 5 workflow steps config
  const workflowSteps = useMemo(() => {
    return approvalConfig?.steps ?? criarConfiguracaoAprovacaoPadrao().steps;

  }, [approvalConfig]);

  // Privileged moderators
  const privilegedProfiles = useMemo(() => {
    return profiles.filter((p) => {
      const role = p.role?.toLowerCase().trim();
      return role === "admin" || role === "moderator";
    });
  }, [profiles]);

  // Approvals filtering
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const recordStatus = obterStatusDoRegistro(r);
      const matchesStatus = approvalFilter === "all" || recordStatus === approvalFilter;

      const valSearch = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm.trim() ||
      r.nomeFerramenta.toLowerCase().includes(valSearch) ||
      r.unidadeSetor.toLowerCase().includes(valSearch) ||
      r.id.toLowerCase().includes(valSearch) ||
      (r.responsavelPreenchimento || "").toLowerCase().includes(valSearch);

      return matchesStatus && matchesSearch;
    });
  }, [records, approvalFilter, searchTerm, workflows]);

  // Sector stats maps
  const sectorData = useMemo(() => {
    const sectors: Record<string, {total: number;pending: number;approved: number;denied: number;}> = {};

    // Seed configured sectors to ensure all registered sectors are displayed even with 0 IAs
    const sectorsToUse = registeredSectorsList.length > 0 ? registeredSectorsList : Array.from(new Set(records.map((r) => r.unidadeSetor)));
    sectorsToUse.forEach((sec) => {
      if (sec) {
        sectors[sec] = { total: 0, pending: 0, approved: 0, denied: 0 };
      }
    });

    records.forEach((r) => {
      if (r.unidadeSetor) {
        if (!sectors[r.unidadeSetor]) {
          sectors[r.unidadeSetor] = { total: 0, pending: 0, approved: 0, denied: 0 };
        }
        sectors[r.unidadeSetor].total++;
        const status = obterStatusDoRegistro(r);
        if (status === "Em análise" || status === "Em teste") {
          sectors[r.unidadeSetor].pending++;
        } else if (status === "Aprovada") {
          sectors[r.unidadeSetor].approved++;
        } else if (status === "Não aprovada") {
          sectors[r.unidadeSetor].denied++;
        }
      }
    });

    return Object.entries(sectors).sort((a, b) => b[1].total - a[1].total);
  }, [records, registeredSectorsList, workflows]);

  // Selected Sector stats
  const selectedSectorInfo = useMemo(() => {
    if (!selectedSector) return null;
    const sectorIAs = records.filter((r) => r.unidadeSetor === selectedSector);
    const sectorUsers = Array.from(new Set(sectorIAs.map((r) => r.responsavelPreenchimento)));
    return {
      name: selectedSector,
      records: sectorIAs,
      users: sectorUsers,
      stats: {
        total: sectorIAs.length,
        approved: sectorIAs.filter((r) => obterStatusDoRegistro(r) === "Aprovada").length,
        pending: sectorIAs.filter(estaEmAndamento).length,
        denied: sectorIAs.filter((r) => obterStatusDoRegistro(r) === "Não aprovada").length
      }
    };
  }, [selectedSector, records, workflows]);

  // Chosen User History/Details
  const selectedUserInfo = useMemo(() => {
    if (!selectedUser) return null;

    const profile = profiles.find((p) => p.id === selectedUser || p.full_name === selectedUser);
    const userName = profile?.full_name || selectedUser;

    const userIAs = records.filter((r) =>
    r.responsavelPreenchimento === userName
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      name: userName,
      profile: profile,
      records: userIAs,
      sector: profile?.setor || userIAs[0]?.unidadeSetor || "Não Informado",
      stats: {
        total: userIAs.length,
        approved: userIAs.filter((r) => obterStatusDoRegistro(r) === "Aprovada").length,
        pending: userIAs.filter(estaEmAndamento).length,
        denied: userIAs.filter((r) => obterStatusDoRegistro(r) === "Não aprovada").length
      }
    };
  }, [selectedUser, records, profiles, workflows]);

  // Preparation of users list metrics
  const usersWithStats = useMemo(() => {
    const isProfile = profiles.length > 0;
    const list = isProfile ?
    profiles :
    Array.from(new Set(records.map((r) => r.responsavelPreenchimento))).
    map((name) => ({ id: name, full_name: name, role: 'user' as const, status: 'Autorizado' as const, setor: 'Geral' }));

    const dataList = list.map((userItem) => {
      const userProfile = isProfile ? userItem as UserProfile : null;
      const userName = isProfile ? (userItem as UserProfile).full_name : (userItem as any).full_name;

      const userIAs = records.filter((r) => r.responsavelPreenchimento === userName);
      const hasPending = userIAs.some(estaEmAndamento);
      const userId = userProfile?.id || userName;

      return {
        userItem,
        userProfile,
        userName,
        userIAs,
        hasPending,
        userId
      };
    });

    const val = searchTerm.trim().toLowerCase();
    return dataList.filter((u) => {
      const setor = u.userProfile?.setor || u.userIAs[0]?.unidadeSetor || "Não Associado";
      const role = u.userProfile?.role || "user";
      const matchesSearch = !val ||
        u.userName.toLowerCase().includes(val) ||
        setor.toLowerCase().includes(val) ||
        (u.userProfile?.cargo || "").toLowerCase().includes(val);
      const matchesSector = userSectorFilter === "all" || setor === userSectorFilter;
      const matchesStatus = userStatusFilter === "all" ||
        (userStatusFilter === "pendente" ? u.hasPending : !u.hasPending);
      const matchesRole = userRoleFilter === "all" || role === userRoleFilter;
      return matchesSearch && matchesSector && matchesStatus && matchesRole;
    });
  }, [profiles, records, searchTerm, userSectorFilter, userStatusFilter, userRoleFilter]);

  const userSectorOptions = useMemo(() => {
    const setores = new Set<string>();
    profiles.forEach((profile) => {
      if (profile.setor?.trim()) setores.add(profile.setor.trim());
    });
    records.forEach((record) => {
      if (record.unidadeSetor?.trim()) setores.add(record.unidadeSetor.trim());
    });
    return Array.from(setores).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [profiles, records, workflows]);

  // Paginated Slices
  const paginatedApprovals = useMemo(() => {
    const startIndex = (approvalsPage - 1) * ITEMS_PER_PAGE;
    return filteredRecords.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredRecords, approvalsPage]);

  const paginatedUsers = useMemo(() => {
    const startIndex = (usersPage - 1) * usersPageSize;
    return usersWithStats.slice(startIndex, startIndex + usersPageSize);
  }, [usersWithStats, usersPage, usersPageSize]);

  // Archiving/Action simulations
  const handleArchiveRecord = (record: IARecord) => {
    if (window.confirm(`Deseja realmente arquivar permanentemente o registro ${record.nomeFerramenta} (${record.id})?`)) {
      onUpdateStatus(record.id, StatusAuditoria.NEGADO, "Arquivado e descontinuado via painel de administração corporativa.");
      alert(`O registro ${record.id} foi transferido para a fila de descontinuados.`);
    }
  };

  return (
    <div id="administracao-conteudo" data-componente="pagina-administracao" className="pagina-administracao administracao-conteiner cedro-page-premium">
      
      {/* 1. Header Section
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24 }}
        className="administracao-cabecalho administracao__administracao-cabecalho-estrutura administracao-hero">
        <div className="administracao-hero__texto">
          <h1 id="tituloPainelAdministracao" className="administracao__titulo-principal-titulopaineladministracao administracao-hero__titulo">
            Administração IA
          </h1>
          <p className="administracao-hero__subtitulo">
            Gerencie cadastros, usuários e o ciclo de governança das soluções registradas.
          </p>
        </div>
        <div className="administracao-hero__ilustracao" aria-hidden="true">
          <span className="administracao-hero__ilustracao-fundo"></span>
          <span className="administracao-hero__janela"><LayoutGrid size={33} strokeWidth={1.5} /></span>
          <span className="administracao-hero__escudo"><ShieldCheck size={28} strokeWidth={1.7} /></span>
          <span className="administracao-hero__ponto"></span>
        </div>
      </motion.header> */}

      {/* 2. Summary Indicators Panel (Grid) */}
      <section className="administracao-indicadores administracao__administracao-indicadores-estrutura">
        {[
        {
          title: "Em andamento",
          val: stats.pending,
          support: "Em análise ou teste",
          icon: Activity,
          variante: "pendente"
        },
        {
          title: "IAs aprovadas",
          val: stats.approved,
          support: "Total aprovadas",
          icon: ShieldCheck,
          variante: "aprovado"
        },
        {
          title: "Não aprovadas",
          val: stats.denied,
          support: "Total não aprovadas",
          icon: ShieldX,
          variante: "negado"
        },
        {
          title: "Usuários cadastrados",
          val: stats.uniqueUsers,
          support: "Ativos no sistema",
          icon: Users,
          variante: "neutro"
        },
        {
          title: "Setores cadastrados",
          val: stats.sectors,
          support: "Total de setores",
          icon: LayoutGrid,
          variante: "neutro"
        }].
        map((item, idx) =>
        <motion.article
          key={idx}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: idx * 0.035 }}
          className={`administracao-kpi administracao-kpi--${item.variante}`}
          data-indicador={item.title}>
          <span className="administracao-kpi__icone"><item.icon size={27} strokeWidth={1.7} /></span>
          <div className="administracao-kpi__conteudo">
            <span className="administracao-kpi__rotulo">{item.title}</span>
            <strong className="administracao-kpi__valor">{String(item.val).padStart(2, "0")}</strong>
            <span className="administracao-kpi__apoio">{item.support}</span>
          </div>
        </motion.article>
        )}
      </section>

      {/* 3. Navigation Tabs */}
      <div className="administracao-filtros administracao__administracao-filtros-estrutura administracao-toolbar">
        <nav className="cedro-segment-nav" aria-label="Seções da administração">
          <div className="cedro-segment-nav__grupo cedro-segment-nav__grupo--dupla" role="tablist">
            {[
            { id: "approvals", label: "Cadastro de IAs" },
            { id: "users", label: "Usuários" }].
            map((tab) =>
            <button
              key={tab.id}
              type="button"
              role="tab"
              data-aba={tab.id}
              aria-selected={activeTab === tab.id}
              onClick={() => {
                setActiveTab(tab.id as AdminTab);
                setSelectedSector(null);
                setSelectedUser(null);
                setIsConfiguringSectors(false);
              }}
              className={`cedro-segment-nav__item${
                activeTab === tab.id ? " cedro-segment-nav__item--ativo" : ""
              }`}
            >
              {tab.label}
            </button>
            )}
          </div>
        </nav>

        {/* Global Toolbar specific to Current View */}
        {activeTab === "approvals" &&
        <div className="administracao__grupo-6 administracao-toolbar__controles">
            <div className="grupo-interativo administracao__grupo-8 administracao-toolbar__busca">
              <Search className="administracao__icone-search" size={16} />
              <input
              type="text"
              placeholder="Buscar IA, ID ou Setor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="administracao__campo-buscar-ia-id-ou-setor" />
            </div>

            <CustomDropdown
              value={approvalFilter}
              options={[
                { label: "Todos", value: "all" },
                ...STATUS_GERAIS_OFICIAIS.map((status) => ({ label: status, value: status })),
              ]}
              onChange={(value) => setApprovalFilter(value as StatusGeral | "all")}
              icon={<Filter size={15} />}
              className="administracao-toolbar__status"
              triggerClassName="administracao-toolbar__status-gatilho"
              size="sm"
            />
          </div>
        }

        {/* Users toolbar */}
        {activeTab === "users" && !selectedUser &&
        <div className="administracao-usuarios-toolbar">
          <div className="grupo-interativo administracao-usuarios-toolbar__busca">
            <Search className="administracao__icone-search" size={16} />
            <input
              type="text"
              placeholder="Buscar responsável ou cargo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="administracao__campo-buscar-ia-id-ou-setor" />
          </div>

          <select
            value={userSectorFilter}
            onChange={(e) => setUserSectorFilter(e.target.value)}
            className="administracao-usuarios-toolbar__select"
            aria-label="Filtrar usuários por setor">
            <option value="all">Todos os setores</option>
            {userSectorOptions.map((setor) => <option key={setor} value={setor}>{setor}</option>)}
          </select>

          <select
            value={userStatusFilter}
            onChange={(e) => setUserStatusFilter(e.target.value as "all" | "conforme" | "pendente")}
            className="administracao-usuarios-toolbar__select"
            aria-label="Filtrar usuários por status">
            <option value="all">Todos os status</option>
            <option value="conforme">Sem solicitações em andamento</option>
            <option value="pendente">Com solicitações em andamento</option>
          </select>

          <button
            ref={extraFiltersButtonRef}
            type="button"
            className={`administracao-usuarios-toolbar__mais ${showUserExtraFilters ? "administracao-usuarios-toolbar__mais--ativo" : ""}`}
            onClick={() => setShowUserExtraFilters((value) => !value)}>
            <span>Mais filtros</span>
            <Filter size={15} />
          </button>
        </div>
        }
      </div>

      {activeTab === "users" && !selectedUser && showUserExtraFilters &&
        <motion.div
          ref={extraFiltersPanelRef}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="administracao-usuarios-filtros-extras">
          <span className="administracao-usuarios-filtros-extras__rotulo">Papel de acesso</span>
          {[
            { value: "all", label: "Todos" },
            { value: "admin", label: "Administradores" },
            { value: "moderator", label: "Moderadores" },
            { value: "user", label: "Editores" }
          ].map((item) =>
            <button
              key={item.value}
              type="button"
              onClick={() => setUserRoleFilter(item.value as "all" | "admin" | "moderator" | "user")}
              className={`administracao-usuarios-filtros-extras__chip ${userRoleFilter === item.value ? "administracao-usuarios-filtros-extras__chip--ativo" : ""}`}>
              {item.label}
            </button>
          )}
        </motion.div>
      }

      {/* 4. Tab Contents rendering */}
      <div
        key={activeTab + (activeTab === "approvals" ? approvalFilter : "") + String(selectedSector) + String(selectedUser) + String(isConfiguringSectors)}
        className="administracao__grupo-10">
        
          
          {/* ==================== CADASTRO DE IAS TAB ==================== */}
          {activeTab === "approvals" &&
        <div className="administracao__grupo-11 administracao-ias-lista">
              {paginatedApprovals.length > 0 ?
          paginatedApprovals.map((record) => {
            const recordWorkflow = workflows.find((wf) => wf.iaRecordId === record.id);
            const currentStepNum = recordWorkflow ? recordWorkflow.currentStep : 1;
            const recordStatusGeral = obterStatusDoRegistro(record);

            // Compute last comment/decision from history
            const lastParecer = record.historico?.find(
              (item) => item.action &&
              !item.action.includes("Criação") &&
              !item.action.includes("Cadastro") &&
              !item.action.includes("Atualização")
            );

            return (
              <motion.article
                key={record.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
                className="administracao__cartao administracao-ia-card">
                
                      <div className="administracao__grupo-12 administracao-ia-card__principal">
                        
                        {/* LEFT SECTION (Identity) */}
                        <div className="administracao__grupo-13 administracao-ia-card__identidade">
                          <IconeIA
                            nome={record.nomeFerramenta}
                            tamanho={36}
                            className="administracao__grupo-14 administracao-ia-card__icone"
                          />

                          <div className="administracao__grupo-15">
                            <div className="administracao__grupo-16">
                              <h3
                          onClick={() => onViewRecord(record)}
                          className="administracao__titulo-bloco">
                          
                                {record.nomeFerramenta}
                              </h3>
                              <span className="administracao__texto-4">
                                {record.id}
                              </span>
                            </div>

                            {/* Aligned corporate indicators */}
                            <div className="administracao__grupo-17 administracao-ia-card__metadados">
                              <div className="administracao__grupo-18">
                                <Database size={13} className="administracao__icone-database" />
                                <span className="administracao__texto-setor">Setor:</span> 
                                <span className="administracao__texto-5">{record.unidadeSetor}</span>
                              </div>
                              <div className="administracao__grupo-18">
                                <User size={13} className="administracao__icone-database" />
                                <span className="administracao__texto-setor">Responsável:</span> 
                                <span className="administracao__texto-5">{record.responsavelPreenchimento}</span>
                              </div>
                              <div className="administracao__grupo-18">
                                <Calendar size={13} className="administracao__icone-database" />
                                <span className="administracao__texto-setor">Criado em:</span> 
                                <span>{new Date(record.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* RIGHT SECTION (Stats, Workflow dots, Actions) */}
                        <div className="administracao__grupo-19 administracao-ia-card__lateral">
                          
                          {/* BADGES AND PROGRESS STEPS */}
                          <div className="administracao__grupo-20">
                            <div className="administracao__grupo-21">
                              
                              {/* Workflow Step Indicator Nodes */}
                              <div className="administracao__grupo-22 administracao-ia-card__etapas" title={`Fluxo de Aprovação — Etapa Atual: ${currentStepNum}/5`}>
                                {workflowSteps.map((step) => {
                            const sNum = step.stepNumber;
                            const wfStep = recordWorkflow?.steps?.find((s) => s.stepNumber === sNum);

                            const isFailed = wfStep?.status === "negado" || recordStatusGeral === "Não aprovada" && sNum === currentStepNum;
                            const isPassed = !isFailed && (
                            wfStep?.status === "aprovado" ||
                            wfStep?.status === "opiniao" ||
                            !wfStep && (sNum < currentStepNum || recordStatusGeral === "Aprovada"));

                            const isCurrent = sNum === currentStepNum && (recordStatusGeral === "Em análise" || recordStatusGeral === "Em teste") && (!wfStep || wfStep.status === "aguardando");

                            const circleStyle = isFailed
                              ? "administracao__etapa-status--negada"
                              : isPassed
                                ? "administracao__etapa-status--aprovada"
                                : isCurrent
                                  ? "administracao__etapa-status--atual"
                                  : "administracao__etapa-status--aguardando";

                            return (
                              <span
                                key={sNum}
                                className={`administracao__texto-6 ${circleStyle}`}
                                title={`${step.roleName} — ${isPassed ? 'Aprovado' : isFailed ? 'Negado/Reprovado' : isCurrent ? 'Etapa Atual' : 'Aguardando'}`}>
                                
                                      {sNum}
                                    </span>);

                          })}
                              </div>

                              {/* Status Badge */}
                              <div className="administracao__grupo-23">
                                {(() => {
                                  const status = recordStatusGeral;
                                  const finalAprovada = status === "Aprovada";
                                  const finalEncerrada = status === "Não aprovada" || status === "Cancelada";
                                  const className = finalAprovada
                                    ? "administracao__texto-aprovado"
                                    : finalEncerrada
                                      ? "administracao__texto-negado"
                                      : "administracao__texto-em-avaliacao";
                                  const Icon = finalAprovada ? CheckCircle2 : finalEncerrada ? XCircle : Activity;
                                  return (
                                    <span className={className}>
                                      <Icon size={12} /> {status}
                                    </span>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>

                          {/* ACTION BUTTONS GROUP */}
                          <div className="administracao__grupo-24 administracao-ia-card__acoes">
                            {/* Ver Ficha Technical view triggers detail modal */}
                            <button
                        onClick={() => onViewRecord(record)}
                        className="administracao__botao-ver-ficha">
                        
                              Ver ficha <ArrowUpRight size={14} />
                            </button>

                            {isCurrentUserAdmin && (
                              <button
                                onClick={() => onEditRecord?.(record)}
                                className="administracao__botao-editar">
                                <Edit size={14} /> Editar
                              </button>
                            )}

                            {isCurrentUserAdmin &&
                      <button
                        onClick={() => setResetStatusRecord(record)}
                        className="administracao__botao-redefinir-status">
                        
                                <RefreshCw size={14} /> Redefinir status
                              </button>
                      }

                            {isCurrentUserAdmin && (
                            <div className="administracao__grupo-25" data-delete-record-menu={record.id}>
                              <AnimatePresence>
                                {deleteRecordConfirmId === record.id &&
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="administracao__elemento-excluir">
                            
                                    <span className="administracao__texto-excluir">Excluir?</span>
                                    <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDeleteRecordConfirmId(null);
                              }}
                              className="administracao__botao-nao">
                              
                                      Não
                                    </button>
                                    <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onDeleteRecord?.(record.id);
                                setDeleteRecordConfirmId(null);
                              }}
                              className="administracao__botao-sim">
                              
                                      Sim
                                    </button>
                                  </motion.div>
                          }
                              </AnimatePresence>

                              <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (deleteRecordConfirmId === record.id) {
                              setDeleteRecordConfirmId(null);
                            } else {
                              setDeleteRecordConfirmId(record.id);
                            }
                          }}
                          className={`administracao__botao-excluir-registro ${
                          deleteRecordConfirmId === record.id ?
                          "administracao__botao-excluir-registro-2" :
                          "administracao__botao-excluir-registro-3"}`
                          }
                          title="Excluir Registro">
                          
                                <Trash2 size={14} /> Excluir
                              </button>
                            </div>
                            )}

                            {/* Action toggle Context Menu */}
                            <div>
                              <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (openMenuId === record.id) {
                              setOpenMenuId(null);
                              setMenuAnchor(null);
                            } else {
                              setOpenMenuId(record.id);
                              setMenuAnchor(e.currentTarget);
                            }
                          }}
                          className={`administracao__botao-acoes-administrativas ${
                          openMenuId === record.id ?
                          "administracao__botao-acoes-administrativas-2" :
                          "administracao__botao-acoes-administrativas-3"}`
                          }
                          title="Ações Administrativas">
                          
                                <MoreHorizontal size={14} />
                              </button>
                            </div>
                          </div>

                        </div>
                      </div>

                      {/* Discretely integrated latest comment/parecer banner if exists */}
                      {lastParecer &&
                <div className={`administracao__grupo-26 administracao-ia-card__parecer ${
                recordStatusGeral === "Não aprovada" ?
                "administracao__grupo-27" :
                "administracao__grupo-28"}`
                }>
                          {recordStatusGeral === "Não aprovada" ?
                  <XCircle size={14} className="administracao__icone-xcircle-2" /> :

                  <CheckCircle2 size={14} className="administracao__icone-checkcircle2-2" />
                  }
                          <div className="administracao__grupo-ultimo-parecer">
                            <p className="administracao__descricao-ultimo-parecer">Último Parecer</p>
                            <TextoExibicaoFluxoAprovacao as="span" className="administracao__texto-7">
                              &ldquo;{getCleanLastOpinion(lastParecer.message || lastParecer.action)}&rdquo;
                            </TextoExibicaoFluxoAprovacao>
                            {lastParecer.user &&
                    <span className="administracao__texto-por-em">
                                — por {lastParecer.user} em {new Date(lastParecer.date).toLocaleDateString()}
                              </span>
                    }
                          </div>
                        </div>
                }
                    </motion.article>);

          }) : (

          /* Elegant Search Empty State */
          <div className="administracao__grupo-29">
                  <div className="administracao__grupo-30">
                    <Search size={20} />
                  </div>
                  <h4 className="administracao__titulo-item-nenhum-resultado-encontrado">Nenhum resultado encontrado</h4>
                  <p className="administracao__descricao-nao-localizamos-registros-corr">
                    Não localizamos registros correspondentes ao filtro ou busca na base do Laboratório Cedro.
                  </p>
                  <button
              onClick={() => {
                setSearchTerm("");
                setApprovalFilter("all");
              }}
              className="administracao__botao-redefinir-filtros">
              
                    Redefinir Filtros
                  </button>
                </div>)
          }

              {/* Pagination controls */}
              {filteredRecords.length > ITEMS_PER_PAGE &&
          <div className="administracao__grupo-mostrando-a-de">
                  <span className="administracao__texto-mostrando-a-de-registros">
                    Mostrando {(approvalsPage - 1) * ITEMS_PER_PAGE + 1} a {Math.min(approvalsPage * ITEMS_PER_PAGE, filteredRecords.length)} de {filteredRecords.length} registros
                  </span>
                  <div className="administracao__grupo-anterior">
                    <button
                disabled={approvalsPage === 1}
                onClick={() => setApprovalsPage((p) => Math.max(1, p - 1))}
                className="administracao__botao-anterior">
                
                      <ChevronLeft size={14} /> Anterior
                    </button>
                    <button
                disabled={approvalsPage * ITEMS_PER_PAGE >= filteredRecords.length}
                onClick={() => setApprovalsPage((p) => p + 1)}
                className="administracao__botao-anterior">
                
                      Próximo <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
          }
            </div>
        }

          {/* ==================== SETORES TAB ==================== */}
          {activeTab === "sectors" &&
        <div className="administracao__grupo-10">
              
              {/* Sector Management Mode Selection */}
              {isConfiguringSectors ?
          <div className="administracao__grupo-11">
                  <div className="administracao__grupo-voltar-para-painel-setorial">
                    <button
                onClick={() => setIsConfiguringSectors(false)}
                className="administracao__botao-voltar-para-painel-setorial">
                
                      <ChevronLeft size={16} /> Voltar para Painel Setorial
                    </button>
                    <h3 className="administracao__titulo-bloco-edicao-estrutural">Edição Estrutural</h3>
                  </div>
                  
                  {/* Reuse SectorsManager beautifully */}
                  <SectorsManager
              records={records}
              profiles={profiles}
              approvalConfig={approvalConfig}
              onSaveApprovalConfig={onSaveApprovalConfig}
              onRefresh={() => {}} />
            
                </div> :
          !selectedSector ? (
          /* Main sectors list */
          <div className="administracao__grupo-10">
                  <div className="administracao__grupo-voltar-para-painel-setorial">
                    <h2 className="administracao__titulo-secao-areas-tecnicas">Áreas Técnicas</h2>
                    
                    {/* Switch to SectorsManager layout */}
                    <button
                onClick={() => setIsConfiguringSectors(true)}
                className="administracao__botao-configurar-setores">
                
                      <SlidersHorizontal size={14} className="administracao__icone-slidershorizontal" />
                      Configurar Setores
                    </button>
                  </div>

                  <div className="administracao__grupo-31">
                    {sectorData.map(([sectorName, secStats], idx) => {
                const approvalRate = secStats.total > 0 ? Math.round(secStats.approved / secStats.total * 100) : 0;
                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedSector(sectorName)}
                    className="grupo-interativo administracao__grupo-32">
                    
                          <div>
                            <div className="administracao__grupo-33">
                              <div className="administracao__grupo-34">
                                <LayoutGrid size={20} />
                              </div>
                              <div className="administracao__grupo-resumo-setor">
                                {secStats.pending > 0 &&
                          <span className="administracao__texto-pend">
                                    {secStats.pending} Pend.
                                  </span>
                          }
                                <span className="administracao__texto-ias">
                                  {secStats.total} IAs
                                </span>
                              </div>
                            </div>
                            
                            <h3 className="administracao__titulo-bloco-2">
                              {sectorName}
                            </h3>
                          </div>

                          <div className="administracao__grupo-35">
                            {/* Proportional metric bar */}
                            <div className="administracao__grupo-36">
                              <div className="administracao__grupo-aprovacao">
                                <span>Aprovação</span>
                                <span className="administracao__texto-8">{approvalRate}%</span>
                              </div>
                              <div className="administracao__grupo-37">
                                <div
                            style={{ width: `${secStats.total > 0 ? secStats.approved / secStats.total * 100 : 0}%` }}
                            className="administracao__grupo-38">
                          </div>
                                <div
                            style={{ width: `${secStats.total > 0 ? secStats.pending / secStats.total * 100 : 0}%` }}
                            className="administracao__grupo-39">
                          </div>
                                <div
                            style={{ width: `${secStats.total > 0 ? secStats.denied / secStats.total * 100 : 0}%` }}
                            className="administracao__grupo-40">
                          </div>
                              </div>
                            </div>
                          </div>
                        </div>);

              })}
                  </div>
                </div>) : (

          /* Sector Detail Drilldown */
          <div className="administracao__grupo-10">
                  <button
              onClick={() => setSelectedSector(null)}
              className="administracao__botao-voltar-para-setores">
              
                    <ChevronLeft size={16} /> Voltar para Setores
                  </button>

                  <div className="administracao__grupo-41">
                    {/* Sector Profile Statistics sidebar */}
                    <div className="administracao__grupo-42">
                      <div className="administracao__grupo-43">
                        <div className="administracao__grupo-44">
                          <LayoutGrid size={24} />
                        </div>
                        <h2 className="administracao__titulo-secao">
                          {selectedSectorInfo.name}
                        </h2>
                        <span className="administracao__texto-detalhamento-setorial">
                          Detalhamento Setorial
                        </span>

                        <div className="administracao__grupo-45">
                          {[
                    { label: "Total cadastrado", val: selectedSectorInfo.stats.total, variante: "total" },
                    { label: "Aprovadas", val: selectedSectorInfo.stats.approved, variante: "aprovado" },
                    { label: "Em andamento", val: selectedSectorInfo.stats.pending, variante: "pendente" },
                    { label: "Não aprovadas", val: selectedSectorInfo.stats.denied, variante: "negado" }].
                    map((secMetric, idx) =>
                    <div key={idx} className="administracao__grupo-46">
                              <span className="administracao__texto-9">
                                {secMetric.label}
                              </span>
                              <span className={`administracao__texto-10 administracao__metrica-valor--${secMetric.variante}`}>
                                {secMetric.val}
                              </span>
                            </div>
                    )}
                        </div>
                      </div>

                      {/* Members active inside sector */}
                      <div className="administracao__grupo-43">
                        <h3 className="administracao__titulo-bloco-usuarios-ativos">
                          <Users size={14} className="administracao__icone-slidershorizontal" /> Usuários Ativos
                        </h3>
                        
                        <div className="administracao__grupo-47">
                          {selectedSectorInfo.users.map((item, idx) =>
                    <div
                      key={idx}
                      onClick={() => {setSelectedUser(item);setActiveTab("users");}}
                      className="administracao__grupo-48">
                      
                              <div className="administracao__grupo-49">
                                {item.substring(0, 2).toUpperCase()}
                              </div>
                              <span className="administracao__texto-11">
                                {item}
                              </span>
                            </div>
                    )}
                          {selectedSectorInfo.users.length === 0 &&
                    <p className="administracao__descricao-nenhum-responsavel-vinculado">Nenhum responsável vinculado.</p>
                    }
                        </div>
                      </div>
                    </div>

                    {/* Sector Specific Inventory Content */}
                    <div className="administracao__grupo-50">
                      {selectedSectorInfo.records.map((record) =>
                <div
                  key={record.id}
                  className="administracao__grupo-51">
                  
                          <div className={`administracao__grupo-52 ${
                  obterStatusDoRegistro(record) === "Aprovada" ? "administracao__grupo-53" :
                  obterStatusDoRegistro(record) === "Não aprovada" || obterStatusDoRegistro(record) === "Cancelada" ? "administracao__grupo-54" :
                  "administracao__grupo-55"}`
                  }></div>

                          <div className="administracao__identidade-lista">
                            <IconeIA nome={record.nomeFerramenta} tamanho={28} />
                            <div className="administracao__grupo-15">
                              <h4
                      onClick={() => onViewRecord(record)}
                      className="administracao__titulo-item">
                      
                                {record.nomeFerramenta}
                              </h4>
                              <div className="administracao__grupo-56">
                                <span className="administracao__texto-12"><User size={12} /> {record.responsavelPreenchimento}</span>
                                <span className="administracao__texto-12"><Database size={12} /> {record.fornecedor}</span>
                                <span>ID: {record.id}</span>
                              </div>
                            </div>
                          </div>

                          <div className="administracao__grupo-57">
                            {/* Static status badge */}
                            {obterStatusDoRegistro(record) === "Aprovada" ?
                    <span className="administracao__texto-homologado">
                                <Check size={10} /> Aprovada
                              </span> :
                    obterStatusDoRegistro(record) === "Não aprovada" || obterStatusDoRegistro(record) === "Cancelada" ?
                    <span className="administracao__texto-recusado">
                                <X size={10} /> {obterStatusDoRegistro(record)}
                              </span> :

                    <span className="administracao__texto-em-avaliacao-2">
                                <Activity size={10} className="administracao__icone-activity-2" /> {obterStatusDoRegistro(record)}
                              </span>
                    }

                            {/* View flow button */}
                            <button
                      onClick={() => setViewFlowRecord(record)}
                      className="administracao__botao-visualizar-fluxo-de-aprovacao"
                      title="Visualizar Fluxo de Aprovação">
                      
                              <FolderLock size={12} /> Fluxo
                            </button>

                            <button
                      onClick={() => onViewRecord(record)}
                      className="administracao__botao-visualizar-ficha"
                      title="Visualizar Ficha">
                      
                              <ArrowRight size={14} />
                            </button>
                          </div>
                        </div>
                )}
                    </div>
                  </div>
                </div>)
          }
            </div>
        }

          {/* ==================== USUÁRIOS TAB ==================== */}
          {activeTab === "users" &&
        <div className="administracao__grupo-10">
              
              {!selectedUser ? (
          /* Primary corporative user directory list */
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="administracao-tabela-conteiner administracao__administracao-tabela-conteiner-estrutura administracao-usuarios-painel">
                  <div className="administracao__grupo-responsaveis-tecnicos">
                    <div>
                      <h3 className="administracao__titulo-bloco-responsaveis-tecnicos">Responsáveis Técnicos</h3>
                      <p className="administracao__descricao-gestao-de-acessos-papeis-de-co">Gestão de acessos, papéis de conformidade e contas acadêmicas</p>
                    </div>
                  </div>

                  {paginatedUsers.length > 0 ?
            <>
                      <div className="administracao__grupo-58">
                        {paginatedUsers.map(({ userProfile, userName, userIAs, hasPending, userId }) => {
                  const cargo = userProfile?.cargo || "";
                  const setor = userProfile?.setor || userIAs[0]?.unidadeSetor || "Não Associado";
                  const role = userProfile?.role || "user";

                  return (
                    <article key={userId} className="administracao__cartao-2">
                              <div className="administracao__grupo-59">
                                <div className="administracao__grupo-60">
                                  {userProfile?.avatar_url ?
                          <img src={userProfile.avatar_url} alt={userName} className="administracao__imagem" /> :

                          userName.substring(0, 2).toUpperCase()
                          }
                                </div>
                                <div className="administracao__grupo-61">
                                  <p className="administracao__descricao">{userName}</p>
                                  <p className="administracao__descricao-2">{cargo || "Cargo não informado"}</p>
                                </div>
                              </div>

                              <div className="administracao__grupo-62">
                                <div className="administracao__grupo-setor">
                                  <p className="administracao__descricao-setor">Setor</p>
                                  <p className="administracao__descricao-3">{setor}</p>
                                </div>
                                <div className="administracao__grupo-registros-ia">
                                  <p className="administracao__descricao-setor">Registros IA</p>
                                  <p className="administracao__descricao-4">{String(userIAs.length).padStart(2, "0")}</p>
                                </div>
                              </div>

                              <div className="administracao__grupo-63">
                                <span className={`administracao__texto-13 ${role === "admin" ? "administracao__texto-14" : role === "moderator" ? "administracao__texto-15" : "administracao__texto-16"}`}>
                                  {role === "admin" ? "Administrador" : role === "moderator" ? "Moderador" : "Editor de Inventário"}
                                </span>
                                <span className={`administracao__texto-17 ${hasPending ? "administracao__texto-15" : "administracao__texto-18"}`}>
                                  {hasPending ? <AlertTriangle size={10} /> : <ShieldCheck size={10} />}
                                  {hasPending ? "Com solicitações em andamento" : "Sem solicitações em andamento"}
                                </span>
                              </div>

                              <div className="administracao__grupo-64">
                                {isCurrentUserAdmin && onUpdateUserAssignments && userProfile && userProfile.id !== currentUserId &&
                        <button
                          type="button"
                          onClick={() => setEditingAssignmentsUser(userProfile)}
                          className="administracao__botao-editar-atribuicoes">
                          <Edit size={13} /> Editar setor/cargo
                        </button>
                        }
                                {onUpdateUserRole && userProfile &&
                        <button
                          disabled={updatingUserId === userProfile.id}
                          onClick={async () => {
                            setUpdatingUserId(userProfile.id);
                            try {
                              const newRole = userProfile.role === "admin" ? "user" : "admin";
                              await onUpdateUserRole(userProfile.id, newRole);
                            } finally {
                              setUpdatingUserId(null);
                            }
                          }}
                          className="administracao__botao-7">
                          
                                    {userProfile.role === "admin" ? "Revogar Admin" : "Fazer Admin"}
                                  </button>
                        }
                                <button
                          onClick={() => setSelectedUser(userName)}
                          className="administracao__botao-historico">
                          
                                  Histórico
                                </button>
                              </div>
                            </article>);

                })}
                      </div>

                    <div className="administracao__grupo-65">
                      <table className="administracao-tabela administracao__administracao-tabela-estrutura">
                        <thead>
                          <tr className="administracao__linha-tabela-nome-cargo">
                            <th className="administracao__cabecalho-coluna-nome-cargo">Nome / Cargo</th>
                            <th className="administracao__cabecalho-coluna-nome-cargo">Unidade Setorial</th>
                            <th className="administracao__cabecalho-coluna-registros-ia">Registros IA</th>
                            <th className="administracao__cabecalho-coluna-nome-cargo">Permissão / Status</th>
                            <th className="administracao__cabecalho-coluna-controles">Controles</th>
                          </tr>
                        </thead>
                        <tbody className="administracao__corpo-tabela">
                          {paginatedUsers.map(({ userItem, userProfile, userName, userIAs, hasPending, userId }) => {
                      const cargo = userProfile?.cargo || "";
                      const setor = userProfile?.setor || userIAs[0]?.unidadeSetor || "Não Associado";
                      const role = userProfile?.role || "user";

                      return (
                        <tr key={userId} className="administracao-item administracao__administracao-item-estrutura" data-usuario={userId} data-role={role}>
                                <td className="administracao__celula">
                                  <div className="administracao__grupo-66">
                                    <div className="administracao__grupo-67">
                                      {userProfile?.avatar_url ?
                                <img src={userProfile.avatar_url} alt={userName} className="administracao__imagem" /> :

                                userName.substring(0, 2).toUpperCase()
                                }
                                    </div>
                                    <div className="administracao__grupo-68">
                                      <p className="administracao__descricao-5">{userName}</p>
                                      <p className="administracao__descricao-6">{cargo}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="administracao__celula-2">
                                  {setor}
                                </td>
                                <td className="administracao__celula-3">
                                  {String(userIAs.length).padStart(2, "0")}
                                </td>
                                <td className="administracao__celula">
                                  <div className="administracao__grupo-16">
                                    {/* Role Badges */}
                                    {role === "admin" ?
                              <span className="administracao__texto-administrador">
                                        Administrador
                                      </span> :
                              role === "moderator" ?
                              <span className="administracao__texto-moderador">
                                        Moderador
                                      </span> :

                              <span className="administracao__texto-editor-de-inventario">
                                        Editor de Inventário
                                      </span>
                              }

                                    {/* Governance State Badge */}
                                    {hasPending ?
                              <span className="administracao__texto-pendencias">
                                        <AlertTriangle size={10} /> Com solicitações em andamento
                                      </span> :

                              <span className="administracao__texto-conformidade">
                                        <ShieldCheck size={10} /> Sem solicitações em andamento
                                      </span>
                              }
                                  </div>
                                </td>
                                <td className="administracao__celula-4">
                                  <div className="administracao__grupo-69">
                                    
                                    {isCurrentUserAdmin && onUpdateUserAssignments && userProfile && userProfile.id !== currentUserId &&
                              <button
                                type="button"
                                onClick={() => setEditingAssignmentsUser(userProfile)}
                                className="administracao__botao-editar-atribuicoes"
                                title="Editar setor e cargo">
                                <Edit size={13} /> Editar setor/cargo
                              </button>
                              }

                                    {/* Permission Adjusters if Handler is provided */}
                                    {onUpdateUserRole && userProfile &&
                              <div className="administracao__grupo-70">
                                        <button
                                  disabled={updatingUserId === userProfile.id}
                                  onClick={async () => {
                                    setUpdatingUserId(userProfile.id);
                                    try {
                                      const newRole = userProfile.role === "admin" ? "user" : "admin";
                                      await onUpdateUserRole(userProfile.id, newRole);
                                    } finally {
                                      setUpdatingUserId(null);
                                    }
                                  }}
                                  className={`administracao__botao-alternar-permissao-administrad ${
                                  userProfile.role === "admin" ?
                                  "administracao__botao-alternar-permissao-administrad-2" :
                                  "administracao__botao-alternar-permissao-administrad-3"}`
                                  }
                                  title="Alternar permissão Administrador">
                                  
                                          {userProfile.role === "admin" ? "Revogar Admin" : "Fazer Admin"}
                                        </button>
                                      </div>
                              }

                                    {/* Histórico Drilldown triggering view */}
                                    <button
                                onClick={() => setSelectedUser(userName)}
                                className="administracao__botao-historico-2">
                                
                                      Histórico <ArrowRight size={11} />
                                    </button>

                                    {/* Danger User Removal with protection confirms */}
                                    {onDeleteUser && userProfile &&
                              <div className="administracao__grupo-71" data-user-delete-menu={userProfile.id}>
                                        {showDeleteConfirm === userProfile.id ?
                                <div className="administracao__grupo-excluir">
                                            <p className="administracao__descricao-excluir">Excluir?</p>
                                            <div className="administracao__grupo-nao">
                                              <button
                                      onClick={() => setShowDeleteConfirm(null)}
                                      className="administracao__botao-nao-2">
                                      
                                                Não
                                              </button>
                                              <button
                                      onClick={async () => {
                                        setDeletingUserId(userProfile.id);
                                        try {
                                          await onDeleteUser(userProfile.id);
                                        } finally {
                                          setDeletingUserId(null);
                                          setShowDeleteConfirm(null);
                                        }
                                      }}
                                      className="administracao__botao-sim-2">
                                      
                                                Sim
                                              </button>
                                            </div>
                                          </div> :
                                null}

                                        <button
                                  onClick={() => setShowDeleteConfirm((current) => current === userProfile.id ? null : userProfile.id)}
                                  className="administracao__botao-deletar-conta-permanentemente"
                                  title="Deletar Conta Permanentemente">
                                  
                                          <MoreHorizontal size={16} />
                                        </button>
                                      </div>
                              }

                                  </div>
                                </td>
                              </tr>);

                    })}
                        </tbody>
                      </table>
                    </div>
                    </> :

            <div className="administracao__grupo-nenhum-responsavel-atende-aos-">
                      Nenhum responsável atende aos critérios de pesquisa.
                    </div>
            }

                  {/* Users Pagination */}
                  <div className="administracao-usuarios-paginacao">
                    <span className="administracao-usuarios-paginacao__resumo">
                      {usersWithStats.length > 0
                        ? `Mostrando ${(usersPage - 1) * usersPageSize + 1} a ${Math.min(usersPage * usersPageSize, usersWithStats.length)} de ${usersWithStats.length} usuários`
                        : "Nenhum usuário encontrado"}
                    </span>

                    <div className="administracao-usuarios-paginacao__paginas">
                      <button
                        type="button"
                        disabled={usersPage === 1}
                        onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                        className="administracao-usuarios-paginacao__botao"
                        aria-label="Página anterior">
                        <ChevronLeft size={16} />
                      </button>
                      {Array.from({ length: Math.max(1, Math.ceil(usersWithStats.length / usersPageSize)) }, (_, index) => index + 1)
                        .slice(Math.max(0, usersPage - 2), Math.max(0, usersPage - 2) + 3)
                        .map((pageNumber) =>
                          <button
                            key={pageNumber}
                            type="button"
                            onClick={() => setUsersPage(pageNumber)}
                            className={`administracao-usuarios-paginacao__botao ${usersPage === pageNumber ? "administracao-usuarios-paginacao__botao--ativo" : ""}`}>
                            {pageNumber}
                          </button>
                        )}
                      <button
                        type="button"
                        disabled={usersPage * usersPageSize >= usersWithStats.length}
                        onClick={() => setUsersPage((p) => p + 1)}
                        className="administracao-usuarios-paginacao__botao"
                        aria-label="Próxima página">
                        <ChevronRight size={16} />
                      </button>
                    </div>

                    <label className="administracao-usuarios-paginacao__tamanho">
                      <span>Itens por página:</span>
                      <select value={usersPageSize} onChange={(e) => setUsersPageSize(Number(e.target.value))}>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                      </select>
                    </label>
                  </div>
                </motion.div>) : (

          /* User Custody Profile History Drilldown view */
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="administracao-historico-usuario">
            <button
              onClick={() => setSelectedUser(null)}
              className="administracao-historico-usuario__voltar">
              <ChevronLeft size={16} />
              <span>Voltar para Pesquisa de Usuários</span>
            </button>

            <div className="administracao-historico-usuario__layout">
              <aside className="administracao-historico-usuario__perfil">
                <div className="administracao-historico-usuario__avatar">
                  {selectedUserInfo.profile?.avatar_url ?
                    <img src={selectedUserInfo.profile.avatar_url} alt={selectedUserInfo.name} /> :
                    <span>{selectedUserInfo.name.substring(0, 2).toUpperCase()}</span>
                  }
                </div>

                <h2 className="administracao-historico-usuario__nome">{selectedUserInfo.name}</h2>
                <p className="administracao-historico-usuario__cargo">
                  {selectedUserInfo.profile?.cargo || "Cargo não informado"}
                </p>

                <span className="administracao-historico-usuario__ativo">
                  <ShieldCheck size={12} /> Perfil ativo
                </span>

                <div className="administracao-historico-usuario__dados">
                  <div className="administracao-historico-usuario__dado">
                    <span className="administracao-historico-usuario__dado-icone"><Building2 size={17} /></span>
                    <div>
                      <span className="administracao-historico-usuario__dado-rotulo">Unidade setorial</span>
                      <strong>{selectedUserInfo.sector}</strong>
                    </div>
                  </div>

                  <div className="administracao-historico-usuario__dado">
                    <span className="administracao-historico-usuario__dado-icone"><KeyRound size={17} /></span>
                    <div>
                      <span className="administracao-historico-usuario__dado-rotulo">Nível de acesso</span>
                      <strong>
                        {selectedUserInfo.profile?.role === "admin" ? "Administrador corporativo" :
                          selectedUserInfo.profile?.role === "moderator" ? "Moderador" : "Editor de Inventário"}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="administracao-historico-usuario__metricas">
                  <div>
                    <span>Cadastros totais</span>
                    <strong>{selectedUserInfo.records.length}</strong>
                  </div>
                  <div>
                    <span>Aprovadas</span>
                    <strong className="administracao-historico-usuario__numero--aprovado">{selectedUserInfo.stats.approved}</strong>
                  </div>
                  <div>
                    <span>Em andamento</span>
                    <strong className="administracao-historico-usuario__numero--pendente">{selectedUserInfo.stats.pending}</strong>
                  </div>
                </div>
              </aside>

              <section className="administracao-historico-usuario__custodia">
                <header className="administracao-historico-usuario__cabecalho">
                  <h3>Ferramentas e cadastros sob custódia</h3>
                  <p>Relação de ferramentas e cadastros sob responsabilidade deste usuário.</p>
                </header>

                <div className="administracao-historico-usuario__lista">
                  {selectedUserInfo.records.map((record, index) => {
                    const statusLabel = obterStatusDoRegistro(record);
                    const statusClass = statusLabel === "Aprovada"
                      ? "aprovado"
                      : statusLabel === "Não aprovada" || statusLabel === "Cancelada"
                        ? "negado"
                        : "analise";

                    return (
                      <motion.article
                        key={record.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(index * 0.035, 0.18) }}
                        className={`administracao-historico-usuario__registro administracao-historico-usuario__registro--${statusClass}`}>
                        <IconeIA
                          nome={record.nomeFerramenta}
                          tamanho={36}
                          className="administracao-historico-usuario__ia-icone"
                        />

                        <div className="administracao-historico-usuario__registro-conteudo">
                          <h4>{record.nomeFerramenta}</h4>
                          <div className="administracao-historico-usuario__registro-meta">
                            <span><strong>Fornecedor:</strong> {record.fornecedor || "Não informado"}</span>
                            <span><strong>Data de cadastro:</strong> {new Date(record.createdAt).toLocaleDateString("pt-BR")}</span>
                            <span><strong>ID:</strong> {record.id}</span>
                          </div>
                        </div>

                        <div className="administracao-historico-usuario__registro-acoes">
                          <span className={`administracao-historico-usuario__status administracao-historico-usuario__status--${statusClass}`}>
                            {statusLabel}
                          </span>
                          <button
                            type="button"
                            onClick={() => onViewRecord(record)}
                            className="administracao-historico-usuario__abrir"
                            title="Visualizar ficha">
                            <ArrowRight size={18} />
                          </button>
                        </div>
                      </motion.article>
                    );
                  })}

                  {selectedUserInfo.records.length === 0 &&
                    <div className="administracao-historico-usuario__vazio">
                      <Database size={24} />
                      <strong>Nenhum registro sob custódia</strong>
                      <span>Este usuário ainda não possui registros de IA associados.</span>
                    </div>
                  }
                </div>
              </section>
            </div>
          </motion.div>)
          }
            </div>
        }

          {/* ==================== SYSTEM CONTROLS TAB ==================== */}
          {activeTab === "system_controls" &&
        <SystemControls
          supabaseStatus={supabaseStatus}
          records={records} />

        }

        </div>

      {editingAssignmentsUser && onUpdateUserAssignments &&
      <ModalEditarAtribuicoesUsuario
        usuario={editingAssignmentsUser}
        onClose={() => setEditingAssignmentsUser(null)}
        onSave={onUpdateUserAssignments} />
      }

      {/* ==================== HISTÓRICO E FLUXO VISUAL DE APROVAÇÃO (READ-ONLY) ==================== */}
      <AnimatePresence>
        {viewFlowRecord &&
        <div className="cedro-modal-overlay administracao__grupo-76">
            <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setViewFlowRecord(null)}
            className="administracao__elemento" />
          
            
            <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            className="cedro-modal-painel administracao__elemento-2">
            
              <div className="administracao__grupo-77">
                {/* Header */}
                <div className="administracao__grupo-78">
                  <IconeIA
                    nome={viewFlowRecord.nomeFerramenta}
                    tamanho={36}
                    className="administracao__grupo-79"
                  />
                  <div className="administracao__grupo-visualizar-fluxo-de-aprovacao">
                    <h3 className="administracao__titulo-bloco-visualizar-fluxo-de-aprovacao">
                      Visualizar Fluxo de Aprovação
                    </h3>
                    <p className="administracao__descricao-protocolo">
                      {viewFlowRecord.nomeFerramenta} — Protocolo: {viewFlowRecord.id}
                    </p>
                  </div>
                </div>

                {/* Brief IA details */}
                <div className="administracao__grupo-80">
                  <div className="administracao__grupo-setor-solicitante">
                    <div>
                      <p className="administracao__descricao-setor-solicitante">Setor solicitante</p>
                      <p className="administracao__descricao-8">{viewFlowRecord.unidadeSetor}</p>
                      <p className="administracao__descricao-9">{viewFlowRecord.responsavelPreenchimento}</p>
                    </div>
                    <div>
                      <p className="administracao__descricao-setor-solicitante">Status Auditoria</p>
                      <p className="administracao__descricao-10">
                        {obterStatusDoRegistro(viewFlowRecord).toUpperCase()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Vertical Timeline Steps */}
                <div className="administracao__grupo-11">
                  <h4 className="administracao__titulo-item-historico-de-alcadas-e-etapas">Histórico de Alçadas e Etapas</h4>
                  <div className="administracao__grupo-81">
                    {currentFlowSteps.map((step) => {
                    const isComplete = step.status === "aprovado" || step.status === "opinado" || step.status === "decidido";
                    const isRejected = step.status === "negado" || step.status === "rejeitado" || step.status === "indeferido";
                    const isPending = step.status === "pendente" || step.status === "em_avaliacao" || step.status === "aguardando";

                    return (
                      <div key={step.stepNumber} className="administracao__grupo-25">
                          {/* Circle indicator node */}
                          <div className={`administracao__grupo-82 ${
                        isComplete ?
                        "administracao__grupo-83" :
                        isRejected ?
                        "administracao__grupo-84" :
                        isPending && step.stepNumber === (activeFlowWf?.currentStep || 1) ?
                        "administracao__grupo-85" :
                        "administracao__grupo-86"}`
                        }>
                            {isComplete ? <Check size={11} strokeWidth={3} /> :
                          isRejected ? <X size={11} strokeWidth={3} /> :
                          <span className="administracao__texto-23">{step.stepNumber}</span>}
                          </div>

                          {/* Content */}
                          <div className="administracao__grupo-36">
                            <div className="administracao__grupo-etapa">
                              <span className="administracao__texto-etapa">
                                Etapa {step.stepNumber}: {step.roleName}
                              </span>
                              {step.isOpinionOnly &&
                            <span className="administracao__texto-opinativo">
                                  Opinativo
                                </span>
                            }
                              {isPending && step.stepNumber === (activeFlowWf?.currentStep || 1) &&
                            <span className="administracao__texto-aguardando-decisao">
                                  Aguardando Decisão
                                </span>
                            }
                            </div>
                            <p className="administracao__texto-pagina-de">
                              Designado: <span className="administracao__texto-24">{step.assignedUserName}</span>
                            </p>

                            {/* Comment speech bubble */}
                            {step.comment &&
                          <div className="administracao__grupo-87">
                                <p className="administracao__descricao-11">"{step.comment}"</p>
                                {step.decidedAt &&
                            <p className="administracao__descricao-registrado-em">
                                    Registrado em {new Date(step.decidedAt).toLocaleString("pt-BR")}
                                  </p>
                            }
                              </div>
                          }
                          </div>
                        </div>);

                  })}
                  </div>
                </div>

                {/* Footer action */}
                <div className="administracao__grupo-fechar">
                  {onNavigate ?
                <button
                  onClick={() => {
                    setViewFlowRecord(null);
                    onNavigate("approval_queue");
                  }}
                  className="administracao__botao-ir-para-a-fila-oficial-de-apro">
                  
                      Ir para a fila oficial de aprovação <ArrowUpRight size={14} />
                    </button> :
                <div />}

                  <button
                  onClick={() => setViewFlowRecord(null)}
                  className="administracao__botao-fechar">
                  
                    Fechar
                  </button>
                </div>

              </div>
            </motion.div>
          </div>
        }
      </AnimatePresence>

      {/* ==================== REDEFINIR STATUS (MODAL DE CONFIRMAÇÃO) ==================== */}
      <AnimatePresence>
        {resetStatusRecord &&
        <div className="cedro-modal-overlay administracao__grupo-76">
            <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {if (!isResetting) setResetStatusRecord(null);}}
            className="administracao__elemento" />
          
            
            <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            className="cedro-modal-painel administracao__elemento-3">
            
              <div className="administracao__grupo-88">
                
                {/* Header */}
                <div className="administracao__grupo-89">
                  <div className="administracao__grupo-90">
                    <RefreshCw size={24} className="administracao__icone-refreshcw" />
                  </div>
                  <div>
                    <h3 className="administracao__titulo-bloco-redefinir-status-da-ia">
                      Redefinir status da IA
                    </h3>
                    <p className="administracao__descricao-altere-manualmente-o-status-de">
                      Altere manualmente o status desta solicitação. Essa ação não apaga o histórico e deve ser usada apenas para correções administrativas.
                    </p>
                  </div>
                </div>

                {/* Resumo da IA */}
                <div className="administracao__grupo-nome-da-ia">
                  <div>
                    <span className="administracao__texto-nome-da-ia">Nome da IA</span>
                    <span className="administracao__texto-25" title={resetStatusRecord.nomeFerramenta}>{resetStatusRecord.nomeFerramenta}</span>
                  </div>
                  <div>
                    <span className="administracao__texto-nome-da-ia">ID/Protocolo</span>
                    <span className="administracao__texto-26" title={resetStatusRecord.id}>{resetStatusRecord.id}</span>
                  </div>
                  <div>
                    <span className="administracao__texto-nome-da-ia">Setor solicitante</span>
                    <span className="administracao__texto-27" title={resetStatusRecord.unidadeSetor}>{resetStatusRecord.unidadeSetor}</span>
                  </div>
                  <div>
                    <span className="administracao__texto-nome-da-ia">Status atual</span>
                    <span
                      className="administracao__texto-27"
                      title={obterStatusGeralDoRegistro(
                        resetStatusRecord,
                        workflows.find((wf) => wf.iaRecordId === resetStatusRecord.id),
                      )}
                    >
                      {obterStatusGeralDoRegistro(
                        resetStatusRecord,
                        workflows.find((wf) => wf.iaRecordId === resetStatusRecord.id),
                      )}
                    </span>
                  </div>
                </div>

                {/* Campo 1 — Novo status */}
                <div className="administracao__grupo-novo-status">
                  <label className="administracao__rotulo-novo-status">
                    Novo status <span className="administracao__texto-28">*</span>
                  </label>
                  <CustomDropdown
                  value={selectedNewStatus}
                  onChange={(val) => setSelectedNewStatus(val as StatusUso)}
                  disabled={isResetting}
                  options={STATUS_REDEFINICAO_ADMIN.map((value) => ({
                    value,
                    label:
                      value === StatusUso.EM_AVALIACAO ? "Em análise" :
                      value === StatusUso.APROVADO ? "Aprovada" :
                      "Não aprovada",
                  }))}
                  size="md" />
                
                </div>

                {/* Campo 2 — Justificativa da alteração */}
                <div className="administracao__grupo-novo-status">
                  <label className="administracao__rotulo-justificativa-da-redefinicao">
                    <span>Justificativa da redefinição <span className="administracao__texto-28">*</span></span>
                  </label>
                  <textarea
                  value={resetReason}
                  onChange={(e) => setResetReason(e.target.value)}
                  disabled={isResetting}
                  placeholder="Explique brevemente o motivo da alteração administrativa do status."
                  className="administracao__campo-texto-explique-brevemente-o-motivo-d" />
                
                  {!resetReason.trim() &&
                <p className="administracao__descricao-informe-uma-justificativa-para">
                      Informe uma justificativa para redefinir o status da IA.
                    </p>
                }
                </div>

                {/* Footer confirm triggers */}
                <div className="administracao__grupo-cancelar">
                  <button
                  onClick={() => {
                    setResetStatusRecord(null);
                    setResetReason("");
                  }}
                  disabled={isResetting}
                  className="administracao__botao-cancelar">
                  
                    Cancelar
                  </button>
                  <button
                  onClick={async () => {
                    if (!resetStatusRecord || !onResetStatus) return;
                    if (!resetReason.trim()) {
                      alert("Informe uma justificativa para redefinir o status da IA.");
                      return;
                    }
                    setIsResetting(true);
                    try {
                      await onResetStatus(resetStatusRecord.id, selectedNewStatus, resetReason);
                      setResetStatusRecord(null);
                      setResetReason("");
                    } catch (err) {
                      console.error(err);
                    } finally {
                      setIsResetting(false);
                    }
                  }}
                  disabled={isResetting || !resetReason.trim()}
                  className="administracao__botao-8">
                  
                    {isResetting ?
                  <>
                        <RefreshCw size={12} className="administracao__icone-refreshcw-2" /> Salvando...
                      </> :

                  <>
                        Salvar alteração
                      </>
                  }
                  </button>
                </div>

              </div>
            </motion.div>
          </div>
        }
      </AnimatePresence>

      {/* ==================== DROPDOWN MENU WITH PORTAL ==================== */}
      <AnimatePresence>
        {openMenuId && menuAnchor &&
        <AdminDropdownPortal
          record={records.find((r) => r.id === openMenuId)!}
          anchorEl={menuAnchor}
          onClose={() => {
            setOpenMenuId(null);
            setMenuAnchor(null);
          }}
          onViewRecord={onViewRecord}
          onEditRecord={onEditRecord}
          onViewFlow={(rec) => setViewFlowRecord(rec)}
          onResetStatusTrigger={(rec) => setResetStatusRecord(rec)}
          handleArchiveRecord={handleArchiveRecord}
          isAdmin={isCurrentUserAdmin} />

        }
      </AnimatePresence>

    </div>);

}
