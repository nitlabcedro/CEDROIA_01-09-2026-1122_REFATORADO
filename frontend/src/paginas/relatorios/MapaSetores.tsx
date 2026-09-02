/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { CustomDropdown } from "@/componentes/comuns/MenuSuspenso";
import {
  Users,
  ChevronRight,
  User,
  ShieldCheck,
  Clock,
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal,
  Award,
  Lock,
  Eye,
  FileText,
  AlertCircle,
  Target,
  Pencil,
  Aperture,
  Sparkles,
  Copy,
  Asterisk,
  Orbit,
  Bot,
  Shield
} from "lucide-react";
import { IARecord, UserProfile, StatusAuditoria } from "@/tipos";
import { obterUltimoParecerLimpo as getCleanLastOpinion } from "@/utilitarios/pareceres";
import { motion, AnimatePresence } from "framer-motion";
import { identificarMarcaIA } from "@/utilitarios/inteligencia-artificial";


function IconeInteligenciaArtificial({ nome }: { nome?: string }) {
  const marca = identificarMarcaIA(nome);

  if (marca === "chatgpt") {
    return (
      <span className="mapa-ias__marca-ia mapa-ias__marca-ia--chatgpt" aria-label="ChatGPT">
        <Aperture size={29} strokeWidth={2.1} />
      </span>
    );
  }

  if (marca === "gemini") {
    return (
      <span className="mapa-ias__marca-ia mapa-ias__marca-ia--gemini" aria-label="Google Gemini">
        <Sparkles size={28} strokeWidth={2} />
      </span>
    );
  }

  if (marca === "copilot") {
    return (
      <span className="mapa-ias__marca-ia mapa-ias__marca-ia--copilot" aria-label="Microsoft Copilot">
        <Copy size={27} strokeWidth={2} />
      </span>
    );
  }

  if (marca === "claude") {
    return (
      <span className="mapa-ias__marca-ia mapa-ias__marca-ia--claude" aria-label="Claude">
        <Asterisk size={29} strokeWidth={2.2} />
      </span>
    );
  }

  if (marca === "grok") {
    return (
      <span className="mapa-ias__marca-ia mapa-ias__marca-ia--grok" aria-label="Grok">
        <Orbit size={29} strokeWidth={2} />
      </span>
    );
  }

  return (
    <span className="mapa-ias__marca-ia mapa-ias__marca-ia--outro" aria-label="Outra inteligência artificial">
      <Bot size={28} strokeWidth={2} />
    </span>
  );
}

interface SectorMapProps {
  records: IARecord[];
  profiles: UserProfile[];
}

const hasUsefulValue = (value?: unknown) => {
  const text = String(value ?? "").trim();

  if (!text) return false;

  const normalized = text.
  normalize("NFD").
  replace(/[\u0300-\u036f]/g, "").
  toLowerCase();

  const uselessValues = [
  "nao informado",
  "nao preenchido",
  "nao preenchido na solicitacao",
  "nao se aplica",
  "nenhum",
  "nenhuma",
  "outro",
  "sim",
  "nao"];


  return !uselessValues.includes(normalized);
};


