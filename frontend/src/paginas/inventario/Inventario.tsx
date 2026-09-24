/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ETAPAS_APROVACAO_OFICIAIS } from "@/constantes/fluxo-aprovacao";
import React, { useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Search, Eye, ArrowUpDown, AlertTriangle, CheckCircle2, PlusCircle, Database, FileSpreadsheet, ChevronLeft, ChevronRight, RotateCcw, ClipboardList, ShieldCheck, MoreVertical, Pencil, XCircle } from "lucide-react";
import { IconeIA } from "@/componentes/comuns/IconeIA";
import { IARecord, ApprovalWorkflow } from "@/tipos";
import {
  obterStatusGeralDoRegistro,
  obterVarianteStatus,
  STATUS_GERAIS_OFICIAIS,
  type StatusGeral,
} from "@/utilitarios/status-solicitacao";
import {
  fluxoEstaCancelado,
  normalizarNumeroEtapa,
  obterNomeEtapaAtualInventario,
  obterEstadoVisualEtapaFluxo,
} from "@/utilitarios/etapa-atual-workflow";
import { encontrarWorkflowDoRegistro } from "@/utilitarios/workflows-aprovacao";

interface InventoryProps {
  records: IARecord[];
  onEdit: (record: IARecord) => void;
  onView: (record: IARecord) => void;
  onAdd: () => void;
  onRefresh: () => void;
  isAdmin?: boolean;
  approvalConfig?: any;
  onSaveApprovalConfig?: any;
  workflows?: ApprovalWorkflow[];
  currentUser?: any;
  currentUserProfile?: any;
  onCancelRequest?: (id: string, justificativa: string) => Promise<void>;
}

