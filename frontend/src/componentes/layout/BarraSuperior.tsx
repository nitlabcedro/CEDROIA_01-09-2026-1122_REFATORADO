/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Bell, UserCircle, ChevronDown, X, CheckCircle2, Eye, LogOut, ArrowRight } from "lucide-react";

import { UserProfile, IARecord } from "@/tipos";
import { SystemAlert, saveAlertInteraction } from "@/utilitarios/alertas";
import type { NavegarPara } from "@/hooks/useAplicacao";
import { obterCargoPrincipal, obterSetorPrincipal } from "@/utilitarios/perfil-usuario";

interface TopbarProps {
  profile: UserProfile | null;
  isCurrentUserAdmin: boolean;
  activeUnreadAlertsCount: number;
  navegarPara: NavegarPara;
  systemAlerts: SystemAlert[];
  triggerAlertsRefresh: () => void;
  records: IARecord[];
  signOut: () => Promise<void>;
}

export const Topbar: React.FC<TopbarProps> = ({
  profile,
  isCurrentUserAdmin,
  activeUnreadAlertsCount,
  navegarPara,
  systemAlerts,
  triggerAlertsRefresh,
  records,
  signOut
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [perfilAberto, setPerfilAberto] = useState(false);
  const alertasAtivos = systemAlerts.filter((alerta) => alerta.status === "Ativo");

  const classeNivelAlerta = (level: string) => {
    if (level === "CRÍTICO") return "barra-superior__alerta-nivel--critico";
    if (level === "ATENÇÃO") return "barra-superior__alerta-nivel--atencao";
    return "barra-superior__alerta-nivel--informativo";
  };

  return (
    <header id="cedro-barra-superior" data-componente="barra-superior" className="barra-superior">
      <div className="barra-superior__decoracao" aria-hidden="true">
        <svg fill="none" viewBox="0 0 1000 80" preserveAspectRatio="none">
          <line x1="0" y1="20" x2="100%" y2="20" stroke="currentColor" strokeDasharray="4 12" />
          <line x1="0" y1="60" x2="100%" y2="60" stroke="currentColor" strokeDasharray="1 15" />
          <path d="M 200 45 L 210 45 M 205 40 L 205 50" stroke="currentColor" strokeWidth="0.75" />
          <path d="M 40 40 L 120 40 L 140 20 L 300 20 L 315 35 L 450 35" stroke="currentColor" />
          <circle cx="120" cy="40" r="2.5" fill="currentColor" />
          <circle cx="300" cy="20" r="2.5" fill="currentColor" />
          <path d="M 950 45 L 820 45 L 800 20 L 700 20" stroke="currentColor" />
        </svg>
      </div>

      <div className="barra-superior__acoes">
        <div className="barra-superior__notificacoes">
          <button
            id="cedro-notificacoes-abrir"
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="botao-icone barra-superior__botao-notificacoes"
            title="Notificações"
            aria-expanded={isOpen}>
            
            <Bell size={18} />
            {activeUnreadAlertsCount > 0 &&
            <span className="barra-superior__indicador-notificacao" aria-hidden="true" />
            }
          </button>

          {isOpen &&
          <>
              <button
              type="button"
              aria-label="Fechar notificações"
              className="barra-superior__fechamento-popover"
              onClick={() => setIsOpen(false)} />
            

              <section id="cedro-notificacoes-painel" className="barra-superior__popover" aria-label="Notificações">
                <header className="barra-superior__popover-cabecalho">
                  <div className="barra-superior__popover-titulo">
                    <strong>Notificações</strong>
                    {activeUnreadAlertsCount > 0 &&
                  <span className="barra-superior__contador-notificacoes">
                        {activeUnreadAlertsCount} novas
                      </span>
                  }
                  </div>
                  <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="botao-icone barra-superior__botao-fechar-popover"
                  aria-label="Fechar notificações">
                  
                    <X size={14} />
                  </button>
                </header>

                <div className="barra-superior__lista-notificacoes rolagem-personalizada">
                  {alertasAtivos.length === 0 ?
                <div className="barra-superior__estado-vazio">
                      <div className="barra-superior__estado-vazio-icone">
                        <CheckCircle2 size={20} />
                      </div>
                      <p className="barra-superior__estado-vazio-titulo">Sem pendências</p>
                      <p className="barra-superior__estado-vazio-texto">
                        O ecossistema do laboratório Cedro está em conformidade.
                      </p>
                    </div> :

                alertasAtivos.map((alert) =>
                <article key={alert.id} className="barra-superior__alerta">
                        <div className="barra-superior__alerta-topo">
                          <div className="barra-superior__alerta-identificacao">
                            <div className="barra-superior__alerta-metadados">
                              <span className={`barra-superior__alerta-nivel ${classeNivelAlerta(alert.level)}`}>
                                {alert.level}
                              </span>
                              <span className="barra-superior__alerta-origem">{alert.source}</span>
                            </div>
                            <h4 className="barra-superior__alerta-titulo">{alert.title}</h4>
                          </div>

                          <button
                      type="button"
                      onClick={() => {
                        saveAlertInteraction(alert.id, "Lido");
                        triggerAlertsRefresh();
                      }}
                      className="barra-superior__alerta-lido"
                      title="Marcar como lido">
                      
                            Lido
                          </button>
                        </div>

                        <p className="barra-superior__alerta-descricao">{alert.desc}</p>

                        {alert.actionType === "open-ia" && alert.relatedRecordId &&
                  <button
                    type="button"
                    onClick={() => {
                      const matched = records.find((record) => record.id === alert.relatedRecordId);
                      if (!matched) return;
                      navegarPara("report", { registro: matched });
                      setIsOpen(false);
                    }}
                    className="barra-superior__alerta-acao">
                    
                            <Eye size={10} /> Abrir Solicitação de IA
                          </button>
                  }

                        {alert.actionType === "open-profile" &&
                  <button
                    type="button"
                    onClick={() => {
                      navegarPara("profile");
                      setIsOpen(false);
                    }}
                    className="barra-superior__alerta-acao">
                    
                            <UserCircle size={10} /> Meu Perfil
                          </button>
                  }
                      </article>
                )
                }
                </div>
              </section>
            </>
          }
        </div>

        <button
          id="cedro-barra-superior-perfil"
          type="button"
          onClick={() => setPerfilAberto((aberto) => !aberto)}
          className="barra-superior__perfil"
          title="Abrir resumo da conta"
          aria-expanded={perfilAberto}
          aria-haspopup="dialog">
          
          <span className="barra-superior__perfil-avatar">
            {profile?.avatar_url ?
            <img src={profile.avatar_url} alt={profile.full_name || "Perfil"} /> :

            <UserCircle size={22} />
            }
          </span>

          <span className="barra-superior__perfil-dados">
            <span className="barra-superior__perfil-linha">
              <span className="barra-superior__perfil-nome">
                {profile?.full_name || "Membro Cedro"}
              </span>
              {isCurrentUserAdmin && <span className="barra-superior__perfil-admin">ADMIN</span>}
            </span>
            <span className="barra-superior__perfil-cargo">
              {obterCargoPrincipal(profile?.cargo) || ""}
            </span>
          </span>

          <ChevronDown size={14} className="barra-superior__perfil-seta" />
        </button>

        {perfilAberto &&
        <>
          <button
            type="button"
            aria-label="Fechar resumo da conta"
            className="barra-superior__perfil-fechamento"
            onClick={() => setPerfilAberto(false)} />

          <section className="barra-superior__perfil-popover" aria-label="Resumo da conta">
            <div className="barra-superior__perfil-popover-identidade">
              <span className="barra-superior__perfil-popover-avatar">
                {profile?.avatar_url ?
                <img src={profile.avatar_url} alt={profile.full_name || "Foto do perfil"} /> :
                <UserCircle size={30} />
                }
              </span>
              <div>
                <strong>{profile?.full_name || "Membro Cedro"}</strong>
                <span>{obterCargoPrincipal(profile?.cargo) || "Cargo não informado"}</span>
              </div>
            </div>

            <dl className="barra-superior__perfil-popover-detalhes">
              <div>
                <dt>Cargo</dt>
                <dd>{obterCargoPrincipal(profile?.cargo) || "Não informado"}</dd>
              </div>
              <div>
                <dt>Setor</dt>
                <dd>{obterSetorPrincipal(profile?.setor) || "Não informado"}</dd>
              </div>
            </dl>

            <button
              type="button"
              className="barra-superior__perfil-popover-perfil"
              onClick={() => {
                navegarPara("profile");
                setPerfilAberto(false);
              }}>
              <span>Ver perfil</span>
              <ArrowRight size={15} />
            </button>
            <button
              type="button"
              className="barra-superior__perfil-popover-sair"
              onClick={() => signOut()}>
              <LogOut size={15} />
              <span>Sair da conta</span>
            </button>
          </section>
        </>
        }
      </div>
    </header>);

};

export default Topbar;
