/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { CustomDropdown } from "@/componentes/comuns/MenuSuspenso";
import {
  Database,
  Clock,
  CheckCircle2,
  XCircle,
  PlusCircle,
  Sparkles } from
"lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell } from
"recharts";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { IARecord } from "@/tipos";
import {
  KPICard,
  TableCard,
  ActionCard } from
"@/componentes/painel/ComponentesPainel";
import {
  obterStatusGeralDoRegistro,
  type StatusGeral,
} from "@/utilitarios/status-solicitacao";

interface DashboardProps {
  records: IARecord[];
  onNavigate: (tab: string) => void;
  onView?: (record: IARecord) => void;
  isAdmin?: boolean;
  workflows?: any[];
  approvalConfig?: any;
  currentUserId?: string;
}

export default function Dashboard({
  records,
  onNavigate,
  onView,
  isAdmin,
  workflows = [],
  approvalConfig,
  currentUserId
}: DashboardProps) {

  const [period, setPeriod] = useState<string>("30-days");

  const obterStatus = (record: IARecord): StatusGeral => {
    const workflow = workflows.find((wf) => wf.iaRecordId === record.id);
    return obterStatusGeralDoRegistro(record, workflow);
  };

  const stats = useMemo(() => {
    const total = records.length;
    const contagem: Record<StatusGeral, number> = {
      "Em análise": 0,
      "Em teste": 0,
      Aprovada: 0,
      "Não aprovada": 0,
      Cancelada: 0,
    };

    records.forEach((record) => {
      const status = obterStatusGeralDoRegistro(
        record,
        workflows.find((wf) => wf.iaRecordId === record.id),
      );
      contagem[status] += 1;
    });

    return {
      total,
      emAnalise: contagem["Em análise"],
      emTeste: contagem["Em teste"],
      aprovadas: contagem.Aprovada,
      naoAprovadas: contagem["Não aprovada"],
      canceladas: contagem.Cancelada,
      emAndamento: contagem["Em análise"] + contagem["Em teste"],
    };
  }, [records, workflows]);

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Inventário de IA Cedro");

    const bgBrandGreen = "075618";
    const whiteText = "FFFFFF";

    worksheet.mergeCells("A1:E1");
    const titleCell = worksheet.getRow(1).getCell(1);
    titleCell.value = "MAPEAMENTO DE IA - LABORATÓRIO CEDRO";
    titleCell.font = { size: 14, bold: true, color: { argb: whiteText } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgBrandGreen } };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    worksheet.getRow(1).height = 40;

    worksheet.mergeCells("A2:E2");
    const subtitleCell = worksheet.getRow(2).getCell(1);
    subtitleCell.value = `Relatório gerado em: ${new Date().toLocaleString("pt-BR")} | Total de Sistemas: ${records.length}`;
    subtitleCell.font = { italic: true, color: { argb: "555555" }, size: 10 };
    subtitleCell.alignment = { horizontal: "center" };
    worksheet.getRow(2).height = 20;

    worksheet.addRow([]);

    const headers = [
    { header: "ID", key: "id", width: 18 },
    { header: "NOME DA FERRAMENTA", key: "nome", width: 32 },
    { header: "UNIDADE / SETOR", key: "setor", width: 22 },
    { header: "STATUS", key: "status", width: 22 },
    { header: "DATA DE CADASTRO", key: "data", width: 18 }];


    const headerIndex = 4;
    const headerRow = worksheet.getRow(headerIndex);
    headerRow.values = headers.map((h) => h.header);
    headerRow.height = 30;

    headerRow.eachCell((cell, colNum) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "EDF5EF" } };
      cell.font = { color: { argb: "0B2D12" }, bold: true, size: 11 };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin", color: { argb: "D1E2D5" } },
        bottom: { style: "medium", color: { argb: "075618" } },
        left: { style: "thin", color: { argb: "D1E2D5" } },
        right: { style: "thin", color: { argb: "D1E2D5" } }
      };
      worksheet.getColumn(colNum).width = headers[colNum - 1].width;
    });

    records.forEach((r) => {
      const statusGeral = obterStatus(r);
      const row = worksheet.addRow([
      r.id,
      r.nomeFerramenta,
      r.unidadeSetor,
      statusGeral,
      r.dataRegistro || r.createdAt?.slice(0, 10) || ""]
      );

      row.height = 24;
      row.eachCell((cell, colNum) => {
        cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true, indent: 1 };
        cell.border = {
          bottom: { style: "thin", color: { argb: "E8E7E7" } },
          left: { style: "thin", color: { argb: "E8E7E7" } },
          right: { style: "thin", color: { argb: "E8E7E7" } }
        };

        if (colNum === 4) {
          if (statusGeral === "Aprovada") {
            cell.font = { color: { argb: "10B981" }, bold: true };
          } else if (statusGeral === "Não aprovada" || statusGeral === "Cancelada") {
            cell.font = { color: { argb: "EF4444" }, bold: true };
          } else {
            cell.font = { color: { argb: "F59E0B" }, bold: true };
          }
        }
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, `cedro_governança_ia_${new Date().getTime()}.xlsx`);
  };

  const evolutionData = useMemo(() => {
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    if (records.length === 0) {
      const now = new Date();
      return Array.from({ length: 6 }).map((_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        return {
          name: monthNames[d.getMonth()],
          "Total de IAs": 0
        };
      });
    }

    const now = new Date();
    const chartData = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mIdx = d.getMonth();
      const year = d.getFullYear();

      const endOfMonth = new Date(year, mIdx + 1, 0, 23, 59, 59, 999);

      const totalCount = records.filter((r) => {
        const dateStr = r.dataRegistro || r.createdAt;
        if (!dateStr) return true;
        const rDate = new Date(dateStr);
        return isNaN(rDate.getTime()) || rDate.getTime() <= endOfMonth.getTime();
      }).length;

      chartData.push({
        name: monthNames[mIdx],
        "Total de IAs": totalCount
      });
    }

    return chartData;
  }, [records]);

  const donutData = useMemo(() => {
    return [
    { name: "Em análise", value: stats.emAnalise, color: "#F59E0B" },
    { name: "Em teste", value: stats.emTeste, color: "#3B82F6" },
    { name: "Aprovada", value: stats.aprovadas, color: "#10B981" },
    { name: "Não aprovada", value: stats.naoAprovadas, color: "#EF4444" },
    { name: "Cancelada", value: stats.canceladas, color: "#F29222" }].
    filter((item) => item.value > 0);
  }, [stats]);

  const priorityPedings = useMemo(() => {
    return [...records].
    sort((a, b) => {
      const statusA = obterStatusGeralDoRegistro(a, workflows.find((wf) => wf.iaRecordId === a.id));
      const statusB = obterStatusGeralDoRegistro(b, workflows.find((wf) => wf.iaRecordId === b.id));
      const aEval = statusA === "Em análise" || statusA === "Em teste" ? 2 : 0;
      const bEval = statusB === "Em análise" || statusB === "Em teste" ? 2 : 0;

      return bEval - aEval;
    }).
    slice(0, 5);
  }, [records, workflows]);

  const nextActions = useMemo(() => {
    const arr: any[] = [];

    workflows.forEach((wf) => {
      if (wf.finalStatus === "pendente") {
        const correspondingRecord = records.find((r) => r.id === wf.iaRecordId);
        if (
          correspondingRecord &&
          ["Em análise", "Em teste"].includes(obterStatusGeralDoRegistro(correspondingRecord, wf))
        ) {
          const currentStepItem = wf.steps?.find((s: any) => s.stepNumber === wf.currentStep);
          const roleAssigned = currentStepItem?.roleName || "Avaliador";

          arr.push({
            id: `wf-${wf.iaRecordId}`,
            type: "Fila de Aprovação",
            iaName: `${correspondingRecord.nomeFerramenta} (${roleAssigned})`,
            date: "Pendente",
            icon: <Clock size={16} className="painel__icone-clock" />,
            action: () => onNavigate("approval_queue")
          });
        }
      }
    });

    if (arr.length < 3) {
      arr.push({
        id: "act-inv",
        type: "Inventário Geral",
        iaName: "Mapear nova ferramenta integrada",
        date: "Rotina",
        icon: <PlusCircle size={16} className="painel__icone-pluscircle" />,
        action: () => onNavigate("new")
      });
      arr.push({
        id: "act-rev",
        type: "Conformidade LGPD",
        iaName: "Revisar uso de cookies e dados anônimos",
        date: "Semanal",
        icon: <Sparkles size={16} className="painel__icone-pluscircle" />,
        action: () => onNavigate("inventory")
      });
    }

    return arr.slice(0, 3);
  }, [workflows, records, onNavigate]);

  function onViewRecord(record: IARecord) {
    if (onView) {
      onView(record);
    } else {
      onNavigate("report");
    }
  }

  return (
    <div id="dashboard-conteudo" data-componente="pagina-dashboard" className="pagina-dashboard painel-conteiner cedro-page-premium">
      <div className="painel-indicadores painel__painel-indicadores-estrutura">
        <KPICard
          label="Total de IAs"
          value={stats.total}
          comparison="vs. 30 dias"
          icon={<Database size={16} />}
          accentColor="slate" />
        
        <KPICard
          label="Em andamento"
          value={stats.emAndamento}
          comparison="Aguardando parecer"
          icon={<Clock size={16} />}
          accentColor="orange" />
        
        <KPICard
          label="Aprovada"
          value={stats.aprovadas}
          comparison="Acesso autorizado"
          icon={<CheckCircle2 size={16} />}
          accentColor="green" />
        
        <KPICard
          label="Não aprovada"
          value={stats.naoAprovadas}
          comparison="Uso restrito"
          icon={<XCircle size={16} />}
          accentColor="red" />
        
      </div>

      <div className="painel-resumo painel__painel-resumo-estrutura">
        <div className="painel-cartao painel-grafico cedro-card-premium painel__painel-cartao-estrutura">
          <div className="painel__grupo-evolucao-do-inventario">
            <div className="painel__grupo-evolucao-do-inventario-crescim">
              <h2 className="painel__titulo-secao-evolucao-do-inventario">Evolução do inventário</h2>
              <p className="painel__descricao-crescimento-acumulado-das-ias-">Crescimento acumulado das IAs cadastradas</p>
            </div>
            <CustomDropdown
              value={period}
              onChange={(val) => setPeriod(val)}
              options={[
              { value: "30-days", label: "Últimos 30 dias" },
              { value: "90-days", label: "Últimos 90 dias" },
              { value: "180-days", label: "Histórico completo" }]
              }
              size="sm"
              className="painel__icone-customdropdown" />
            
          </div>

          <div className="painel__grupo">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evolutionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#075618" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#075618" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: "600" }} />
                
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: "600" }} />
                
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #f1f5f9",
                    borderRadius: "12px",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#1e293b"
                  }} />
                
                <Area
                  type="monotone"
                  dataKey="Total de IAs"
                  stroke="#075618"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorTotal)" />
                
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="painel-cartao painel-grafico-status cedro-card-premium painel__painel-cartao-estrutura-2">
          <div>
            <div className="painel__grupo-status-de-aprovacao">
              <h3 className="painel__titulo-bloco-status-de-aprovacao">Status de Aprovação</h3>
            </div>

            <div className="painel__grupo-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none">
                    
                    {donutData.map((entry, index) =>
                    <Cell key={`cell-${index}`} fill={entry.color} />
                    )}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #f1f5f9",
                      borderRadius: "8px",
                      fontSize: "11px",
                      fontWeight: "bold"
                    }} />
                  
                </PieChart>
              </ResponsiveContainer>
              <div className="painel__grupo-total">
                <span className="painel__texto">{stats.total}</span>
                <span className="painel__texto-total">Total</span>
              </div>
            </div>

            <div className="painel__grupo-3">
              {donutData.map((item, idx) => {
                const pct = stats.total ? Math.round(item.value / stats.total * 100) : 0;
                return (
                  <div key={idx} className="painel__grupo-4">
                    <span className="painel__texto-2">
                      <span className="painel__texto-3" style={{ backgroundColor: item.color }}></span>
                      {item.name}
                    </span>
                    <span className="painel__texto-4">{item.value} <span className="painel__texto-5">({pct}%)</span></span>
                  </div>);

              })}
            </div>
          </div>
        </div>
      </div>

      <div className="painel-resumo painel__painel-resumo-estrutura">
        <div className="painel__grupo-5">
          <TableCard
            title="Catalogo"
            records={priorityPedings}
            workflows={workflows}
            onNavigate={onNavigate}
            onViewRecord={(rec) => {
              onViewRecord(rec);
            }} />
          
        </div>

        <div className="painel__grupo-6">
          {isAdmin &&
          <ActionCard
            title="Próximas ações"
            actions={nextActions}
            onNavigate={onNavigate} />

          }
        </div>
      </div>
    </div>);

}
