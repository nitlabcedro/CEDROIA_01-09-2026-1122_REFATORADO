/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { CheckCircle2, ChevronRight } from "lucide-react";

export interface ActionItem {
  id: string;
  type: string;
  iaName: string;
  date: string;
  icon: React.ReactNode;
  action: () => void;
}

interface ActionCardProps {
  title: string;
  actions: ActionItem[];
  onNavigate: (tab: string) => void;
}

export const ActionCard: React.FC<ActionCardProps> = ({ title, actions, onNavigate }) => (
  <article className="cartao-acao cedro-card-premium" data-componente="cartao-acao">
    <div className="cartao-acao__conteudo">
      <header className="cartao-acao__cabecalho">
        <h3 className="cartao-acao__titulo">{title}</h3>
        <span className="cartao-acao__contador">{actions.length} ativas</span>
      </header>

      {actions.length === 0 ? (
        <div className="cartao-acao__vazio">
          <CheckCircle2 size={25} />
          <strong>Nenhuma ação pendente</strong>
          <p>Você está em dia com a governança.</p>
        </div>
      ) : (
        <div className="cartao-acao__lista">
          {actions.map((action) => (
            <button type="button" key={action.id} onClick={action.action} className="cartao-acao__item">
              <span className="cartao-acao__item-icone">{action.icon}</span>
              <span className="cartao-acao__item-conteudo">
                <span className="cartao-acao__item-meta">
                  <span>{action.type}</span>
                  <time>{action.date}</time>
                </span>
                <strong>{action.iaName}</strong>
              </span>
              <ChevronRight size={16} className="cartao-acao__item-seta" />
            </button>
          ))}
        </div>
      )}
    </div>

    <button type="button" onClick={() => onNavigate("approval_queue")} className="cartao-acao__rodape">
      Filas de Aprovação <ChevronRight size={14} />
    </button>
  </article>
);
