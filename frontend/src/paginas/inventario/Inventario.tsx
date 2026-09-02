/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ETAPAS_APROVACAO_OFICIAIS } from "@/constantes/fluxo-aprovacao";
import React, { useState, useMemo } from "react";
import { Search, Eye, ArrowUpDown, AlertTriangle, CheckCircle2, PlusCircle, Database, FileSpreadsheet, ChevronLeft, ChevronRight, RotateCcw, ShieldAlert, ClipboardList, ShieldCheck, MoreVertical, Pencil, XCircle } from "lucide-react";
import { IARecord, StatusUso, Criticidade, ClassificacaoRisco, ApprovalWorkflow } from "@/tipos";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

interface InventoryProps {
  records: IARecord[];
  onEdit: (record: IARecord) => void;
  onView: (record: IARecord) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onRefresh: () => void;
  isAdmin?: boolean;
  approvalConfig?: any;
  onSaveApprovalConfig?: any;
  workflows?: ApprovalWorkflow[];
  currentUser?: any;
  currentUserProfile?: any;
  onCancelRequest?: (id: string) => Promise<void>;
}

export default function Inventory({
  records,
  onEdit,
  onView,
  onDelete,
  onAdd,
  onRefresh,
  isAdmin,
  approvalConfig,
  workflows,
  currentUser,
  currentUserProfile,
  onCancelRequest
}: InventoryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSetor, setFilterSetor] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRisco, setFilterRisco] = useState("");
  const [filterDadosSensiveis, setFilterDadosSensiveis] = useState("");
  const [sortField, setSortField] = useState<keyof IARecord | "">("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  const [cancelTargetRecord, setCancelTargetRecord] = useState<IARecord | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const normalizeText = (value?: string) =>
  String(value || "").
  normalize("NFD").
  replace(/[\u0300-\u036f]/g, "").
  toLowerCase().
  replace(/[^a-z0-9@._-]/g, "").
  trim();

  const normalizeStatusUso = (status?: string): StatusUso => {
    if (!status) return StatusUso.EM_AVALIACAO;
    const normalized = String(status).
    normalize("NFD").
    replace(/[\u0300-\u036f]/g, "").
    toLowerCase().
    trim();
    if (
    normalized === "cancelada" ||
    normalized === "cancelado" ||
    normalized === "cancelada pelo solicitante" ||
    normalized.includes("cancelada") ||
    normalized.includes("cancelado"))
    {
      return StatusUso.CANCELADA;
    }
    return status as StatusUso;
  };

  const isRequester = (record: IARecord) => {
    if (!currentUser) return false;

    const currentUserId = String(currentUser.id || "");
    const possibleOwnerIds = [
    record.ownerId,
    (record as any).owner_id,
    (record as any).createdBy,
    (record as any).created_by,
    (record as any).userId,
    (record as any).user_id].
    filter(Boolean).map(String);

    if (currentUserId && possibleOwnerIds.includes(currentUserId)) {
      return true;
    }

    const userEmail = normalizeText(currentUser.email);
    const possibleEmails = [
    (record as any).emailSolicitante,
    (record as any).email_solicitante,
    (record as any).responsavelEmail,
    (record as any).responsavel_email,
    (record as any).email,
    record.contato].
    map(normalizeText).filter(Boolean);

    if (userEmail && possibleEmails.some((email) => email === userEmail || email.includes(userEmail))) {
      return true;
    }

    const profileName = normalizeText(currentUserProfile?.full_name || currentUserProfile?.name);
    const possibleNames = [
    record.responsavelPreenchimento,
    (record as any).solicitante,
    (record as any).nomeSolicitante,
    (record as any).nome_solicitante].
    map(normalizeText).filter(Boolean);

    if (profileName && possibleNames.includes(profileName)) {
      return true;
    }

    return false;
  };

  const canCancel = (record: IARecord) => {
    const isOwner = isRequester(record);
    const isUserAllowed = isOwner || isAdmin;

    if (!isUserAllowed) return false;

    const workflow = workflows?.find((w) => w.iaRecordId === record.id);

    const statusUso = normalizeText(record.statusUso);
    const statusAuditoria = normalizeText(record.statusAuditoria as any);
    const finalStatus = normalizeText(workflow?.finalStatus);

    const finalStatuses = [
    normalizeText("Aprovado"),
    normalizeText("Aprovado com restrições"),
    normalizeText("Não aprovado"),
    normalizeText("Negado"),
    normalizeText("Cancelada"),
    normalizeText("Cancelada pelo solicitante"),
    normalizeText("cancelado"),
    normalizeText("aprovado"),
    normalizeText("negado")];


    const isFinal =
    finalStatuses.includes(statusUso) ||
    finalStatuses.includes(statusAuditoria) ||
    finalStatuses.includes(finalStatus);

    return !isFinal;
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const totalIAs = records.length;
  const emAvaliacaoCount = records.filter((r) => normalizeStatusUso(r.statusUso) === StatusUso.EM_AVALIACAO).length;
  const aprovadasCount = records.filter((r) => {
    const status = normalizeStatusUso(r.statusUso);
    return status === StatusUso.APROVADO || status === StatusUso.APROVADO_COM_RESTRICOES;
  }).length;

  const setoresDisponiveis = useMemo(() =>
    Array.from(new Set(records.map((record) => record.unidadeSetor).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
  [records]);

  const formatarAtualizacao = (value?: string) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
      r.nomeFerramenta.toLowerCase().includes(searchLower) ||
      r.fornecedor.toLowerCase().includes(searchLower) ||
      r.id.toLowerCase().includes(searchLower) ||
      r.unidadeSetor && r.unidadeSetor.toLowerCase().includes(searchLower) ||
      r.classificacaoRiscoManual && r.classificacaoRiscoManual.toLowerCase().includes(searchLower) ||
      r.statusUso && r.statusUso.toLowerCase().includes(searchLower) ||
      r.usaDadosSensiveis && r.usaDadosSensiveis.toLowerCase().includes(searchLower);

      const matchesSetor = !filterSetor || r.unidadeSetor === filterSetor;
      const matchesStatus = !filterStatus || normalizeStatusUso(r.statusUso) === filterStatus;
      const matchesRisco = !filterRisco || r.classificacaoRiscoManual === filterRisco;
      const matchesSensiveis = !filterDadosSensiveis || r.usaDadosSensiveis === filterDadosSensiveis;

      return matchesSearch && matchesSetor && matchesStatus && matchesRisco && matchesSensiveis;
    }).sort((a, b) => {
      if (!sortField) return 0;
      const valA = a[sortField];
      const valB = b[sortField];

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDirection === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return 0;
    });
  }, [records, searchTerm, filterSetor, filterStatus, filterRisco, filterDadosSensiveis, sortField, sortDirection]);

  const paginatedRecords = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredRecords, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage) || 1;

  const handleSort = (field: keyof IARecord) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Inventário IA Cedro");

    const brandGreen = "00C875";
    const labDark = "0F172A";

    worksheet.mergeCells('A1:H1');
    const titleCell = worksheet.getRow(1).getCell(1);
    titleCell.value = "LABORATÓRIO CEDRO - INVENTÁRIO DE INTELIGÊNCIA ARTIFICIAL";
    titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: labDark } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 40;

    worksheet.mergeCells('A2:H2');
    const subTitleRow = worksheet.getRow(2);
    subTitleRow.getCell(1).value = `Relatório gerado em: ${new Date().toLocaleString('pt-BR')}`;
    subTitleRow.getCell(1).font = { italic: true, color: { argb: '64748B' } };
    subTitleRow.getCell(1).alignment = { horizontal: 'center' };
    subTitleRow.height = 20;

    worksheet.addRow([]);

    const headerRowIndex = 4;
    const columns = [
    { header: "ID", key: "id", width: 18 },
    { header: "NOME DA FERRAMENTA", key: "nome", width: 35 },
    { header: "FORNECEDOR", key: "fornecedor", width: 25 },
    { header: "SETOR", key: "setor", width: 25 },
    { header: "STATUS", key: "status", width: 22 },
    { header: "CLASSIFICAÇÃO RISCO", key: "risco", width: 25 },
    { header: "DADOS SENSÍVEIS", key: "dados_sensiveis", width: 18 },
    { header: "DATA DE REGISTRO", key: "data", width: 20 }];


    const headerRow = worksheet.getRow(headerRowIndex);
    headerRow.values = columns.map((c) => c.header);
    headerRow.height = 35;

    headerRow.eachCell((cell, colNumber) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: brandGreen }
      };
      cell.font = {
        color: { argb: '000000' },
        bold: true,
        size: 11
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' }
      };

      worksheet.getColumn(colNumber).width = columns[colNumber - 1].width;
    });

    filteredRecords.forEach((r) => {
      const row = worksheet.addRow([
      r.id,
      r.nomeFerramenta,
      r.fornecedor,
      r.unidadeSetor,
      normalizeStatusUso(r.statusUso),
      r.classificacaoRiscoManual,
      r.usaDadosSensiveis,
      r.dataRegistro]
      );

      row.height = 25;
      row.eachCell((cell, colNumber) => {
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
          left: { style: 'thin', color: { argb: 'E2E8F0' } },
          right: { style: 'thin', color: { argb: 'E2E8F0' } }
        };

        if (colNumber === 5) {
          const norm = normalizeStatusUso(r.statusUso);
          if (norm === StatusUso.APROVADO) {
            cell.font = { color: { argb: '059669' }, bold: true };
          } else if (norm === StatusUso.CANCELADA) {
            cell.font = { color: { argb: 'F29222' }, bold: true };
          }
        }

        if (colNumber === 6 && (r.classificacaoRiscoManual === ClassificacaoRisco.ALTO || r.classificacaoRiscoManual === ClassificacaoRisco.CRITICO)) {
          cell.font = { color: { argb: 'DC2626' }, bold: true };
        }
      });
    });

    worksheet.views = [{ state: 'frozen', ySplit: 4 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, `inventario_ia_cedro_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getStatusBadge = (rawStatus: StatusUso) => {
    const status = normalizeStatusUso(rawStatus);
    const variantes: Partial<Record<StatusUso, string>> = {
      [StatusUso.APROVADO]: "aprovado",
      [StatusUso.APROVADO_COM_RESTRICOES]: "restricoes",
      [StatusUso.NAO_APROVADO]: "negado",
      [StatusUso.EM_AVALIACAO]: "avaliacao",
      [StatusUso.EM_TESTE_PILOTO]: "teste",
      [StatusUso.SUSPENSO]: "suspenso",
      [StatusUso.CANCELADA]: "cancelado",
    };
    const variante = variantes[status] || "neutro";

    return (
      <span className={`inventario-status inventario-status--${variante}`}>
        <span className="inventario-status__ponto" />
        {status}
      </span>
    );
  };

  const getWorkflowBadge = (record: IARecord) => {
    const recordWorkflow = workflows?.find((w) => w.iaRecordId === record.id);

    const stepsDef = approvalConfig?.steps ?? ETAPAS_APROVACAO_OFICIAIS.map(({ stepNumber, roleName }) => ({
      stepNumber,
      roleName,
    }));


    const isApprov = record.statusAuditoria === "Aprovado" || recordWorkflow?.finalStatus === "aprovado" || record.statusUso === StatusUso.APROVADO;
    const isNeg = record.statusAuditoria === "Negado" || recordWorkflow?.finalStatus === "negado" || record.statusUso === StatusUso.NAO_APROVADO;

    const currentStepNum = recordWorkflow ? recordWorkflow.currentStep : isApprov || isNeg ? 0 : 1;

    if (isApprov) {
      return (
        <div className="inventario__grupo-aprovada-final">
          <div className="inventario__grupo-todos-as-etapas-aprovadas" title="Todos as etapas aprovadas">
            {stepsDef.map((step: any) =>
            <span
              key={step.stepNumber}
              className="inventario__texto-4"
              title={`Etapa ${step.stepNumber}: ${step.roleName} - Aprovado`} />

            )}
          </div>
          <span className="inventario__texto-aprovada-final">
            Aprovada Final
          </span>
        </div>);

    }

    if (isNeg) {
      return (
        <div className="inventario__grupo-aprovada-final">
          <div className="inventario__grupo-todos-as-etapas-aprovadas" title="Fluxo encerrado por reprovação">
            {stepsDef.map((step: any) => {
              const sNum = step.stepNumber;
              const isRejectedHere = sNum === currentStepNum || recordWorkflow?.steps?.find((s) => s.stepNumber === sNum)?.status === "negado";

              const dotColor = isRejectedHere ? "inventario-fluxo__ponto--negado" : "inventario-fluxo__ponto--aguardando";
              return (
                <span
                  key={sNum}
                  className={`inventario-fluxo__ponto ${dotColor}`}
                  title={`Etapa ${sNum}: ${step.roleName}`} />);


            })}
          </div>
          <span className="inventario__texto-reprovada">
            Reprovada
          </span>
        </div>);

    }

    if (!recordWorkflow) {
      return (
        <div className="inventario__grupo-analise-inicial">
          <div className="inventario__grupo-todos-as-etapas-aprovadas">
            {stepsDef.map((step: any) =>
            <span
              key={step.stepNumber}
              className="inventario__texto-6"
              title={`Etapa ${step.stepNumber}: ${step.roleName}`} />

            )}
          </div>
          <span className="inventario__texto-analise-inicial">
            Análise inicial
          </span>
        </div>);

    }

    const activeStepDef = stepsDef.find((s: any) => s.stepNumber === currentStepNum);
    const stepLabel = activeStepDef ? activeStepDef.roleName : `Etapa ${currentStepNum}`;

    return (
      <div className="inventario__grupo-aprovada-final">
        <div className="inventario__grupo-todos-as-etapas-aprovadas">
          {stepsDef.map((step: any) => {
            const sNum = step.stepNumber;
            const wfStep = recordWorkflow?.steps?.find((s) => s.stepNumber === sNum);

            const isStepFailed = wfStep?.status === "negado" || isNeg && sNum === currentStepNum;
            const isStepPassed = !isStepFailed && (
            wfStep?.status === "aprovado" ||
            wfStep?.status === "opiniao" ||
            !wfStep && (sNum < currentStepNum || isApprov));

            const isStepCurrent = sNum === currentStepNum && !isApprov && !isNeg && (!wfStep || wfStep.status === "aguardando");

            const dotColor = isStepFailed
              ? "inventario-fluxo__ponto--negado"
              : isStepPassed
                ? "inventario-fluxo__ponto--aprovado"
                : isStepCurrent
                  ? "inventario-fluxo__ponto--atual"
                  : "inventario-fluxo__ponto--aguardando";

            return (
              <span
                key={sNum}
                className={`inventario-fluxo__ponto ${dotColor}`}
                title={`Etapa ${sNum}: ${step.roleName} (${isStepFailed ? 'Negada' : isStepPassed ? 'Aprovada' : isStepCurrent ? 'Em Andamento' : 'Aguardando'})`} />);


          })}
        </div>
        <span className="inventario__texto-etapa">
          Etapa {currentStepNum}: <span className="inventario__texto-9">{stepLabel}</span>
        </span>
      </div>);

  };

  const rangeStart = (currentPage - 1) * itemsPerPage + 1;
  const rangeEnd = Math.min(currentPage * itemsPerPage, filteredRecords.length);

  return (
    <div id="inventario-conteudo" data-componente="pagina-inventario" className="pagina-inventario inventario-container cedro-page-premium">
      {/* <div className="inventario-cabecalho inventario__inventario-cabecalho-estrutura">
        <div className="inventario-cabecalho__texto">
          <span className="inventario-cabecalho__sobretitulo">Governança de IA</span>
          <h1 className="inventario-cabecalho__titulo">Inventário de IA</h1>
          <p className="inventario-cabecalho__descricao">Acompanhe, filtre e gerencie as soluções registradas no Cedro IA.</p>
        </div>

        <div className="inventario-acoes inventario__inventario-acoes-estrutura">
          <button
            onClick={exportExcel}
            className="inventario__botao-exportar-inventario">
            
            <FileSpreadsheet size={16} className="inventario__icone-filespreadsheet" />
            <span>Exportar inventário</span>
          </button>
          <button
            onClick={onAdd}
            className="inventario__botao-novo-registro">
            
            <PlusCircle size={16} />
            <span>Novo registro</span>
          </button>
        </div>
      </div> */}

      <div className="inventario-resumo inventario__inventario-resumo-estrutura">
        <div className="inventario-resumo__card inventario-resumo__card--total">
          <div className="inventario-resumo__icone">
            <Database size={22} />
          </div>
          <div className="inventario-resumo__conteudo">
            <p className="inventario-resumo__rotulo">Total de IAs</p>
            <strong className="inventario-resumo__valor">{totalIAs}</strong>
            <span className="inventario-resumo__legenda">{totalIAs === 1 ? "registrada" : "registradas"}</span>
          </div>
        </div>

        <div className="inventario-resumo__card inventario-resumo__card--avaliacao">
          <div className="inventario-resumo__icone">
            <ClipboardList size={22} />
          </div>
          <div className="inventario-resumo__conteudo">
            <p className="inventario-resumo__rotulo">Em avaliação</p>
            <strong className="inventario-resumo__valor">{emAvaliacaoCount}</strong>
            <span className="inventario-resumo__legenda">{emAvaliacaoCount === 1 ? "solução" : "soluções"}</span>
          </div>
        </div>

        <div className="inventario-resumo__card inventario-resumo__card--aprovadas">
          <div className="inventario-resumo__icone">
            <ShieldCheck size={22} />
          </div>
          <div className="inventario-resumo__conteudo">
            <p className="inventario-resumo__rotulo">Aprovadas</p>
            <strong className="inventario-resumo__valor">{aprovadasCount}</strong>
            <span className="inventario-resumo__legenda">{aprovadasCount === 1 ? "solução" : "soluções"}</span>
          </div>
        </div>
      </div>

      <div className="inventario-filtros">
        <div className="inventario-filtros__linha">
          <div className="inventario-busca">
            {/* <Search className="inventario-busca__icone" size={18} /> */}
            <input
              type="text"
              placeholder="Pesquisar por nome, fornecedor ou ID..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="inventario-busca__campo"
            />
          </div>

          <label className="inventario-filtro">
            <span className="inventario-filtro__rotulo">Status</span>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="inventario-filtro__select"
            >
              <option value="">Todos</option>
              <option value={StatusUso.EM_AVALIACAO}>Em avaliação</option>
              <option value={StatusUso.EM_TESTE_PILOTO}>Em teste/piloto</option>
              <option value={StatusUso.APROVADO}>Aprovado</option>
              <option value={StatusUso.APROVADO_COM_RESTRICOES}>Aprovado com restrições</option>
              <option value={StatusUso.NAO_APROVADO}>Não aprovado</option>
              <option value={StatusUso.SUSPENSO}>Suspenso</option>
              <option value={StatusUso.CANCELADA}>Cancelada</option>
            </select>
          </label>

          <label className="inventario-filtro">
            <span className="inventario-filtro__rotulo">Setor</span>
            <select
              value={filterSetor}
              onChange={(e) => {
                setFilterSetor(e.target.value);
                setCurrentPage(1);
              }}
              className="inventario-filtro__select"
            >
              <option value="">Todos</option>
              {setoresDisponiveis.map((setor) => (
                <option key={setor} value={setor}>{setor}</option>
              ))}
            </select>
          </label>

          <div className="inventario-filtros__resultado">
            <strong>{filteredRecords.length}</strong> {filteredRecords.length === 1 ? "resultado" : "resultados"}
          </div>
        </div>

        {(searchTerm || filterSetor || filterStatus || filterRisco || filterDadosSensiveis) && (
          <button
            onClick={() => {
              setSearchTerm("");
              setFilterSetor("");
              setFilterStatus("");
              setFilterRisco("");
              setFilterDadosSensiveis("");
              setCurrentPage(1);
            }}
            className="inventario-filtros__limpar"
          >
            <RotateCcw size={13} />
            <span>Limpar filtros</span>
          </button>
        )}
      </div>

      <div className="inventario-lista-mobile inventario__inventario-lista-mobile-estrutura">
        {paginatedRecords.map((record) =>
        <article
          key={record.id}
          data-registro={record.id}
          className="inventario-card-mobile cedro-card-premium inventario__inventario-card-mobile-estrutura">
          
            <div className="inventario__grupo-5">
              <span className="inventario__texto-11">
                {record.id}
              </span>
              <div className="inventario__texto-8">{getStatusBadge(record.statusUso)}</div>
            </div>

            <div className="inventario__grupo-6">
              <h3 className="inventario__titulo-bloco">
                {record.nomeFerramenta}
              </h3>
              {record.fornecedor && record.fornecedor.toLowerCase().trim() !== "interno" &&
            <p className="inventario__descricao-2">
                  {record.fornecedor}
                </p>
            }
            </div>

            <div className="inventario__grupo-setor">
              <div className="inventario__grupo-setor-2">
                <p className="inventario__descricao-setor">Setor</p>
                <p className="inventario__descricao-3">{record.unidadeSetor || "Não informado"}</p>
              </div>
              <div className="inventario__grupo-setor-2">
                <p className="inventario__descricao-etapa-atual">Etapa atual</p>
                <div className="inventario__grupo-7">{getWorkflowBadge(record)}</div>
              </div>
            </div>

            <div className="inventario__grupo-ver-detalhes">
              {canCancel(record) &&
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCancelTargetRecord(record);
              }}
              className="inventario__botao-cancelar-solicitacao">
              
                  Cancelar solicitação
                </button>
            }
              <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onView(record);
              }}
              className={`inventario__botao-ver-detalhes ${canCancel(record) ? "" : "inventario__botao-ver-detalhes-2"}`}>
              
                <Eye size={15} />
                Ver detalhes
              </button>
            </div>
          </article>
        )}

        {filteredRecords.length === 0 &&
        <div className="inventario__grupo-nenhum-registro-encontrado-no-">
            <Database size={34} className="inventario__icone-database" />
            <p className="inventario__descricao-nenhum-registro-encontrado-no-">
              Nenhum registro encontrado no inventário
            </p>
          </div>
        }

        <div className="inventario__grupo-8">
          <div className="inventario__grupo-9">
            {filteredRecords.length === 0 ?
            "Exibindo 0 registros" :

            <>
                Exibindo <span className="inventario__texto-12">{rangeStart}</span> a{" "}
                <span className="inventario__texto-12">{rangeEnd}</span> de{" "}
                <span className="inventario__texto-12">{filteredRecords.length}</span>
              </>
            }
          </div>

          {totalPages > 1 &&
          <div className="inventario__grupo-10">
              <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="inventario__botao-pagina-anterior"
              aria-label="Página anterior">
              
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: totalPages }).map((_, idx) => {
              const pg = idx + 1;
              const isCurrent = pg === currentPage;
              return (
                <button
                  key={pg}
                  onClick={() => setCurrentPage(pg)}
                  className={`inventario__botao ${isCurrent ? "inventario__botao-2" : "inventario__botao-3"}`}>
                  
                    {pg}
                  </button>);

            })}
              <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="inventario__botao-pagina-anterior"
              aria-label="Próxima página">
              
                <ChevronRight size={16} />
              </button>
            </div>
          }
        </div>
      </div>

      <div className="inventario-tabela-container inventario__inventario-tabela-container-estrutura">
        <div className="rolagem-personalizada inventario__grupo-11">
          <table id="tabelaInventarioIA" className="inventario-tabela inventario__inventario-tabela-estrutura">
            <thead className="inventario__cabecalho-tabela">
              <tr>
                <th className="inventario__cabecalho-coluna" onClick={() => handleSort("id")}>
                  <div className="grupo-interativo inventario__grupo-12">ID <ArrowUpDown size={12} className="inventario__icone-arrowupdown" /></div>
                </th>
                <th className="inventario__cabecalho-coluna-nome-da-ia" onClick={() => handleSort("nomeFerramenta")}>
                  <div className="grupo-interativo inventario__grupo-12">Nome da IA <ArrowUpDown size={12} className="inventario__icone-arrowupdown" /></div>
                </th>
                <th className="inventario__cabecalho-coluna-setor" onClick={() => handleSort("unidadeSetor")}>
                  <div className="grupo-interativo inventario__grupo-12">Setor <ArrowUpDown size={12} className="inventario__icone-arrowupdown" /></div>
                </th>
                <th className="inventario__cabecalho-coluna-status">Status</th>
                <th className="inventario__cabecalho-coluna-etapa-atual">Etapa atual</th>
                <th className="inventario__cabecalho-coluna-atualizacao" onClick={() => handleSort("updatedAt")}>
                  <div className="grupo-interativo inventario__grupo-12">Última atualização <ArrowUpDown size={12} className="inventario__icone-arrowupdown" /></div>
                </th>
                <th className="inventario__cabecalho-coluna-acoes">Ações</th>
              </tr>
            </thead>
            <tbody className="inventario__corpo-tabela">
              {paginatedRecords.map((record) =>
              <tr
                key={record.id}
                className="inventario-item inventario__inventario-item-estrutura"
                data-registro={record.id}>
                
                  <td className="inventario__celula">
                    <span className="inventario__texto-13">
                      {record.id}
                    </span>
                  </td>
                  <td className="inventario__celula-2">
                    <div className="inventario__grupo-13">
                      <span className="inventario__texto-14">
                        {record.nomeFerramenta}
                      </span>
                      {record.fornecedor && record.fornecedor.toLowerCase().trim() !== "interno" &&
                    <span className="inventario__texto-15">
                          {record.fornecedor}
                        </span>
                    }
                    </div>
                  </td>
                  <td className="inventario__celula-3">
                    <span className="inventario__texto-16">
                      {record.unidadeSetor}
                    </span>
                  </td>
                  <td className="inventario__celula-3">
                    {getStatusBadge(record.statusUso)}
                  </td>
                  <td className="inventario__celula-3">
                    {getWorkflowBadge(record)}
                  </td>
                  <td className="inventario__celula-atualizacao">
                    {formatarAtualizacao(record.updatedAt || record.createdAt)}
                  </td>
                  <td className="inventario__celula-4">
                    <div className="inventario-acoes-linha">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onView(record);
                        }}
                        className="inventario-acoes-linha__analisar"
                      >
                        Analisar
                      </button>

                      <div className="inventario-acoes-linha__menu-container">
                        <button
                          type="button"
                          className="inventario-acoes-linha__menu-botao"
                          aria-label={`Mais ações para ${record.nomeFerramenta}`}
                          aria-expanded={actionMenuId === record.id}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setActionMenuId((current) => current === record.id ? null : record.id);
                          }}
                        >
                          <MoreVertical size={17} />
                        </button>

                        {actionMenuId === record.id && (
                          <div className="inventario-acoes-menu">
                            <button type="button" onClick={() => { setActionMenuId(null); onView(record); }}>
                              <Eye size={15} /> Ver ficha
                            </button>
                            {isAdmin && (
                              <button type="button" onClick={() => { setActionMenuId(null); onEdit(record); }}>
                                <Pencil size={15} /> Editar cadastro
                              </button>
                            )}
                            {canCancel(record) && (
                              <button
                                type="button"
                                className="inventario-acoes-menu__perigo"
                                onClick={() => {
                                  setActionMenuId(null);
                                  setCancelTargetRecord(record);
                                }}
                              >
                                <XCircle size={15} /> Cancelar solicitação
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              {filteredRecords.length === 0 &&
              <tr>
                  <td colSpan={7} className="inventario__celula-5">
                    <div className="inventario__grupo-nenhum-registro-encontrado-no--2">
                      <Database size={40} className="inventario__icone-database-2" />
                      <p className="inventario__descricao-nenhum-registro-encontrado-no--2">
                        Nenhum registro encontrado no inventário
                      </p>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div className="inventario__grupo-15">
          <div className="inventario__grupo-16">
            {filteredRecords.length === 0 ?
            "Exibindo 0 registros" :

            <>
                Exibindo <span className="inventario__texto-12">{rangeStart}</span> a{" "}
                <span className="inventario__texto-12">{rangeEnd}</span> de{" "}
                <span className="inventario__texto-12">{filteredRecords.length}</span>{" "}
                {filteredRecords.length === 1 ? "registro" : "registros"}
              </>
            }
          </div>
          
          {totalPages > 1 &&
          <div className="inventario__grupo-17">
              <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="inventario__botao-pagina-anterior-2"
              title="Página Anterior">
              
                <ChevronLeft size={16} />
              </button>

              <div className="inventario__grupo-18">
                {Array.from({ length: totalPages }).map((_, idx) => {
                const pg = idx + 1;
                const isCurrent = pg === currentPage;
                return (
                  <button
                    key={pg}
                    onClick={() => setCurrentPage(pg)}
                    className={`inventario__botao-4 ${
                    isCurrent ?
                    "inventario__botao-2" :
                    "inventario__botao-5"}`
                    }>
                    
                      {pg}
                    </button>);

              })}
              </div>

              <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="inventario__botao-pagina-anterior-2"
              title="Próxima Página">
              
                <ChevronRight size={16} />
              </button>
            </div>
          }
        </div>
      </div>

      {warningMessage &&
      <div className="cedro-modal-overlay inventario__grupo-19">
          <div className="cedro-modal-painel cedro-modal-painel--compacto inventario__grupo-20">
            <div className="inventario__grupo-21">
              <div className="inventario__grupo-22">
                <div className="inventario__grupo-23">
                  <AlertTriangle size={20} />
                </div>
                <h3 className="inventario__titulo-bloco-relatorio-em-processamento">Relatório em processamento</h3>
              </div>
              <p className="inventario__descricao-4">
                {warningMessage}
              </p>
            </div>
            <div className="inventario__grupo-entendi">
              <button
              onClick={() => setWarningMessage(null)}
              className="inventario__botao-entendi">
              
                Entendi
              </button>
            </div>
          </div>
        </div>
      }

      {cancelTargetRecord &&
      <div className="cedro-modal-overlay inventario__grupo-19">
          <div className="cedro-modal-painel cedro-modal-painel--compacto inventario__grupo-24">
            <div className="inventario__grupo-21">
              <div className="inventario__grupo-25">
                <div className="inventario__grupo-26">
                  <AlertTriangle size={20} />
                </div>
                <h3 className="inventario__titulo-bloco-cancelar-solicitacao-de-ia">
                  Cancelar solicitação de IA?
                </h3>
              </div>
              <p className="inventario__descricao-voce-esta-prestes-a-cancelar-a">
                Você está prestes a cancelar a solicitação para a ferramenta <strong className="inventario__elemento-2">{cancelTargetRecord.nomeFerramenta}</strong>.
              </p>
              <p className="inventario__descricao-esta-acao-ira-cancelar-a-solic">
                Esta ação irá cancelar a solicitação e interromper o andamento do fluxo de aprovação. O registro permanecerá disponível para consulta no inventário e no histórico.
              </p>
            </div>
            <div className="inventario__grupo-voltar">
              <button
              onClick={() => setCancelTargetRecord(null)}
              disabled={isCancelling}
              className="inventario__botao-voltar">
              
                Voltar
              </button>
              <button
              onClick={async () => {
                setIsCancelling(true);
                if (onCancelRequest) {
                  await onCancelRequest(cancelTargetRecord.id);
                }
                setIsCancelling(false);
                setCancelTargetRecord(null);
              }}
              disabled={isCancelling}
              className="inventario__botao-6">
              
                {isCancelling ? "Cancelando..." : "Confirmar cancelamento"}
              </button>
            </div>
          </div>
        </div>
      }
    </div>);

}
