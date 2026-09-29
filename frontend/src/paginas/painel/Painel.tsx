/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";
import {
  Database,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { IARecord } from "@/tipos";
import {
  KPICard,
  TableCard } from
"@/componentes/painel/ComponentesPainel";
import { AcessoRapido } from "@/componentes/painel/AcessoRapido";
import type { NavegarPara } from "@/hooks/useAplicacao";
import {
  obterStatusGeralDoRegistro,
  type StatusGeral,
} from "@/utilitarios/status-solicitacao";

interface DashboardProps {
  records: IARecord[];
  onNavigate: NavegarPara;
  onView?: (record: IARecord) => void;
  isAdmin?: boolean;
  isPrivileged?: boolean;
  workflows?: any[];
  approvalConfig?: any;
  currentUserId?: string;
}

export default function Dashboard({
  records,
  onNavigate,
  onView,
  isAdmin,
  isPrivileged,
  workflows = [],
  approvalConfig,
  currentUserId
}: DashboardProps) {

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
    const [{ default: ExcelJS }, { saveAs }] = await Promise.all([
      import("exceljs"),
      import("file-saver"),
    ]);
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Minhas IAs Cedro");

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
          icon={<Database size={16} />}
          accentColor="slate" />
        
        <KPICard
          label="Em andamento"
          value={stats.emAndamento}
          icon={<Clock size={16} />}
          accentColor="orange" />
        
        <KPICard
          label="Aprovadas"
          value={stats.aprovadas}
          icon={<CheckCircle2 size={16} />}
          accentColor="green" />
        
        <KPICard
          label="Não aprovadas"
          value={stats.naoAprovadas}
          icon={<XCircle size={16} />}
          accentColor="red" />
        
      </div>

      <div className="painel-resumo painel__painel-resumo-estrutura">
        <div className="painel-cartao painel-grafico cedro-card-premium painel__painel-cartao-estrutura">
          <div className="painel__grupo-evolucao-do-inventario">
            <div className="painel__grupo-evolucao-do-inventario-crescim">
              <div className="painel__evolucao-cabecalho-linha">
                <span className="painel__evolucao-icone" aria-hidden="true">
                  <TrendingUp size={18} strokeWidth={2.25} />
                </span>
                <div className="painel__evolucao-textos">
                  <h2 className="painel__titulo-secao-evolucao-do-inventario">Evolução do catálogo</h2>
                  <p className="painel__descricao-crescimento-acumulado-das-ias-">
                    Total acumulado de IAs cadastradas nos últimos seis meses
                  </p>
                </div>
              </div>
              <span className="painel__evolucao-periodo">Últimos 6 meses</span>
            </div>
          </div>

          <div className="painel__grupo painel__grupo--evolucao">
            {records.length === 0 ? (
              <div className="painel__estado-vazio-grafico">
                <span className="painel__estado-vazio-icone"><Database size={22} /></span>
                <strong>Ainda não há dados para exibir</strong>
                <p>A evolução será apresentada após o primeiro cadastro de IA.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={evolutionData}
                  margin={{ top: 14, right: 16, left: 2, bottom: 6 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0a7a24" stopOpacity={0.32} />
                      <stop offset="45%" stopColor="#075618" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="#075618" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="strokeTotal" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#034012" />
                      <stop offset="100%" stopColor="#1fa842" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="4 7"
                    stroke="#d8e6dc"
                    vertical={false} />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={{ stroke: "#e2ebe4", strokeWidth: 1 }}
                    tick={{ fill: "#5f7267", fontSize: 11, fontWeight: "650" }}
                    dy={6} />
                  <YAxis
                    allowDecimals={false}
                    width={34}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#5f7267", fontSize: 11, fontWeight: "650" }}
                    dx={-2} />
                  <Tooltip
                    cursor={{
                      stroke: "#075618",
                      strokeWidth: 1,
                      strokeDasharray: "5 5",
                      strokeOpacity: 0.45,
                    }}
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #c8dbd0",
                      borderRadius: "12px",
                      boxShadow: "0 12px 28px rgba(15, 45, 24, 0.12)",
                      fontSize: "12px",
                      fontWeight: "650",
                      color: "#1a3324",
                      padding: "10px 12px",
                    }}
                    labelStyle={{ color: "#5a6b60", fontWeight: "700", marginBottom: 4 }}
                    itemStyle={{ color: "#075618", fontWeight: "800" }} />
                  <Area
                    type="monotone"
                    dataKey="Total de IAs"
                    stroke="url(#strokeTotal)"
                    strokeWidth={3}
                    dot={{
                      r: 4,
                      fill: "#ffffff",
                      stroke: "#075618",
                      strokeWidth: 2.5,
                    }}
                    activeDot={{
                      r: 6,
                      fill: "#075618",
                      stroke: "#ffffff",
                      strokeWidth: 2.5,
                    }}
                    fillOpacity={1}
                    fill="url(#colorTotal)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="painel-cartao painel-grafico-status cedro-card-premium painel__painel-cartao-estrutura-2">
          <div className="painel__status-conteudo">
            <div className="painel__grupo-status-de-aprovacao">
              <div>
                <h3 className="painel__titulo-bloco-status-de-aprovacao">Status das aprovações</h3>
                <p className="painel__descricao-status">Distribuição atual do catálogo</p>
              </div>
            </div>

            {donutData.length === 0 ? (
              <div className="painel__estado-vazio-status">
                <span className="painel__estado-vazio-icone"><CheckCircle2 size={22} /></span>
                <strong>Nenhuma IA cadastrada</strong>
                <p>Os status aparecerão após o primeiro cadastro.</p>
              </div>
            ) : (
              <>
                <div className="painel__grupo-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={67}
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
                          border: "1px solid #dce7de",
                          borderRadius: "9px",
                          fontSize: "11px",
                          fontWeight: "bold"
                        }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="painel__grupo-total">
                    <span className="painel__texto">{stats.total}</span>
                    <span className="painel__texto-total">IAs</span>
                  </div>
                </div>

                <div className="painel__grupo-3">
                  {donutData.map((item, idx) => {
                    const pct = stats.total ? Math.round(item.value / stats.total * 100) : 0;
                    return (
                      <div
                        key={idx}
                        className="painel__grupo-4"
                        style={{ "--status-cor": item.color } as React.CSSProperties}>
                        <span className="painel__texto-2">
                          <span className="painel__texto-3" style={{ backgroundColor: item.color }}></span>
                          {item.name}
                        </span>
                        <span className="painel__texto-4">{item.value} <span className="painel__texto-5">{pct}%</span></span>
                      </div>);

                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="painel-resumo painel__painel-resumo-estrutura">
        <div className="painel__grupo-5">
          <TableCard
            variant="dashboard"
            title="Catálogo de IAs"
            subtitle="Principais IAs priorizadas para acompanhamento rápido"
            records={priorityPedings}
            workflows={workflows}
            onNavigate={onNavigate}
            onViewRecord={(rec) => {
              onViewRecord(rec);
            }} />
          
        </div>

        <div className="painel__grupo-6">
          <AcessoRapido
            navegarPara={onNavigate}
            isAdmin={Boolean(isAdmin)}
            isPrivileged={Boolean(isPrivileged)}
          />
        </div>
      </div>
    </div>);

}
