/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { ArrowRight, Bell, CheckCircle2 } from "lucide-react";

export interface AlertItem {
  id: string;
  title: string;
  description: string;
  time: string;
  level: "high" | "medium" | "low";
}

interface AlertCardProps {
  title: string;
  alerts: AlertItem[];
  onNavigate: (tab: string) => void;
}

export const AlertCard: React.FC<AlertCardProps> = ({ title, alerts, onNavigate }) => (
  <article className="cartao-alerta cedro-card-premium" data-componente="cartao-alerta">
    <div className="cartao-alerta__conteudo">
      <header className="cartao-alerta__cabecalho">
        <h3 className="cartao-alerta__titulo"><Bell size={15} /> {title}</h3>
        <span className="cartao-alerta__tempo-real">Tempo real</span>
      </header>

      {alerts.length === 0 ? (
        <div className="cartao-alerta__vazio">
          <span className="cartao-alerta__vazio-icone"><CheckCircle2 size={21} /></span>
          <strong>Sem alertas críticos</strong>
          <p>O monitoramento não detectou desvios.</p>
        </div>
      ) : (
        <div className="cartao-alerta__lista">
          {alerts.map((alerta) => (
            <div key={alerta.id} className={`cartao-alerta__item cartao-alerta__item--${alerta.level}`}>
              <div className="cartao-alerta__item-cabecalho">
                <span className="cartao-alerta__item-titulo">
                  <span className="cartao-alerta__ponto" />
                  {alerta.title}
                </span>
                <time className="cartao-alerta__horario">{alerta.time}</time>
              </div>
              <p className="cartao-alerta__descricao">{alerta.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>

    <button type="button" onClick={() => onNavigate("inventory")} className="cartao-alerta__acao">
      Ver Minhas IAs <ArrowRight size={14} />
    </button>
  </article>
);