export default function Inventory({
  records,
  onEdit,
  onView,
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
  const [sortField, setSortField] = useState<keyof IARecord | "">("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [actionMenuPosition, setActionMenuPosition] = useState({ top: 0, left: 0 });
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const actionMenuButtonRef = useRef<HTMLButtonElement | null>(null);

  const [cancelTargetRecord, setCancelTargetRecord] = useState<IARecord | null>(null);
  const [cancelJustificativa, setCancelJustificativa] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  const fecharModalCancelamento = () => {
    setCancelTargetRecord(null);
    setCancelJustificativa("");
  };

  useEffect(() => {
    if (!actionMenuId) return;

    const fecharAoClicarFora = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !actionMenuRef.current?.contains(target) &&
        !actionMenuButtonRef.current?.contains(target)
      ) {
        setActionMenuId(null);
      }
    };
    const fecharComEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActionMenuId(null);
    };
    const fecharAoReposicionar = () => setActionMenuId(null);

    document.addEventListener("mousedown", fecharAoClicarFora);
    window.addEventListener("keydown", fecharComEscape);
    window.addEventListener("resize", fecharAoReposicionar);
    window.addEventListener("scroll", fecharAoReposicionar, true);
    return () => {
      document.removeEventListener("mousedown", fecharAoClicarFora);
      window.removeEventListener("keydown", fecharComEscape);
      window.removeEventListener("resize", fecharAoReposicionar);
      window.removeEventListener("scroll", fecharAoReposicionar, true);
    };
  }, [actionMenuId]);

  useEffect(() => {
    if (!warningMessage && !cancelTargetRecord) return;
    const fecharComEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isCancelling) return;
      setWarningMessage(null);
      fecharModalCancelamento();
    };
    window.addEventListener("keydown", fecharComEscape);
    return () => window.removeEventListener("keydown", fecharComEscape);
  }, [warningMessage, cancelTargetRecord, isCancelling]);

  const obterWorkflow = (record: IARecord) =>
    encontrarWorkflowDoRegistro(workflows, record.id);

  const obterStatus = (record: IARecord): StatusGeral =>
    obterStatusGeralDoRegistro(record, obterWorkflow(record));

  const canCancel = (record: IARecord) => {
    const ownerId = record.ownerId || (record as { owner_id?: string }).owner_id;
    const isOwner = Boolean(currentUser?.id && ownerId && String(ownerId) === String(currentUser.id));
    const isUserAllowed = isOwner || isAdmin;

    if (!isUserAllowed) return false;

    const statusGeral = obterStatus(record);
    return !["Aprovada", "Não aprovada", "Cancelada"].includes(statusGeral);
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const totalIAs = records.length;
  const emAndamentoCount = records.filter((r) => {
    const status = obterStatus(r);
    return status === "Em análise" || status === "Em teste";
  }).length;
  const aprovadasCount = records.filter((r) => obterStatus(r) === "Aprovada").length;

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
      obterStatus(r).toLowerCase().includes(searchLower);

      const matchesSetor = !filterSetor || r.unidadeSetor === filterSetor;
      const matchesStatus = !filterStatus || obterStatus(r) === filterStatus;

      return matchesSearch && matchesSetor && matchesStatus;
    }).sort((a, b) => {
      if (!sortField) return 0;
      const valA = a[sortField];
      const valB = b[sortField];

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDirection === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return 0;
    });
  }, [records, searchTerm, filterSetor, filterStatus, sortField, sortDirection, workflows]);

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
    const [{ default: ExcelJS }, { saveAs }] = await Promise.all([
      import("exceljs"),
      import("file-saver"),
    ]);
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Minhas IAs Cedro");

    const brandGreen = "00C875";
    const labDark = "0F172A";

    worksheet.mergeCells('A1:F1');
    const titleCell = worksheet.getRow(1).getCell(1);
    titleCell.value = "LABORATÓRIO CEDRO - INVENTÁRIO DE INTELIGÊNCIA ARTIFICIAL";
    titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: labDark } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 40;

    worksheet.mergeCells('A2:F2');
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
      obterStatus(r),
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
          const statusGeral = obterStatus(r);
          if (statusGeral === "Aprovada") {
            cell.font = { color: { argb: '059669' }, bold: true };
          } else if (statusGeral === "Cancelada" || statusGeral === "Não aprovada") {
            cell.font = { color: { argb: 'F29222' }, bold: true };
          }
        }
      });
    });

    worksheet.views = [{ state: 'frozen', ySplit: 4 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, `inventario_ia_cedro_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getStatusBadge = (record: IARecord) => {
    const status = obterStatus(record);
    const variante = obterVarianteStatus(status);

    return (
      <span className={`inventario-status inventario-status--${variante}`}>
        <span className="inventario-status__ponto" />
        {status}
      </span>
    );
  };

  const getWorkflowBadge = (record: IARecord) => {
    const recordWorkflow = obterWorkflow(record);

    const stepsDef = approvalConfig?.steps ?? ETAPAS_APROVACAO_OFICIAIS.map(({ stepNumber, roleName }) => ({
      stepNumber,
      roleName,
    }));


    const statusGeral = obterStatus(record);
    const isApprov = statusGeral === "Aprovada";
    const isNeg = statusGeral === "Não aprovada";
    const isCancel = statusGeral === "Cancelada" || fluxoEstaCancelado(recordWorkflow);

    const currentStepNum = normalizarNumeroEtapa(recordWorkflow?.currentStep)
      ?? (isApprov || isNeg || isCancel ? 0 : 1);

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

    if (isCancel) {
      return (
        <div className="inventario__grupo-aprovada-final">
          <div className="inventario__grupo-todos-as-etapas-aprovadas" title="Fluxo encerrado por cancelamento">
            {stepsDef.map((step: any) => {
              const estado = obterEstadoVisualEtapaFluxo(step.stepNumber, recordWorkflow);
              const dotColor = estado === "negado"
                ? "inventario-fluxo__ponto--negado"
                : estado === "aprovado"
                  ? "inventario-fluxo__ponto--aprovado"
                  : "inventario-fluxo__ponto--aguardando";
              return (
                <span
                  key={step.stepNumber}
                  className={`inventario-fluxo__ponto ${dotColor}`}
                  title={`Etapa ${step.stepNumber}: ${step.roleName}`} />);
            })}
          </div>
          <span className="inventario-status inventario-status--cancelada">
            Cancelada
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

    const stepLabel = obterNomeEtapaAtualInventario(currentStepNum);

    return (
      <div className="inventario__grupo-aprovada-final">
        <div className="inventario__grupo-todos-as-etapas-aprovadas">
          {stepsDef.map((step: any) => {
            const sNum = step.stepNumber;
            const estado = obterEstadoVisualEtapaFluxo(sNum, recordWorkflow);
            const isStepFailed = estado === "negado";
            const isStepPassed = estado === "aprovado";
            const isStepCurrent = estado === "atual";

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
          <h1 className="inventario-cabecalho__titulo">Minhas IAs</h1>
          <p className="inventario-cabecalho__descricao">Acompanhe, filtre e gerencie as soluções registradas no Cedro IA.</p>
        </div>

        <div className="inventario-acoes inventario__inventario-acoes-estrutura">
          <button
            onClick={exportExcel}
            className="inventario__botao-exportar-inventario">
            
            <FileSpreadsheet size={16} className="inventario__icone-filespreadsheet" />
            <span>Exportar Minhas IAs</span>
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
            <p className="inventario-resumo__rotulo">Em andamento</p>
            <strong className="inventario-resumo__valor">{emAndamentoCount}</strong>
            <span className="inventario-resumo__legenda">{emAndamentoCount === 1 ? "solução" : "soluções"}</span>
          </div>
        </div>

        <div className="inventario-resumo__card inventario-resumo__card--aprovadas">
          <div className="inventario-resumo__icone">
            <ShieldCheck size={22} />
          </div>
          <div className="inventario-resumo__conteudo">
            <p className="inventario-resumo__rotulo">Aprovada</p>
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
              {STATUS_GERAIS_OFICIAIS.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
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

        {(searchTerm || filterSetor || filterStatus) && (
          <button
            onClick={() => {
              setSearchTerm("");
              setFilterSetor("");
              setFilterStatus("");
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
              <div className="inventario__texto-8">{getStatusBadge(record)}</div>
            </div>

            <div className="inventario__identidade-mobile">
              <IconeIA nome={record.nomeFerramenta} tamanho={32} />
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
              Nenhum registro encontrado em Minhas IAs
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
                    <div className="inventario__identidade-tabela">
                      <IconeIA nome={record.nomeFerramenta} tamanho={28} />
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
                    </div>
                  </td>
                  <td className="inventario__celula-3 inventario__celula-setor">
                    <span
                      className="inventario__texto-16 inventario__texto-setor"
                      title={record.unidadeSetor || "Não informado"}
                    >
                      {record.unidadeSetor}
                    </span>
                  </td>
                  <td className="inventario__celula-3 inventario__celula-status">
                    {getStatusBadge(record)}
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
                          ref={actionMenuId === record.id ? actionMenuButtonRef : undefined}
                          type="button"
                          className="inventario-acoes-linha__menu-botao"
                          aria-label={`Mais ações para ${record.nomeFerramenta}`}
                          aria-expanded={actionMenuId === record.id}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (actionMenuId === record.id) {
                              setActionMenuId(null);
                              return;
                            }

                            const rect = e.currentTarget.getBoundingClientRect();
                            const menuWidth = 210;
                            const menuHeight = 12 + (2 + (isAdmin ? 1 : 0) + (canCancel(record) ? 1 : 0)) * 38;
                            const gap = 7;
                            const margin = 8;
                            const top = window.innerHeight - rect.bottom >= menuHeight + gap
                              ? rect.bottom + gap
                              : Math.max(margin, rect.top - menuHeight - gap);
                            const left = Math.min(
                              window.innerWidth - menuWidth - margin,
                              Math.max(margin, rect.right - menuWidth),
                            );

                            actionMenuButtonRef.current = e.currentTarget;
                            setActionMenuPosition({ top, left });
                            setActionMenuId(record.id);
                          }}
                        >
                          <MoreVertical size={17} />
                        </button>

                        {actionMenuId === record.id && createPortal(
                          <div
                            ref={actionMenuRef}
                            className="inventario-acoes-menu"
                            style={{
                              position: "fixed",
                              top: actionMenuPosition.top,
                              left: actionMenuPosition.left,
                              right: "auto",
                              width: 210,
                            }}
                          >
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
                          </div>,
                          document.body,
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
                        Nenhum registro encontrado em Minhas IAs
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
      <div
        className="cedro-modal-overlay inventario__grupo-19"
        onClick={(event) => {
          if (event.target === event.currentTarget) setWarningMessage(null);
        }}
      >
          <div className="cedro-modal-painel cedro-modal-painel--compacto inventario__grupo-20" onClick={(event) => event.stopPropagation()}>
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
      <div
        className="cedro-modal-overlay inventario__grupo-19"
        onClick={(event) => {
          if (event.target === event.currentTarget && !isCancelling) fecharModalCancelamento();
        }}
      >
          <div className="cedro-modal-painel cedro-modal-painel--compacto inventario__grupo-24" onClick={(event) => event.stopPropagation()}>
            <div className="inventario__grupo-21">
              <div className="inventario__grupo-25">
                <div className="inventario__grupo-26">
                  <AlertTriangle size={20} />
                </div>
                <h3 className="inventario__titulo-bloco-cancelar-solicitacao-de-ia">
                  Cancelar esta solicitação?
                </h3>
              </div>
              <p className="inventario__descricao-esta-acao-ira-cancelar-a-solic">
                Informe o motivo do cancelamento. Após o cancelamento, ela não seguirá para aprovação.
              </p>
              <label className="inventario__cancelamento-campo">
                <span>Motivo do cancelamento</span>
                <textarea
                  value={cancelJustificativa}
                  onChange={(event) => setCancelJustificativa(event.target.value)}
                  disabled={isCancelling}
                  rows={5}
                  required
                />
              </label>
            </div>
            <div className="inventario__grupo-voltar">
              <button
              onClick={fecharModalCancelamento}
              disabled={isCancelling}
              className="inventario__botao-voltar">
              
                Voltar
              </button>
              <button
              onClick={async () => {
                const justificativa = cancelJustificativa.trim();
                if (!justificativa || !onCancelRequest) return;
                setIsCancelling(true);
                try {
                  await onCancelRequest(cancelTargetRecord.id, justificativa);
                  fecharModalCancelamento();
                } finally {
                  setIsCancelling(false);
                }
              }}
              disabled={isCancelling || !cancelJustificativa.trim()}
              className="inventario__botao-6">
              
                {isCancelling ? "Cancelando..." : "Confirmar cancelamento"}
              </button>
            </div>
          </div>
        </div>
      }
    </div>);

}
