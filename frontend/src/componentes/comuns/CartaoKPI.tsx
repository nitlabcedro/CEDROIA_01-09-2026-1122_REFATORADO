/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface KPICardProps {
  label: string;
  value: number;
  comparison?: string;
  icon: React.ReactNode;
  accentColor: "green" | "orange" | "red" | "amber" | "slate";
}

export const KPICard: React.FC<KPICardProps> = ({ label, value, comparison, icon, accentColor }) => (
  <article className={`cartao-kpi cartao-kpi--${accentColor}`} data-componente="cartao-kpi">
    <div className="cartao-kpi__conteudo">
      <div className="cartao-kpi__informacoes">
        <p className="cartao-kpi__rotulo">{label}</p>
        <strong className="cartao-kpi__valor">{value.toString().padStart(2, "0")}</strong>
        {comparison && <p className="cartao-kpi__comparacao">{comparison}</p>}
      </div>
      <div className="cartao-kpi__icone">{icon}</div>
    </div>
  </article>
);
