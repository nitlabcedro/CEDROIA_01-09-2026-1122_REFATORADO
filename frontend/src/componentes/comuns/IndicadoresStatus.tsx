/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface StatusBadgeProps { status: string; }
interface RiskBadgeProps { risk: string; }

type VarianteStatus = "aprovado" | "restricoes" | "avaliacao" | "teste" | "negado" | "suspenso" | "neutro";
type VarianteRisco = "baixo" | "medio" | "alto" | "critico" | "nao-avaliado";

const resolverStatus = (status: string): { variante: VarianteStatus; label: string } => {
  const normalized = status?.toLowerCase() || "";
  if (normalized.includes("aprovado") && !normalized.includes("restri")) return { variante: "aprovado", label: "Aprovado" };
  if (normalized.includes("restri")) return { variante: "restricoes", label: "Aprovado com Restrições" };
  if (normalized.includes("avalia") || normalized.includes("pendente")) return { variante: "avaliacao", label: "Em Avaliação" };
  if (normalized.includes("piloto") || normalized.includes("teste")) return { variante: "teste", label: "Piloto / Teste" };
  if (normalized.includes("suspens")) return { variante: "suspenso", label: "Suspenso" };
  if (normalized.includes("negado") || normalized.includes("não aprovado")) return { variante: "negado", label: "Não Aprovado" };
  return { variante: "neutro", label: status || "Não informado" };
};

const resolverRisco = (risk: string): { variante: VarianteRisco; label: string } => {
  const normalized = risk?.toLowerCase() || "";
  if (normalized.includes("baixo")) return { variante: "baixo", label: "Baixo Risco" };
  if (normalized.includes("medio") || normalized.includes("médio")) return { variante: "medio", label: "Médio Risco" };
  if (normalized.includes("critico") || normalized.includes("crítico")) return { variante: "critico", label: "Risco Crítico" };
  if (normalized.includes("alto")) return { variante: "alto", label: "Alto Risco" };
  return { variante: "nao-avaliado", label: "Não Avaliado" };
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const { variante, label } = resolverStatus(status);
  return (
    <span className={`indicador-status indicador-status--${variante}`}>
      <span className="indicador-status__ponto" />
      {label}
    </span>
  );
};

export const RiskBadge: React.FC<RiskBadgeProps> = ({ risk }) => {
  const { variante, label } = resolverRisco(risk);
  return <span className={`indicador-risco indicador-risco--${variante}`}>{label}</span>;
};