export default function SectorMap({ records, profiles }: SectorMapProps) {
  const [selectedIA, setSelectedIA] = useState<IARecord | null>(null);
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Aprovado" | "Pendente" | "Negado">("All");
  const [riskFilter, setRiskFilter] = useState<"All" | "Baixo" | "Médio" | "Alto">("All");
  const [orderBy, setOrderBy] = useState<"volume" | "az" | "pending">("volume");
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const toggleSector = (sector: string) => {
    setExpandedSectors((prev) => {
      const next = new Set(prev);
      if (next.has(sector)) next.delete(sector);else
      next.add(sector);
      return next;
    });
  };

  // Overall Inventory Stats (Calculated from baseline records for compliance oversight)
  const statsOverview = useMemo(() => {
    const sectorsSet = new Set(records.map((r) => r.unidadeSetor || "Não Informado"));
    const approved = records.filter((r) => r.statusAuditoria === StatusAuditoria.APROVADO).length;
    const pending = records.filter((r) => r.statusAuditoria === StatusAuditoria.PENDENTE).length;

    return {
      totalSectors: sectorsSet.size,
      totalSolutions: records.length,
      approvedSolutions: approved,
      pendingSolutions: pending
    };
  }, [records]);

  // Search, Status and Risk Filter logic
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const searchLower = searchTerm.toLowerCase().trim();
      const matchesSearch = !searchLower ||
      r.nomeFerramenta && r.nomeFerramenta.toLowerCase().includes(searchLower) ||
      r.unidadeSetor && r.unidadeSetor.toLowerCase().includes(searchLower) ||
      r.responsavelPreenchimento && r.responsavelPreenchimento.toLowerCase().includes(searchLower) ||
      r.fornecedor && r.fornecedor.toLowerCase().includes(searchLower);

      const matchesStatus = statusFilter === "All" || r.statusAuditoria === statusFilter;
      const matchesRisk = riskFilter === "All" || r.riscoResidual === riskFilter;

      return matchesSearch && matchesStatus && matchesRisk;
    });
  }, [records, searchTerm, statusFilter, riskFilter]);

  // Group records by sector after application of filters
  const sectorGroups = useMemo(() => {
    const groups: Record<string, {
      sector: string;
      records: IARecord[];
      totalIAs: number;
      authorizedCount: number;
      pendingCount: number;
      users: Set<string>;
    }> = {};

    filteredRecords.forEach((r) => {
      const sector = r.unidadeSetor || "Não Informado";
      if (!groups[sector]) {
        groups[sector] = {
          sector,
          records: [],
          totalIAs: 0,
          authorizedCount: 0,
          pendingCount: 0,
          users: new Set()
        };
      }

      groups[sector].records.push(r);
      groups[sector].totalIAs++;
      if (r.statusAuditoria === StatusAuditoria.APROVADO) groups[sector].authorizedCount++;
      if (r.statusAuditoria === StatusAuditoria.PENDENTE) groups[sector].pendingCount++;
      if (r.responsavelPreenchimento) groups[sector].users.add(r.responsavelPreenchimento);
    });

    const list = Object.values(groups);

    // Apply Sorting Options
    if (orderBy === "volume") {
      list.sort((a, b) => b.totalIAs - a.totalIAs);
    } else if (orderBy === "az") {
      list.sort((a, b) => a.sector.localeCompare(b.sector));
    } else if (orderBy === "pending") {
      list.sort((a, b) => b.pendingCount - a.pendingCount);
    }

    return list;
  }, [filteredRecords, orderBy]);

  // Dynamic recommendations for custom compliance GRC panel
  const getComplianceRecommendations = (ia: IARecord) => {
    const recs: string[] = [];

    if (ia.riscoResidual === "Alto") {
      recs.push("Exigir emissão regular de Relatório de Impacto à Proteção de Dados (RIPD).");
      recs.push("Forçar criptografia avançada de fluxo nos servidores de inteligência.");
      recs.push("Impor auditoria semestral de logs de auditoria das decisões computacionais.");
    } else if (ia.riscoResidual === "Médio") {
      recs.push("Recomendar revisão anual nas matrizes de acesso de usuários.");
      recs.push("Promover reciclagem anual opcional para os validadores humanos.");
    } else {
      recs.push("Atividade em conformidade habitual com monitoração de rotina.");
    }

    if (ia.usaDadosPessoais === "Sim" || ia.usaDadosSensiveis === "Sim") {
      recs.push("Fator de risco de privacidade detectado: garantir que termos de uso respeitem a LGPD de forma explícita.");
    }

    if (ia.validacaoHumana === "Não") {
      recs.push("Ausência de validação humana: estruturar barreira de validação pré-faturamento.");
    }

    return recs;
  };

  const showTempFeedback = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => {
      setActionFeedback(null);
    }, 4000);
  };

  // Animation variants
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemAnimation = {
    hidden: { opacity: 0, scale: 0.985, y: 8 },
    show: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: 0.45,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  return (
    <div id="mapa-ias-conteudo" data-componente="pagina-mapa-ias" className="pagina-mapa-ias relatorio-container relatorio-mapa-setores cedro-page-premium">
      
      {/* 1. CABEÇALHO DA PÁGINA */}
      <div className="relatorio-cabecalho mapa-ias__grupo-mapa-de-ias-por-setor">
        <div className="mapa-ias__cabecalho-introducao">
          <h1 className="mapa-ias__titulo-principal-mapa-de-ias-por-setor">
            Mapa de IAs por setor
          </h1>
          <p className="mapa-ias__subtitulo-principal">
            Visualize as soluções de IA por setor, com seus status e responsáveis.
          </p>
        </div>

        {/* Indicadores Compactos */}
        <div className="mapa-ias__grupo-frentes-areas">
          <div className="mapa-ias__grupo-frentes-areas-2 mapa-ias__kpi mapa-ias__kpi--frentes">
            <span className="mapa-ias__kpi-icone"><Users size={22} /></span>
            <span className="mapa-ias__kpi-conteudo">
              <span className="mapa-ias__texto-frentes">Frentes</span>
              <span className="mapa-ias__texto-areas"><strong>{statsOverview.totalSectors}</strong> áreas</span>
            </span>
          </div>
          <div className="mapa-ias__grupo-solucoes-cadastradas mapa-ias__kpi mapa-ias__kpi--solucoes">
            <span className="mapa-ias__kpi-icone"><FileText size={22} /></span>
            <span className="mapa-ias__kpi-conteudo">
              <span className="mapa-ias__texto-frentes">Soluções</span>
              <span className="mapa-ias__texto-areas"><strong>{statsOverview.totalSolutions}</strong> cadastradas</span>
            </span>
          </div>
          <div className="mapa-ias__grupo-aprovadas mapa-ias__kpi mapa-ias__kpi--aprovadas">
            <span className="mapa-ias__kpi-icone"><CheckCircle2 size={22} /></span>
            <span className="mapa-ias__kpi-conteudo">
              <span className="mapa-ias__texto-aprovadas">Aprovadas</span>
              <span className="mapa-ias__texto"><strong>{statsOverview.approvedSolutions}</strong></span>
            </span>
          </div>
          <div className="mapa-ias__grupo-pendentes mapa-ias__kpi mapa-ias__kpi--pendentes">
            <span className="mapa-ias__kpi-icone"><Clock size={22} /></span>
            <span className="mapa-ias__kpi-conteudo">
              <span className="mapa-ias__texto-pendentes">Pendentes</span>
              <span className="mapa-ias__texto-2"><strong>{statsOverview.pendingSolutions}</strong></span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. BARRA DE FILTROS */}
      <div className="mapa-ias__grupo">
        {/* Campo de pesquisa */}
        <div className="mapa-ias__grupo-2">
          {/* <Search className="mapa-ias__icone-search" size={14} /> */}
          <input
            type="text"
            placeholder="Buscar IA, setor ou responsável..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mapa-ias__campo-buscar-ia-setor-ou-responsavel" />
          
        </div>

        {/* Filtros em linha */}
        <div className="mapa-ias__grupo-status">
          {/* Status Filter */}
          <div className="mapa-ias__grupo-status-2">
            <SlidersHorizontal size={12} className="mapa-ias__icone-slidershorizontal" />
            <span className="mapa-ias__texto-status">Status:</span>
            <CustomDropdown
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as any)}
              options={[
              { value: "All", label: "Todos" },
              { value: "Aprovado", label: "Aprovadas" },
              { value: "Pendente", label: "Pendentes" },
              { value: "Negado", label: "Negadas" }]
              }
              size="sm"
              className="mapa-ias__icone-customdropdown" />
            
          </div>

          {/* Risk Level Filter */}
          <div className="mapa-ias__grupo-risco">
            <span className="mapa-ias__texto-status">Risco:</span>
            <CustomDropdown
              value={riskFilter}
              onChange={(val) => setRiskFilter(val as any)}
              options={[
              { value: "All", label: "Todos" },
              { value: "Baixo", label: "Baixo" },
              { value: "Médio", label: "Médio" },
              { value: "Alto", label: "Alto" }]
              }
              size="sm"
              className="mapa-ias__icone-customdropdown" />
            
          </div>

          {/* Ordering Options */}
          <div className="mapa-ias__grupo-ordenacao">
            <span className="mapa-ias__texto-status">Ordenação:</span>
            <CustomDropdown
              value={orderBy}
              onChange={(val) => setOrderBy(val as any)}
              options={[
              { value: "volume", label: "Maior volume" },
              { value: "az", label: "A-Z Setor" },
              { value: "pending", label: "Mais pendentes" }]
              }
              size="sm"
              className="mapa-ias__icone-customdropdown-2" />
            
          </div>
        </div>
      </div>

      {/* 3. GRID DOS CARDS DOS SETORES */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="mapa-ias__elemento">
        
        {sectorGroups.map((group, idx) => {
          const approvedPercent = group.totalIAs > 0 ? group.authorizedCount / group.totalIAs * 100 : 0;
          const pendingPercent = group.totalIAs > 0 ? group.pendingCount / group.totalIAs * 100 : 0;

          // Expand logic
          const hasMultiple = group.totalIAs > 2;
          const isExpanded = expandedSectors.has(group.sector);
          const visibleRecords = isExpanded ? group.records : group.records.slice(0, 2);

          return (
            <motion.div
              key={idx}
              variants={itemAnimation}
              className="mapa-ias__elemento-2">
              
              {/* Card Header Info */}
              <div className="mapa-ias__grupo-unidade-setor">
                <div className="mapa-ias__grupo-unidade-setor-2">
                  <span className="mapa-ias__texto-unidade-setor">Setor</span>
                  <h3 className="mapa-ias__titulo-bloco">
                    {group.sector}
                  </h3>
                </div>
                <div className="mapa-ias__grupo-solucoes">
                  <span className="mapa-ias__texto-3">{group.totalIAs}</span>
                  <span className="mapa-ias__texto-solucoes">Soluções</span>
                </div>
              </div>

              {/* Progress and status indicators */}
              <div className="mapa-ias__grupo-3">
                <div className="mapa-ias__grupo-aprovadas-2">
                  <span className="mapa-ias__texto-aprovadas-2">
                    <span className="mapa-ias__texto-4"></span> Aprovadas: {group.authorizedCount}
                  </span>
                  <span className="mapa-ias__texto-pendentes-2">
                    <span className="mapa-ias__texto-5"></span> Pendentes: {group.pendingCount}
                  </span>
                  <span className="mapa-ias__texto-responsaveis">
                    Responsáveis: {group.users.size}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="mapa-ias__grupo-4">
                  {group.authorizedCount > 0 &&
                  <div style={{ width: `${approvedPercent}%` }} className="mapa-ias__grupo-5" title={`Aprovadas: ${group.authorizedCount}`} />
                  }
                  {group.pendingCount > 0 &&
                  <div style={{ width: `${pendingPercent}%` }} className="mapa-ias__grupo-6" title={`Pendentes: ${group.pendingCount}`} />
                  }
                  {group.totalIAs - group.authorizedCount - group.pendingCount > 0 &&
                  <div style={{ width: `${100 - approvedPercent - pendingPercent}%` }} className="mapa-ias__grupo-negado-outros" title="Negado/Outros" />
                  }
                </div>
              </div>

              {/* List of Solution Items */}
              <div className="mapa-ias__grupo-solucoes-cadastradas-2">
                <p className="mapa-ias__texto-unidade-setor">Soluções cadastradas</p>
                
                <div className="mapa-ias__grupo-7">
                  {visibleRecords.map((r, i) =>
                  <div
                    key={i}
                    onClick={() => setSelectedIA(r)}
                    className="grupo-interativo-ia mapa-ias__grupo-8">
                    
                      <div className="mapa-ias__grupo-9">
                        <p className="mapa-ias__descricao">
                          {r.nomeFerramenta}
                        </p>
                        <p className="mapa-ias__descricao-2">
                          <User size={10} className="mapa-ias__icone-slidershorizontal" /> {r.responsavelPreenchimento}
                        </p>
                      </div>

                      <div className="mapa-ias__grupo-10">
                        {/* Status Badge */}
                        <span className={`mapa-ias__texto-6 ${
                      r.statusAuditoria === "Aprovado" ? "mapa-ias__texto-7" :
                      r.statusAuditoria === "Negado" ? "mapa-ias__texto-8" :
                      "mapa-ias__texto-9"}`
                      }>
                          {r.statusAuditoria || "Pendente"}
                        </span>

                        {/* Risco Badge */}
                        <span className={`mapa-ias__texto-6 ${
                      r.riscoResidual === "Alto" ? "mapa-ias__texto-8" :
                      r.riscoResidual === "Médio" ? "mapa-ias__texto-9" :
                      "mapa-ias__texto-7"}`
                      }>
                          {r.riscoResidual || "Baixo"}
                        </span>

                        <ChevronRight size={12} className="mapa-ias__icone-chevronright" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Expansion Action controls */}
              {hasMultiple &&
              <button
                onClick={() => toggleSector(group.sector)}
                className="mapa-ias__botao">
                
                  {isExpanded ? "Recolher" : `Ver todas as ${group.totalIAs} soluções`}
                  <ChevronRight size={12} className={`mapa-ias__icone-chevronright-2 ${isExpanded ? "mapa-ias__icone-chevronright-3" : ""}`} />
                </button>
              }
            </motion.div>);

        })}

        {sectorGroups.length === 0 &&
        <div className="mapa-ias__grupo-nenhuma-solucao-localizada">
            <AlertCircle className="mapa-ias__icone-alertcircle" />
            <h3 className="mapa-ias__titulo-bloco-nenhuma-solucao-localizada">Nenhuma solução localizada</h3>
            <p className="mapa-ias__descricao-verifique-os-filtros-de-busca-">Verifique os filtros de busca, status ou criticidade.</p>
          </div>
        }
      </motion.div>

      {/* 4. MODAL DE DETALHES - FICHA DA IA DE GOVERNANÇA */}
      <AnimatePresence>
        {selectedIA && (
          <div className="cedro-modal-overlay mapa-ias__grupo-11">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedIA(null)}
              className="mapa-ias__elemento-3"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.985, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.985, y: 8 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="cedro-modal-painel mapa-ias__elemento-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mapa-ias-modal-titulo"
            >
              <div className="cedro-modal-cabecalho mapa-ias__grupo-12">
                <div className="mapa-ias__cabecalho-modal">
                  <div className="mapa-ias__grupo-13">
                    <span className="mapa-ias__texto-10">{selectedIA.id}</span>
                    <span className="mapa-ias__texto-ficha-de-governanca-corporativ">
                      Ficha de governança corporativa
                    </span>
                    <span
                      className={`mapa-ias__texto-11 ${
                        selectedIA.statusAuditoria === StatusAuditoria.APROVADO
                          ? "mapa-ias__texto-12"
                          : selectedIA.statusAuditoria === StatusAuditoria.NEGADO
                            ? "mapa-ias__texto-11--negado"
                            : "mapa-ias__texto-13"
                      }`}
                    >
                      {selectedIA.statusAuditoria || "Pendente"}
                    </span>
                    {selectedIA.unidadeSetor && (
                      <span className="mapa-ias__texto-14">{selectedIA.unidadeSetor}</span>
                    )}
                  </div>

                  <div className="mapa-ias__titulo-modal-ia">
                    <IconeInteligenciaArtificial nome={selectedIA.nomeFerramenta} />
                    <h2 id="mapa-ias-modal-titulo" className="mapa-ias__titulo-secao">
                      {selectedIA.nomeFerramenta}
                    </h2>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedIA(null)}
                  className="mapa-ias__botao-2"
                  aria-label="Fechar ficha de governança"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mapa-ias__grupo-14">
                {actionFeedback && (
                  <div className="mapa-ias__grupo-15">
                    <CheckCircle2 size={14} />
                    <span>{actionFeedback}</span>
                  </div>
                )}

                {(() => {
                  const lastParecer = selectedIA.historico?.find(
                    (item) =>
                      item.action &&
                      !item.action.includes("Criação") &&
                      !item.action.includes("Cadastro") &&
                      !item.action.includes("Atualização")
                  );

                  const getTipoIAText = () => {
                    const parts: string[] = [];
                    if (selectedIA.tipoIA && selectedIA.tipoIA.length > 0) {
                      parts.push(...selectedIA.tipoIA);
                    }
                    if (selectedIA.tipoIAOutro) {
                      parts.push(selectedIA.tipoIAOutro);
                    }
                    return parts.join(", ");
                  };

                  const getPrivacySummary = () => {
                    const parts: string[] = [];
                    if (selectedIA.usaDadosPessoais === "Sim") parts.push("Dados Pessoais");
                    if (selectedIA.usaDadosSensiveis === "Sim") parts.push("Dados Sensíveis");

                    let summary = parts.length > 0 ? parts.join(" e ") : "";
                    if (hasUsefulValue(selectedIA.quaisDados)) {
                      summary = summary
                        ? `${summary} (${selectedIA.quaisDados})`
                        : String(selectedIA.quaisDados);
                    }
                    return summary || "Sem dados pessoais";
                  };

                  const iaText = getTipoIAText();
                  const processText = selectedIA.etapaOutro || selectedIA.etapaProcesso;
                  const recommendations = getComplianceRecommendations(selectedIA);

                  return (
                    <div className="mapa-ias__modal-secoes">
                      <section className="mapa-ias__modal-secao">
                        <div className="mapa-ias__modal-secao-cabecalho">
                          <Users size={20} />
                          <h3>1. Identificação</h3>
                        </div>
                        <div className="mapa-ias__modal-secao-corpo mapa-ias__identificacao-grid">
                          <div className="mapa-ias__identificacao-coluna">
                            {hasUsefulValue(selectedIA.responsavelPreenchimento) && (
                              <div className="mapa-ias__campo-informacao">
                                <span>Solicitante</span>
                                <strong>{selectedIA.responsavelPreenchimento}</strong>
                              </div>
                            )}
                            {hasUsefulValue(selectedIA.cargo) && (
                              <div className="mapa-ias__campo-informacao">
                                <span>Cargo</span>
                                <strong>{selectedIA.cargo}</strong>
                              </div>
                            )}
                            {hasUsefulValue(selectedIA.fornecedor) && (
                              <div className="mapa-ias__campo-informacao">
                                <span>Fornecedor / Desenvolvedor</span>
                                <strong>{selectedIA.fornecedor}</strong>
                              </div>
                            )}
                          </div>

                          {hasUsefulValue(iaText) && (
                            <div className="mapa-ias__identificacao-coluna mapa-ias__identificacao-coluna--tecnologia">
                              <div className="mapa-ias__campo-informacao">
                                <span>Tipo de IA / Tecnologia</span>
                                <strong>{iaText}</strong>
                              </div>
                            </div>
                          )}
                        </div>
                      </section>

                      <section className="mapa-ias__modal-secao">
                        <div className="mapa-ias__modal-secao-cabecalho">
                          <Target size={20} />
                          <h3>2. Finalidade e Operação</h3>
                        </div>
                        <div className="mapa-ias__modal-secao-corpo mapa-ias__finalidade-grid">
                          {hasUsefulValue(selectedIA.descricaoAtividade) && (
                            <div className="mapa-ias__campo-informacao mapa-ias__campo-informacao--divisor">
                              <span>Objetivo / Finalidade</span>
                              <strong>{selectedIA.descricaoAtividade}</strong>
                            </div>
                          )}
                          {hasUsefulValue(processText) && (
                            <div className="mapa-ias__campo-informacao mapa-ias__campo-informacao--divisor">
                              <span>Processo impactado</span>
                              <strong>{processText}</strong>
                            </div>
                          )}
                          {hasUsefulValue(selectedIA.beneficiosEsperados) && (
                            <div className="mapa-ias__campo-informacao">
                              <span>Benefício esperado</span>
                              <strong>{selectedIA.beneficiosEsperados}</strong>
                            </div>
                          )}
                        </div>
                      </section>

                      <section className="mapa-ias__modal-secao">
                        <div className="mapa-ias__modal-secao-cabecalho">
                          <Shield size={20} />
                          <h3>3. Parâmetros de Governança</h3>
                        </div>
                        <div className="mapa-ias__modal-secao-corpo mapa-ias__governanca-grid">
                          {hasUsefulValue(selectedIA.criticidade) && (
                            <div className="mapa-ias__campo-informacao">
                              <span>Criticidade</span>
                              <strong className="mapa-ias__valor-governanca">
                                {selectedIA.criticidade ? selectedIA.criticidade.split(":")[0] : "Baixa"}
                              </strong>
                            </div>
                          )}

                          <div className="mapa-ias__campo-informacao">
                            <span>Privacidade / Tipo de dado</span>
                            <strong className="mapa-ias__valor-governanca">{getPrivacySummary()}</strong>
                          </div>

                          {hasUsefulValue(selectedIA.statusUso) && (
                            <div className="mapa-ias__campo-informacao">
                              <span>Etapa atual do fluxo</span>
                              <strong className="mapa-ias__valor-governanca">{selectedIA.statusUso}</strong>
                            </div>
                          )}

                          <div className="mapa-ias__ultimo-parecer">
                            <span>Último parecer</span>
                            <div className="mapa-ias__ultimo-parecer-caixa">
                              <CheckCircle2 size={17} />
                              <div>
                                <strong>
                                  {lastParecer
                                    ? getCleanLastOpinion(lastParecer.message || lastParecer.action)
                                    : "–"}
                                </strong>
                                {lastParecer?.user && (
                                  <small>
                                    por {lastParecer.user} em {new Date(lastParecer.date).toLocaleDateString()}
                                  </small>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </section>

                      {(selectedIA.createdAt || selectedIA.updatedAt) && (
                        <div className="mapa-ias__grupo-22">
                          {selectedIA.createdAt && (
                            <span>Criado em: {new Date(selectedIA.createdAt).toLocaleDateString()}</span>
                          )}
                          {selectedIA.updatedAt && (
                            <span>Atualizado em: {new Date(selectedIA.updatedAt).toLocaleDateString()}</span>
                          )}
                        </div>
                      )}

                      {recommendations.length > 0 && (
                        <section className="mapa-ias__modal-secao mapa-ias__modal-secao--recomendacoes">
                          <div className="mapa-ias__modal-secao-cabecalho">
                            <ShieldCheck size={20} />
                            <h3>4. Recomendações e Plano de Mitigação GRC</h3>
                          </div>
                          <div className="mapa-ias__grupo-23">
                            {recommendations.map((rec, i) => (
                              <div key={i} className="mapa-ias__grupo-24">
                                <div className="mapa-ias__grupo-25" />
                                <span className="mapa-ias__texto-17">{rec}</span>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="mapa-ias__grupo-26">
                <div className="mapa-ias__grupo-ver-relatorio">
                  <button
                    type="button"
                    onClick={() => {
                      showTempFeedback("Ficha de Governança preparada para exportação PDF (Simulado).");
                    }}
                    className="mapa-ias__botao-ver-relatorio"
                  >
                    <FileText size={16} /> Ver relatório
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      showTempFeedback("Encaminhando solicitação de edição para o painel do inventário.");
                    }}
                    className="mapa-ias__botao-editar-cadastro"
                  >
                    <Pencil size={15} /> Editar cadastro
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedIA(null)}
                  className="mapa-ias__botao-fechar"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
    </div>);

}
