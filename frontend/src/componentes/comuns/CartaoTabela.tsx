/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { ArrowRight, CheckCircle2, ChevronRight, LayoutGrid } from "lucide-react";
import { ApprovalWorkflow, IARecord } from "@/tipos";
import { StatusBadge } from "./IndicadoresStatus";
import { IconeIA } from "./IconeIA";
import { obterStatusGeralDoRegistro } from "@/utilitarios/status-solicitacao";
import type { NavegarPara } from "@/hooks/useAplicacao";

interface TableCardProps {
  title: string;
  subtitle?: string;
  records: IARecord[];
  workflows?: ApprovalWorkflow[];
  onNavigate: NavegarPara;
  onViewRecord: (record: IARecord) => void;
  variant?: "default" | "dashboard";
}

export const TableCard: React.FC<TableCardProps> = ({
  title,
  subtitle,
  records,
  workflows = [],
  onNavigate,
  onViewRecord,
  variant = "default",
}) => {
  const isDashboard = variant === "dashboard";
  const badgeRotulo =
    records.length === 0
      ? "Nenhuma IA"
      : records.length === 1
        ? "1 IA listada"
        : `${records.length} IAs listadas`;

  return (
  <article
    className={`cartao-tabela cedro-card-premium${isDashboard ? " cartao-tabela--dashboard" : ""}`}
    data-componente="cartao-tabela">
    <header
      className={`cartao-tabela__cabecalho${isDashboard ? " cartao-tabela__cabecalho--dashboard" : ""}`}>
      {isDashboard ? (
        <>
          <div className="cartao-tabela__cabecalho-principal">
            <div className="cartao-tabela__cabecalho-linha">
              <span className="cartao-tabela__icone-destaque" aria-hidden="true">
                <LayoutGrid size={18} strokeWidth={2.25} />
              </span>
              <div className="cartao-tabela__textos-destaque">
                <h3 className="cartao-tabela__titulo">{title}</h3>
                {subtitle && <p className="cartao-tabela__subtitulo">{subtitle}</p>}
              </div>
            </div>
            <div className="cartao-tabela__cabecalho-acoes">
              <span className="cartao-tabela__destaque-badge">{badgeRotulo}</span>
              <button type="button" onClick={() => onNavigate("inventory")} className="cartao-tabela__ver-todas">
                <span className="cartao-tabela__ver-todas-rotulo">Abrir catálogo</span>
                <span className="cartao-tabela__ver-todas-rotulo-mobile">Ver catálogo</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div>
            <h3 className="cartao-tabela__titulo">{title}</h3>
            {subtitle && <p className="cartao-tabela__subtitulo">{subtitle}</p>}
          </div>
          <button type="button" onClick={() => onNavigate("inventory")} className="cartao-tabela__ver-todas">
            <span className="cartao-tabela__ver-todas-rotulo">Abrir catálogo</span>
            <span className="cartao-tabela__ver-todas-rotulo-mobile">Ver catálogo</span>
            <ArrowRight size={13} />
          </button>
        </>
      )}
    </header>

    <div
      className={`cartao-tabela__conteudo rolagem-personalizada${isDashboard ? " cartao-tabela__conteudo--dashboard" : ""}`}>
      {records.length === 0 ? (
        <div className="cartao-tabela__vazio">
          <span className="cartao-tabela__vazio-icone"><CheckCircle2 size={24} /></span>
          <div>
            <strong>Seu catálogo está vazio</strong>
            <p>Cadastre uma solução de IA para acompanhar seus dados por aqui.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="cartao-tabela__lista-mobile">
            {records.map((record) => (
              <article key={record.id} className="cartao-tabela__item-mobile">
                <div className="cartao-tabela__item-mobile-topo">
                  <IconeIA nome={record.nomeFerramenta} tamanho={36} />
                  <span className="cartao-tabela__item-mobile-identidade">
                    <strong>{record.nomeFerramenta}</strong>
                    <small>{record.unidadeSetor || "Setor não informado"}</small>
                  </span>
                </div>
                <div className="cartao-tabela__item-mobile-rodape">
                  <StatusBadge status={obterStatusGeralDoRegistro(record, workflows.find((workflow) => workflow.iaRecordId === record.id))} />
                  <button type="button" onClick={() => onViewRecord(record)} className="cartao-tabela__analisar">
                    Analisar
                    <ChevronRight size={14} aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>

          <table className="cartao-tabela__tabela">
            <thead>
              <tr>
                <th>ID / Nome</th>
                <th>Setor</th>
                <th>Status</th>
                <th className="cartao-tabela__coluna-acoes">Ações</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>
                    <div className="cartao-tabela__identidade">
                      <IconeIA nome={record.nomeFerramenta} tamanho={34} />
                      <div className="cartao-tabela__identidade-texto">
                        <strong>{record.nomeFerramenta}</strong>
                        <small>{record.id}</small>
                      </div>
                    </div>
                  </td>
                  <td>{record.unidadeSetor}</td>
                  <td><StatusBadge status={obterStatusGeralDoRegistro(record, workflows.find((workflow) => workflow.iaRecordId === record.id))} /></td>
                  <td className="cartao-tabela__coluna-acoes">
                    <button type="button" onClick={() => onViewRecord(record)} className="cartao-tabela__analisar">Analisar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  </article>
  );
};
