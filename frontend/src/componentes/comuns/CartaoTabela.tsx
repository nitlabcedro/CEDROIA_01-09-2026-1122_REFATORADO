/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { ArrowRight, CheckCircle2, ChevronRight } from "lucide-react";
import { IARecord } from "@/tipos";
import { RiskBadge, StatusBadge } from "./IndicadoresStatus";

interface TableCardProps {
  title: string;
  subtitle?: string;
  records: IARecord[];
  onNavigate: (tab: string) => void;
  onViewRecord: (record: IARecord) => void;
}

export const TableCard: React.FC<TableCardProps> = ({ title, subtitle, records, onNavigate, onViewRecord }) => (
  <article className="cartao-tabela cedro-card-premium" data-componente="cartao-tabela">
    <header className="cartao-tabela__cabecalho">
      <div>
        <h3 className="cartao-tabela__titulo">{title}</h3>
        {subtitle && <p className="cartao-tabela__subtitulo">{subtitle}</p>}
      </div>
      <button type="button" onClick={() => onNavigate("inventory")} className="cartao-tabela__ver-todas">
        Ver todas <ArrowRight size={13} />
      </button>
    </header>

    <div className="cartao-tabela__conteudo rolagem-personalizada">
      {records.length === 0 ? (
        <div className="cartao-tabela__vazio">
          <span className="cartao-tabela__vazio-icone"><CheckCircle2 size={24} /></span>
          <div>
            <strong>Tudo em conformidade</strong>
            <p>Nenhuma pendência prioritária aguardando ação.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="cartao-tabela__lista-mobile">
            {records.map((record) => (
              <button type="button" key={record.id} onClick={() => onViewRecord(record)} className="cartao-tabela__item-mobile">
                <span className="cartao-tabela__sigla">{(record.nomeFerramenta || "IA").slice(0, 2)}</span>
                <span className="cartao-tabela__item-mobile-conteudo">
                  <span className="cartao-tabela__item-mobile-cabecalho">
                    <span>
                      <strong>{record.nomeFerramenta}</strong>
                      <small>{record.unidadeSetor || "Setor não informado"}</small>
                    </span>
                    <ChevronRight size={18} />
                  </span>
                  <span className="cartao-tabela__indicadores">
                    <StatusBadge status={record.statusUso} />
                    <RiskBadge risk={record.criticidade || "Não avaliado"} />
                  </span>
                  <span className="cartao-tabela__item-mobile-rodape"><small>{record.id}</small><strong>Analisar</strong></span>
                </span>
              </button>
            ))}
          </div>

          <table className="cartao-tabela__tabela">
            <thead>
              <tr>
                <th>ID / Nome</th>
                <th>Setor</th>
                <th>Risco</th>
                <th>Status</th>
                <th className="cartao-tabela__coluna-acoes">Ações</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td><strong>{record.nomeFerramenta}</strong><small>{record.id}</small></td>
                  <td>{record.unidadeSetor}</td>
                  <td><RiskBadge risk={record.criticidade || "Não avaliado"} /></td>
                  <td><StatusBadge status={record.statusUso} /></td>
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
