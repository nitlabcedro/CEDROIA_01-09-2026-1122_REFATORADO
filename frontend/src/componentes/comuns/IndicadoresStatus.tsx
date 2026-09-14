/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { normalizar, obterVarianteStatus } from "@/utilitarios/status-solicitacao";

interface StatusBadgeProps { status: string; }

const resolverStatus = (status: string): { variante: string; label: string } => {
  const statusGeral = normalizar(status);
  const variante = obterVarianteStatus(statusGeral);
  return { variante, label: statusGeral };
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
