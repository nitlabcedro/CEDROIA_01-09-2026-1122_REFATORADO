/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { CustomDropdown } from "@/componentes/comuns/MenuSuspenso";
import {
  Building2,
  Plus,
  Search,
  Users,
  Database,
  AlertCircle,
  Check,
  X,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  User,
  Activity,
  FileText,
  SlidersHorizontal,
  CircleDot,
  Briefcase,
  Lightbulb,
  Cpu,
  Megaphone,
  Scale,
  ClipboardCheck,
  FlaskConical,
  Microscope } from
"lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import "@/estilos/paginas/setores-referencia.css";
import { IARecord, UserProfile } from "@/tipos";
import { getSectorDetails, getSectors, saveSectors } from "@/servicos/armazenamento";

interface SectorsProps {
  records: IARecord[];
  profiles: UserProfile[];
  onRefresh?: () => void;
  approvalConfig?: any;
  onSaveApprovalConfig?: any;
}

interface SectorDetail {
  description: string;
  responsible: string;
  status: "Ativo" | "Inativo";
  cargos?: string[];
}

// Predefined detailed description & representatives mapping of institutional sectors
const PRESET_SECTORS_DETAILS: Record<string, SectorDetail> = {
  "NIT": {
    description: "Núcleo de Inovação e Tecnologia responsável por pesquisa, desenvolvimento e inovação estruturada do laboratório.",
    responsible: "Ricardo Almeida",
    status: "Ativo",
    cargos: ["Pesquisador de IA", "Analista de Inovação", "Gestor de Portfólio", "Engenheiro de Processos"]
  },
  "TI": {
    description: "Gerencia a infraestrutura cibernética, servidores locais, sistemas internos e suporte tecnológico de alta performance.",
    responsible: "Mariana Souza",
    status: "Ativo",
    cargos: ["Analista de Suporte", "Administrador de Sistemas", "Desenvolvedor de Software", "Engenheiro de Dados"]
  },
  "Marketing": {
    description: "Responsável pela comunicação institucional, reputação de marca e relacionamento estratégico com o público.",
    responsible: "Juliana Martins",
    status: "Ativo",
    cargos: ["Analista de Comunicação", "Designer Gráfico", "Especialista em SEO", "Social Media"]
  },
  "Administrativo": {
    description: "Cuida do planejamento estratégico administrativo, fluxos financeiros e suporte de governança corporativa.",
    responsible: "Carlos Henrique",
    status: "Ativo",
    cargos: ["Auxiliar Administrativo", "Assistente Financeiro", "Gerente de Operações", "Analista de Contratos"]
  },
  "Jurídico": {
    description: "Responsável pelo suporte legal, conformidade com a LGPD, redação de contratos e assessoria regulatória geral.",
    responsible: "Beatriz Lima",
    status: "Ativo",
    cargos: ["Advogado Integrado", "Assessor LGPD", "Consultor Regulatório", "Assistente Jurídico"]
  },
  "Direção Técnica": {
    description: "Liderança médica, supervisão de laudos técnicos e garantia irrestrita de qualidade analítica laboratorial.",
    responsible: "Dr. Felipe Costa",
    status: "Ativo",
    cargos: ["Diretor Técnico", "Supervisor Analítico", "Responsável Técnico", "Auditor Médico"]
  },
  "Qualidade": {
    description: "Coordena acreditações de qualidade, aplicação jurídica de normas ISO e planos de verificação de processos sanitários.",
    responsible: "Ana Teresa",
    status: "Ativo",
    cargos: ["Gestor de Qualidade", "Analista de Qualidade", "Auditor de Processos", "Inspetor Sanitário"]
  },
  "Atendimento / Recepção": {
    description: "Suporte direto do público na triagem, agendamentos presenciais e pesquisa ativa de satisfação clínica.",
    responsible: "Fernanda Costa",
    status: "Ativo",
    cargos: ["Recepcionista", "Atendente Técnico", "Supervisor de Relacionamento", "Auxiliar de Caixa"]
  },
  "Laboratório de Patologia": {
    description: "Preparação macroscópica de biópsias, análises citológicas detalhadas e controle de laudos imuno-histoquímicos.",
    responsible: "Dr. Sergio Morais",
    status: "Ativo",
    cargos: ["Médico Patologista", "Técnico em Histologia", "Citotécnico", "Auxiliar de Laboratório"]
  },
  "Laboratório Central": {
    description: "Processamento automatizado de exames bioquímicos e hematológicos de rotina clínica emergencial ou diagnóstica.",
    responsible: "Dra. Heloísa Abreu",
    status: "Ativo",
    cargos: ["Biomédico Palestrante", "Técnico em Análises Clínicas", "Farmacêutico Bioquímico", "Auxiliar de Coleta"]
  }
};

/**
 * Returns dynamic professional icons styled for standard department designations
 */
function getSectorIcon(name: string) {
  const norm = name.toLowerCase().trim();
  if (norm.includes("nit") || norm.includes("inovação") || norm.includes("tecnologia")) return Lightbulb;
  if (norm.includes("ti") || norm.includes("tecnologia da informação") || norm.includes("infraestrutura") || norm.includes("suporte")) return Cpu;
  if (norm.includes("marketing") || norm.includes("comunicação")) return Megaphone;
  if (norm.includes("administrativo") || norm.includes("financeiro") || norm.includes("diretoria") || norm.includes("corporativo")) return Briefcase;
  if (norm.includes("jurídico") || norm.includes("legal") || norm.includes("contratos")) return Scale;
  if (norm.includes("técnica") || norm.includes("direção técnica")) return Activity;
  if (norm.includes("qualidade") || norm.includes("gestão de qualidade")) return ClipboardCheck;
  if (norm.includes("atendimento") || norm.includes("recepção")) return Users;
  if (norm.includes("patologia") || norm.includes("biópsia")) return Microscope;
  if (norm.includes("central") || norm.includes("laboratório")) return FlaskConical;
  return Building2;
}

export default function SectorsManager({ records, profiles, onRefresh }: SectorsProps) {
  const [sectors, setSectors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusSelect, setStatusSelect] = useState<"All" | "Ativo" | "Inativo">("All");
  const [quickFilter, setQuickFilter] = useState<"All" | "Active" | "Inactive" | "WithIA" | "WithoutIA">("All");

  // Sector Meta Info Dictionary
  const [sectorDetails, setSectorDetails] = useState<Record<string, SectorDetail>>(PRESET_SECTORS_DETAILS);

  // Action states
  const [activeMenuSector, setActiveMenuSector] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Modal form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | "view">("create");
  const [selectedSectorName, setSelectedSectorName] = useState<string | null>(null);
  const [deleteConfirmSector, setDeleteConfirmSector] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formResponsible, setFormResponsible] = useState("");
  const [formStatus, setFormStatus] = useState<"Ativo" | "Inativo">("Ativo");
  const [formCargos, setFormCargos] = useState<string[]>([]);
  const [newCargoInput, setNewCargoInput] = useState("");

  const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 220, damping: 22 }
    }
  };

  const isNameDuplicate =
  modalMode === "create" ?
  formName.trim() !== "" && sectors.some((s) => s.toLowerCase().trim() === formName.toLowerCase().trim()) :
  modalMode === "edit" ?
  selectedSectorName !== null && formName.trim() !== "" && formName.toLowerCase().trim() !== selectedSectorName.toLowerCase().trim() && sectors.some((s) => s.toLowerCase().trim() === formName.toLowerCase().trim()) :
  false;

  // Load baseline sector names from DB / storage
  const fetchSectorsList = async () => {
    setLoading(true);
    try {
      const list = await getSectors();
      setSectors(list);
      setSectorDetails((current) => ({
        ...current,
        ...(getSectorDetails() as Record<string, SectorDetail>)
      }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSectorsList();
  }, []);

  // Merge dynamic properties and metrics with sector names
  const sectorsWithMetrics = useMemo(() => {
    return sectors.map((sectorName) => {
      const sectorIAs = records.filter((r) => (r.unidadeSetor || "").trim().toLowerCase() === sectorName.trim().toLowerCase());
      const sectorProfiles = profiles.filter((p) => (p.setor || "").trim().toLowerCase() === sectorName.trim().toLowerCase());

      const details = sectorDetails[sectorName] || PRESET_SECTORS_DETAILS[sectorName] || {
        description: `Setor estratégico para suporte analítico e operações do Laboratório Cedro.`,
        responsible: "Gestor Cedro",
        status: "Ativo" as const
      };

      return {
        name: sectorName,
        iaCount: sectorIAs.length,
        userCount: sectorProfiles.length,
        description: details.description,
        responsible: details.responsible,
        status: details.status
      };
    });
  }, [sectors, records, profiles, sectorDetails]);

  // Unified filtering: statusSelect, quickFilter, searchTerm
  const filteredSectors = useMemo(() => {
    return sectorsWithMetrics.filter((sec) => {
      // 1. Search term (matches name, description or responsible)
      const matchesSearch = !searchTerm.trim() ||
      sec.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sec.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sec.responsible.toLowerCase().includes(searchTerm.toLowerCase());

      // 2. Status Select filter
      const matchesStatusSelect = statusSelect === "All" || sec.status === statusSelect;

      // 3. Quick select chips
      let matchesQuick = true;
      if (quickFilter === "Active") matchesQuick = sec.status === "Ativo";
      if (quickFilter === "Inactive") matchesQuick = sec.status === "Inativo";
      if (quickFilter === "WithIA") matchesQuick = sec.iaCount > 0;
      if (quickFilter === "WithoutIA") matchesQuick = sec.iaCount === 0;

      return matchesSearch && matchesStatusSelect && matchesQuick;
    });
  }, [sectorsWithMetrics, searchTerm, statusSelect, quickFilter]);

  // Stats calculation for Summary panel
  const statsSummary = useMemo(() => {
    const total = sectorsWithMetrics.length;
    const active = sectorsWithMetrics.filter((s) => s.status === "Ativo").length;
    const withIA = sectorsWithMetrics.filter((s) => s.iaCount > 0).length;
    const totalIAs = records.length;

    // total from profiles prop
    const totalProfiles = profiles.length;

    const withoutIA = Math.max(0, total - withIA);
    const withIAPercent = total > 0 ? Math.round(withIA / total * 100) : 0;
    const withoutIAPercent = total > 0 ? 100 - withIAPercent : 0;

    return {
      total,
      active,
      withIA,
      withoutIA,
      totalIAs,
      totalProfiles,
      withIAPercent,
      withoutIAPercent
    };
  }, [sectorsWithMetrics, records, profiles]);

  // Pagination bounds checking
  const totalPages = Math.ceil(filteredSectors.length / itemsPerPage) || 1;
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const paginatedSectors = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredSectors.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSectors, currentPage]);

  // Click outside to close actions menu helper
  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuSector(null);
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  // Form Handlers
  const handleOpenCreateModal = () => {
    setModalMode("create");
    setSelectedSectorName(null);
    setFormName("");
    setFormDescription("");
    setFormResponsible("");
    setFormStatus("Ativo");
    setFormCargos(["Colaborador"]);
    setNewCargoInput("");
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (sec: typeof sectorsWithMetrics[0]) => {
    setModalMode("edit");
    setSelectedSectorName(sec.name);
    setFormName(sec.name);
    setFormDescription(sec.description);
    setFormResponsible(sec.responsible);
    setFormStatus(sec.status);

    const details = sectorDetails[sec.name] || PRESET_SECTORS_DETAILS[sec.name] || {};
    setFormCargos(details.cargos || ["Colaborador"]);
    setNewCargoInput("");

    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenViewModal = (sec: typeof sectorsWithMetrics[0]) => {
    setModalMode("view");
    setSelectedSectorName(sec.name);
    setFormName(sec.name);
    setFormDescription(sec.description);
    setFormResponsible(sec.responsible);
    setFormStatus(sec.status);

    const details = sectorDetails[sec.name] || PRESET_SECTORS_DETAILS[sec.name] || {};
    setFormCargos(details.cargos || ["Colaborador"]);
    setNewCargoInput("");

    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (sectorName: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const current = sectorDetails[sectorName] || PRESET_SECTORS_DETAILS[sectorName] || {
      description: "Setor estratégico Cedro.",
      responsible: "Gestor Cedro",
      status: "Ativo"
    };

    const newStatus = current.status === "Ativo" ? "Inativo" : "Ativo";
    const previousDetails = sectorDetails;
    const nextDetails = {
      ...sectorDetails,
      [sectorName]: {
        ...current,
        status: newStatus
      }
    };

    setSectorDetails(nextDetails);
    const ok = await saveSectors(sectors, nextDetails);
    if (!ok) {
      setSectorDetails(previousDetails);
      setErrorMsg("Não foi possível atualizar o status do setor.");
      return;
    }

    setSuccessMsg(`O status do setor "${sectorName}" foi alterado para ${newStatus}.`);
  };

  const handleDeleteSector = async (sectorName: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const updatedSectors = sectors.filter((s) => s !== sectorName);
    const previousSectors = [...sectors];
    const previousDetails = sectorDetails;
    const nextDetails = { ...sectorDetails };
    delete nextDetails[sectorName];
    setSectors(updatedSectors);
    setSectorDetails(nextDetails);

    try {
      const ok = await saveSectors(updatedSectors, nextDetails);
      if (ok) {
        setSuccessMsg(`Setor "${sectorName}" removido com sucesso.`);
        if (onRefresh) onRefresh();
      } else {
        setErrorMsg("Erro ao atualizar os metadados de setores após a exclusão.");
        setSectors(previousSectors);
        setSectorDetails(previousDetails);
      }
    } catch (e: any) {
      console.error("Erro inesperado na exclusão do setor:", e);
      setErrorMsg(`Erro inesperado ao excluir: ${e.message || e}`);
      setSectors(previousSectors);
      setSectorDetails(previousDetails);
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const sName = formName.trim();
    if (!sName) return;

    if (modalMode === "create") {
      // Check duplicate
      if (sectors.some((s) => s.toLowerCase().trim() === sName.toLowerCase())) {
        setErrorMsg("Este setor já existe.");
        return;
      }

      const updated = [...sectors, sName];
      const nextDetails = {
        ...sectorDetails,
        [sName]: {
          description: formDescription.trim() || "Setor de saúde e governança corporativa.",
          responsible: formResponsible.trim() || "Não especificado",
          status: formStatus,
          cargos: formCargos.length > 0 ? formCargos : ["Colaborador"]
        }
      };
      setSectors(updated);
      setSectorDetails(nextDetails);
      const ok = await saveSectors(updated, nextDetails);
      if (ok) {
        setSuccessMsg(`Setor "${sName}" criado com sucesso!`);
        setIsModalOpen(false);
        if (onRefresh) onRefresh();
      } else {
        setErrorMsg("Falha ao salvar o novo setor. Verifique a conexão.");
        setSectors(sectors);
        setSectorDetails(sectorDetails);
      }

    } else if (modalMode === "edit" && selectedSectorName) {
      let updatedSectors = [...sectors];
      if (selectedSectorName.toLowerCase() !== sName.toLowerCase()) {
        const isDuplicateOfOther = sectors.some((s) => s.toLowerCase() === sName.toLowerCase() && s.toLowerCase() !== selectedSectorName.toLowerCase());
        if (isDuplicateOfOther) {
          setErrorMsg("Já existe outro setor com este nome.");
          return;
        }
        // rename
        updatedSectors = sectors.map((s) => s === selectedSectorName ? sName : s);
      }

      const nextDetails = { ...sectorDetails };
      if (selectedSectorName !== sName) {
        delete nextDetails[selectedSectorName];
      }
      nextDetails[sName] = {
        description: formDescription.trim() || "Setor de saúde e governança.",
        responsible: formResponsible.trim() || "Não especificado",
        status: formStatus,
        cargos: formCargos.length > 0 ? formCargos : ["Colaborador"]
      };

      setSectors(updatedSectors);
      setSectorDetails(nextDetails);
      const ok = await saveSectors(updatedSectors, nextDetails);
      if (ok) {
        setSuccessMsg(`Setor "${sName}" atualizado com sucesso.`);
        setIsModalOpen(false);
        if (onRefresh) onRefresh();
      } else {
        setErrorMsg("Erro ao persistir mudanças no banco.");
        setSectors(sectors);
        setSectorDetails(sectorDetails);
      }
    }
  };

  return (
    <div id="painelSetores" className="setores-pagina">
      {/* <section className="setores-pagina__cabecalho">
        <div className="setores-pagina__cabecalho-texto">
          <h1 className="setores-pagina__titulo">Setores</h1>
          <p className="setores-pagina__subtitulo">Gerencie áreas, responsáveis e soluções cadastradas no Cedro IA.</p>
        </div>
        <div className="setores-pagina__ilustracao" aria-hidden="true">
          <div className="setores-pagina__ilustracao-fundo"></div>
          <Building2 size={58} strokeWidth={1.45} />
          <span className="setores-pagina__ilustracao-ponto"></span>
        </div>
      </section> */}

      {successMsg && (
        <div className="setores-pagina__alerta setores-pagina__alerta--sucesso">
          <span><Check size={15} /> {successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg(null)} aria-label="Fechar aviso"><X size={15} /></button>
        </div>
      )}

      {errorMsg && (
        <div className="setores-pagina__alerta setores-pagina__alerta--erro">
          <span><AlertCircle size={15} /> {errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} aria-label="Fechar erro"><X size={15} /></button>
        </div>
      )}

      <section className="setores-pagina__indicadores" aria-label="Resumo dos setores">
        <article className="setores-kpi">
          <span className="setores-kpi__icone setores-kpi__icone--verde"><Building2 size={25} /></span>
          <div><span className="setores-kpi__rotulo">Total de setores</span><strong className="setores-kpi__valor">{statsSummary.total}</strong></div>
        </article>
        <article className="setores-kpi">
          <span className="setores-kpi__icone setores-kpi__icone--verde"><Check size={25} /></span>
          <div><span className="setores-kpi__rotulo">Setores ativos</span><strong className="setores-kpi__valor">{statsSummary.active}</strong></div>
        </article>
        <article className="setores-kpi">
          <span className="setores-kpi__icone setores-kpi__icone--roxo"><Activity size={25} /></span>
          <div><span className="setores-kpi__rotulo">Setores com IA</span><strong className="setores-kpi__valor">{statsSummary.withIA}</strong></div>
        </article>
        <article className="setores-kpi">
          <span className="setores-kpi__icone setores-kpi__icone--laranja"><Database size={25} /></span>
          <div><span className="setores-kpi__rotulo">Total de soluções</span><strong className="setores-kpi__valor">{statsSummary.totalIAs}</strong></div>
        </article>
      </section>

      <section className="setores-pagina__filtros">
        <div className="setores-pagina__busca">
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar setores, responsáveis ou descrições..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>

        <div className="setores-pagina__status">
          <span className="setores-pagina__filtro-legenda">Status</span>
          <CustomDropdown
            value={statusSelect}
            onChange={(val) => { setStatusSelect(val as any); setCurrentPage(1); }}
            options={[
              { value: "All", label: "Todos os status" },
              { value: "Ativo", label: "Ativo" },
              { value: "Inativo", label: "Inativo" }
            ]}
            size="sm"
            className="setores-pagina__dropdown"
          />
        </div>

        <div className="setores-pagina__rapidos">
          <span className="setores-pagina__filtro-legenda">Filtros rápidos</span>
          <div className="setores-pagina__chips">
            {[
              { id: "All", label: "Todos" },
              { id: "Active", label: "Ativos" },
              { id: "Inactive", label: "Inativos" },
              { id: "WithIA", label: "Com IA" },
              { id: "WithoutIA", label: "Sem IA" }
            ].map((chip) => (
              <button
                type="button"
                key={chip.id}
                onClick={() => { setQuickFilter(chip.id as any); setCurrentPage(1); }}
                className={`setores-pagina__chip ${quickFilter === chip.id ? "setores-pagina__chip--ativo" : ""}`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        <button type="button" onClick={handleOpenCreateModal} className="setores-pagina__cadastrar">
          <Plus size={18} /> <span>Cadastrar setor</span>
        </button>
      </section>

      <section className="setores-pagina__conteudo">
        {loading ? (
          <div className="setores-pagina__estado">Carregando setores...</div>
        ) : paginatedSectors.length > 0 ? (
          <div className="setores-pagina__grade">
            <AnimatePresence mode="popLayout">
              {paginatedSectors.map((sec) => {
                const IconComponent = getSectorIcon(sec.name);
                return (
                  <motion.article
                    key={sec.name}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.22 }}
                    className="setor-cartao"
                  >
                    <div className="setor-cartao__topo">
                      <div className="setor-cartao__identidade">
                        <span className="setor-cartao__icone"><IconComponent size={25} strokeWidth={1.7} /></span>
                        <div className="setor-cartao__titulo-area">
                          <div className="setor-cartao__titulo-linha">
                            <button type="button" className="setor-cartao__titulo" onClick={() => handleOpenViewModal(sec)}>{sec.name}</button>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(sec.name)}
                              className={`setor-cartao__status ${sec.status === "Ativo" ? "setor-cartao__status--ativo" : "setor-cartao__status--inativo"}`}
                            >
                              <span></span>{sec.status}
                            </button>
                          </div>
                          <p className="setor-cartao__descricao">{sec.description}</p>
                        </div>
                      </div>

                      <div className="setor-cartao__acoes">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setActiveMenuSector((prev) => prev === sec.name ? null : sec.name); }}
                          className="setor-cartao__menu-botao"
                          aria-label={`Ações do setor ${sec.name}`}
                        >
                          <MoreVertical size={18} />
                        </button>
                        {activeMenuSector === sec.name && (
                          <div onClick={(e) => e.stopPropagation()} className="setor-cartao__menu">
                            <button type="button" onClick={() => { handleOpenViewModal(sec); setActiveMenuSector(null); }}>Visualizar detalhes</button>
                            <button type="button" onClick={() => { handleOpenEditModal(sec); setActiveMenuSector(null); }}>Editar setor</button>
                            <button type="button" onClick={() => { handleToggleStatus(sec.name); setActiveMenuSector(null); }}>Marcar como {sec.status === "Ativo" ? "Inativo" : "Ativo"}</button>
                            <span></span>
                            <button type="button" className="setor-cartao__menu-excluir" onClick={() => { handleDeleteSector(sec.name); setActiveMenuSector(null); }}>Excluir</button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="setor-cartao__metricas">
                      <div className="setor-cartao__metrica">
                        <Database size={15} />
                        <div><span>IAs</span><strong>{sec.iaCount.toString().padStart(2, "0")}</strong><small> instâncias</small></div>
                      </div>
                      <div className="setor-cartao__metrica">
                        <Users size={15} />
                        <div><span>Colaboradores</span><strong>{sec.userCount.toString().padStart(2, "0")}</strong><small> perfis</small></div>
                      </div>
                      <div className="setor-cartao__metrica setor-cartao__metrica--responsavel">
                        <User size={15} />
                        <div><span>Responsável</span><strong title={sec.responsible}>{sec.responsible}</strong></div>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>

            <button type="button" onClick={handleOpenCreateModal} className="setor-cartao setor-cartao--novo">
              <span className="setor-cartao__novo-icone"><Plus size={24} /></span>
              <strong>Cadastrar novo setor</strong>
              <span>Clique para adicionar um novo setor</span>
            </button>
          </div>
        ) : (
          <div className="setores-pagina__estado">
            <Building2 size={34} />
            <strong>Nenhum setor encontrado</strong>
            <span>Nenhum setor atende aos filtros selecionados.</span>
            <button type="button" onClick={() => { setSearchTerm(""); setStatusSelect("All"); setQuickFilter("All"); }}>Limpar filtros</button>
          </div>
        )}

        {filteredSectors.length > itemsPerPage && (
          <div className="setores-pagina__paginacao">
            <span>Mostrando {Math.min(filteredSectors.length, (currentPage - 1) * itemsPerPage + 1)}–{Math.min(filteredSectors.length, currentPage * itemsPerPage)} de {filteredSectors.length}</span>
            <div>
              <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}><ChevronLeft size={16} /></button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button type="button" key={i + 1} className={currentPage === i + 1 ? "ativo" : ""} onClick={() => setCurrentPage(i + 1)}>{i + 1}</button>
              ))}
              <button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </section>

      {/* 5. POPUP / MODAL DE DETALHES, CRIAÇÃO E EDIÇÃO DO SETOR */}
      <AnimatePresence>
        {isModalOpen &&
        <div className="cedro-modal-overlay setores__grupo-31">
            {/* Backdrop Filter */}
            <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsModalOpen(false)}
            className="setores__elemento-4" />
          

            {/* Modal Body */}
            <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={{
              hidden: { opacity: 0, scale: 0.98, y: 8 },
              visible: {
                opacity: 1,
                scale: 1,
                y: 0,
                transition: {
                  staggerChildren: 0.04,
                  delayChildren: 0.02
                }
              }
            }}
            className="cedro-modal-painel setores__elemento-5">
            
              {/* Header */}
              <div className="cedro-modal-cabecalho setores__grupo-cedro-grc-gestao-departamental">
                <div>
                  <span className="setores__texto-cedro-grc-gestao-departamental">
                    Cedro GRC - Gestão Departamental
                  </span>
                  <h3 className="setores__titulo-bloco-2">
                    {modalMode === "create" ? "Cadastrar novo setor" : modalMode === "edit" ? "Editar Setor" : "Detalhes do Setor"}
                  </h3>
                </div>

                <button
                onClick={() => setIsModalOpen(false)}
                className="setores__botao-11">
                
                  <X size={16} />
                </button>
              </div>

              {/* Form Content body */}
              <form onSubmit={handleSaveForm} className="setores__formulario">
                
                {/* 2 columns layout on desktop to match precise reference */}
                <div className="setores__grupo-22">
                  
                  {/* Nome do setor */}
                  <motion.div variants={itemVariants} className="setores__elemento-nome-do-setor">
                    <label className="setores__rotulo-nome-do-setor">Nome do Setor *</label>
                    <input
                    type="text"
                    required
                    placeholder="Ex: Endocrinologia, Nit..."
                    disabled={modalMode === "view"}
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className={`setores__campo-ex-endocrinologia-nit ${
                    isNameDuplicate ?
                    "setores__campo-ex-endocrinologia-nit-2" :
                    "setores__campo-ex-endocrinologia-nit-3"}`
                    } />
                  
                    {isNameDuplicate &&
                  <span className="setores__texto-este-setor-ja-esta-cadastrado-">
                        ⚠️ Este setor já está cadastrado no sistema.
                      </span>
                  }
                  </motion.div>

                  {/* Responsável */}
                  <motion.div variants={itemVariants} className="setores__elemento-nome-do-setor">
                    <label className="setores__rotulo-nome-do-setor">Responsável / Diretor *</label>
                    <input
                    type="text"
                    required
                    placeholder="Ex: Mariana Souza..."
                    disabled={modalMode === "view"}
                    value={formResponsible}
                    onChange={(e) => setFormResponsible(e.target.value)}
                    className="setores__campo-ex-mariana-souza" />
                  
                  </motion.div>

                </div>

                {/* Status */}
                <motion.div variants={itemVariants} className="setores__elemento-nome-do-setor">
                  <label className="setores__rotulo-nome-do-setor">Status do Setor</label>
                  <div className="setores__grupo-setor-ativo">
                    <label className={`setores__rotulo-setor-ativo ${
                  formStatus === "Ativo" ?
                  "setores__rotulo-setor-ativo-2" :
                  "setores__rotulo-setor-ativo-3"}`
                  }>
                      <input
                      type="radio"
                      name="modal_status"
                      value="Ativo"
                      disabled={modalMode === "view"}
                      checked={formStatus === "Ativo"}
                      onChange={() => setFormStatus("Ativo")}
                      className="accent-[#03440c]" />
                    
                      Setor Ativo
                    </label>

                    <label className={`setores__rotulo-setor-ativo ${
                  formStatus === "Inativo" ?
                  "setores__rotulo-setor-inativo" :
                  "setores__rotulo-setor-ativo-3"}`
                  }>
                      <input
                      type="radio"
                      name="modal_status"
                      value="Inativo"
                      disabled={modalMode === "view"}
                      checked={formStatus === "Inativo"}
                      onChange={() => setFormStatus("Inativo")}
                      className="accent-red-650" />
                    
                      Setor Inativo
                    </label>
                  </div>
                </motion.div>

                {/* Descrição */}
                <motion.div variants={itemVariants} className="setores__elemento-historico-descricao-institucio">
                  <label className="setores__rotulo-nome-do-setor">Histórico / Descrição Institucional *</label>
                  <textarea
                  required
                  rows={4}
                  placeholder="Escreva breve resumo operacional descrevendo as atribuições, pesquisa ou fluxos de negócio sob custódia operacional deste setor..."
                  disabled={modalMode === "view"}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="setores__campo-texto-escreva-breve-resumo-operacion" />
                
                </motion.div>

                {/* Cargos / Funções no Setor */}
                <motion.div variants={itemVariants} className="setores__elemento-cargos-funcoes-cadastrados-par">
                  <label className="setores__rotulo-nome-do-setor">
                    Cargos / Funções Cadastrados para este Setor *
                  </label>
                  
                  {/* List of badges */}
                  <div className="setores__grupo-32">
                    {formCargos.length === 0 ?
                  <span className="setores__texto-nenhum-cargo-cadastrado-adicio">Nenhum cargo cadastrado. Adicione pelo menos um.</span> :

                  formCargos.map((cargoItem, idx) =>
                  <div
                    key={idx}
                    className="setores__grupo-33">
                    
                          <span>{cargoItem}</span>
                          {modalMode !== "view" &&
                    <button
                      type="button"
                      onClick={() => setFormCargos(formCargos.filter((c) => c !== cargoItem))}
                      className="setores__botao-12">
                      
                              <X size={12} />
                            </button>
                    }
                        </div>
                  )
                  }
                  </div>

                  {modalMode !== "view" &&
                <div className="setores__grupo-adicionar">
                      <input
                    type="text"
                    placeholder="Adicionar novo cargo (ex: Analista de TI, Médico Patologista)"
                    value={newCargoInput || ""}
                    onChange={(e) => setNewCargoInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = newCargoInput.trim();
                        if (val && !formCargos.includes(val)) {
                          setFormCargos([...formCargos, val]);
                          setNewCargoInput("");
                        }
                      }
                    }}
                    className="setores__campo-adicionar-novo-cargo-ex-analis" />
                  
                      <button
                    type="button"
                    onClick={() => {
                      const val = newCargoInput.trim();
                      if (val && !formCargos.includes(val)) {
                        setFormCargos([...formCargos, val]);
                        setNewCargoInput("");
                      }
                    }}
                    className="setores__botao-adicionar">
                    
                        Adicionar
                      </button>
                    </div>
                }
                </motion.div>

                {/* Active solution count preview if viewing details */}
                {modalMode === "view" && selectedSectorName &&
              <div className="setores__grupo-auditoria-de-instancias-associ">
                    <span className="setores__texto-auditoria-de-instancias-associ">Auditoria de Instâncias Associadas</span>
                    <div className="setores__grupo-tecnologias-de-ia">
                      <div>
                        <span className="setores__texto-tecnologias-de-ia">Tecnologias de IA</span>
                        <div className="setores__grupo-34">
                          {records.filter((r) => (r.unidadeSetor || "").trim().toLowerCase() === selectedSectorName.toLowerCase().trim()).length.toString().padStart(2, "0")}
                        </div>
                      </div>
                      <div className="setores__grupo-35" />
                      <div>
                        <span className="setores__texto-tecnologias-de-ia">Perfis Ativos</span>
                        <div className="setores__grupo-34">
                          {profiles.filter((p) => (p.setor || "").trim().toLowerCase() === selectedSectorName.toLowerCase().trim()).length.toString().padStart(2, "0")}
                        </div>
                      </div>
                    </div>
                  </div>
              }

              </form>

              {/* Footer controls button */}
              <div className="setores__grupo-36">
                <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="setores__botao-13">
                
                  {modalMode === "view" ? "Fechar" : "Cancelar"}
                </button>

                {modalMode !== "view" &&
              <button
                type="submit"
                disabled={isNameDuplicate}
                onClick={handleSaveForm}
                className="setores__botao-salvar-alteracoes">
                
                    Salvar alterações
                  </button>
              }
              </div>

            </motion.div>
          </div>
        }
      </AnimatePresence>



    </div>);

}
