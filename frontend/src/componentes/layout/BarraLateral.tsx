/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AbaAplicacao } from "@/constantes/navegacao";
import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  ClipboardList,
  LayoutDashboard,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
  ShieldAlert,
  ShieldCheck,
  User,
  UserCircle,
  Users,
  ChevronDown } from
"lucide-react";

import { UserProfile } from "@/tipos";
import MarcaCedroIA from "@/componentes/layout/MarcaCedroIA";
import type { NavegarPara } from "@/hooks/useAplicacao";
import { obterCargoPrincipal } from "@/utilitarios/perfil-usuario";

interface SidebarProps {
  isSidebarOpen?: boolean;
  setIsSidebarOpen?: (open: boolean) => void;
  isSidebarCollapsed?: boolean;
  setIsSidebarCollapsed?: (collapsed: boolean) => void;
  activeTab: AbaAplicacao;
  navegarPara: NavegarPara;
  profile?: UserProfile | null;
  isCurrentUserAdmin?: boolean;
  isCurrentUserPrivileged?: boolean;
  isAdmin?: boolean;
  recordsCount?: number;
  pendingCount?: number;
  pendingMyTurnCount?: number;
  unreadChatCount?: number;
}

type ItemMenuLateral = {
  id: AbaAplicacao;
  label: string;
  icon: React.ComponentType<{size?: number;className?: string;}>;
  badge: React.ReactNode | null;
  badgeTipo?: "padrao" | "alerta" | "novo";
  description: string;
  adminOnly?: boolean;
  privilegedOnly?: boolean;
};

export const Sidebar: React.FC<SidebarProps> = ({
  isSidebarOpen = true,
  setIsSidebarOpen,
  isSidebarCollapsed: externalCollapsed,
  setIsSidebarCollapsed: setExternalCollapsed,
  activeTab,
  navegarPara,
  profile,
  isCurrentUserAdmin = false,
  isCurrentUserPrivileged = false,
  isAdmin = false,
  recordsCount = 0,
  pendingCount = 0,
  unreadChatCount = 0
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = externalCollapsed !== undefined ? externalCollapsed : internalCollapsed;
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const visuallyCollapsed = collapsed && !isSidebarHovered;
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleCollapsed = () => {
    const nextState = !collapsed;
    if (setExternalCollapsed) setExternalCollapsed(nextState);else
    setInternalCollapsed(nextState);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleCollapsed();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [collapsed]);

  const toggleGroup = (title: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const admin = isCurrentUserAdmin || isAdmin;
  const privileged = isCurrentUserPrivileged || admin;

  const todosMenuItems: ItemMenuLateral[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    badge: null,
    description: "Visão geral de Minhas IAs e KPIs"
  },
  {
    id: "inventory",
    label: "Minhas IAs",
    icon: ClipboardList,
    badge: recordsCount > 0 ? recordsCount : null,
    description: "Catálogo completo de ferramentas IA"
  },
  {
    id: "approval_queue",
    label: "Aprovação de IAs",
    icon: ShieldCheck,
    privilegedOnly: true,
    badge: pendingCount > 0 ? pendingCount : null,
    badgeTipo: "alerta",
    description: "Fila de aprovação e governança"
  },
  {
    id: "sectors",
    label: "Mapa de IAs",
    icon: Users,
    adminOnly: true,
    badge: null,
    description: "Distribuição por áreas e setores"
  },
  {
    id: "sectors_mgr",
    label: "Setores",
    icon: Building2,
    adminOnly: true,
    badge: null,
    description: "Gerenciar estrutura organizacional"
  },
  {
    id: "admin",
    label: "Administração IA",
    icon: ShieldAlert,
    privilegedOnly: true,
    badge: null,
    description: "Configurações gerais e parâmetros"
  },
  {
    id: "new",
    label: "Nova Solicitação",
    icon: PlusCircle,
    badge: "Novo",
    badgeTipo: "novo",
    description: "Cadastrar nova solução de IA"
  },
  {
    id: "chat",
    label: "Chat",
    icon: MessageSquare,
    badge: unreadChatCount > 0 ? unreadChatCount : null,
                description: "Suporte com a equipe administrativa"
  },
  {
    id: "profile",
    label: "Meu Perfil",
    icon: UserCircle,
    badge: null,
    description: "Dados da sua conta e permissões"
  }];


  const menuItems = todosMenuItems.filter(
    (item) =>
    (!item.adminOnly || admin) && (
    !item.privilegedOnly || privileged)
  );

  const groupConfigs = [
  { title: "Minhas IAs e solicitações", itemIds: ["dashboard", "inventory", "new"] },
  {
    title: "Administração",
    itemIds: ["approval_queue", "sectors", "sectors_mgr", "admin"],
    show: admin || privileged
  },
  { title: "Auxiliares", itemIds: ["chat", "profile"] }];


  const sidebarGroups = groupConfigs.
  filter((group) => group.show === undefined || group.show).
  map((group) => ({
    title: group.title,
    items: group.itemIds.
    map((id) => menuItems.find((item) => item.id === id)).
    filter((item): item is ItemMenuLateral => Boolean(item))
  })).
  filter((group) => group.items.length > 0);

  return (
    <motion.aside
      id="cedro-barra-lateral"
      data-componente="barra-lateral"
      initial={false}
      animate={{
        width: visuallyCollapsed ? 84 : 288,
        marginRight: collapsed && isSidebarHovered ? -204 : 0,
        x: isSidebarOpen ? 0 : -288
      }}
      transition={{ type: "spring", stiffness: 350, damping: 34 }}
      onMouseEnter={() => setIsSidebarHovered(true)}
      onMouseLeave={() => setIsSidebarHovered(false)}
      className={`barra-lateral ${visuallyCollapsed ? "barra-lateral--recolhida" : "barra-lateral--expandida"} ${collapsed && isSidebarHovered ? "barra-lateral--expandida-hover" : ""}`}>
      
      <header className="barra-lateral__cabecalho">
        <div className="barra-lateral__cabecalho-conteudo">
          {!visuallyCollapsed ?
            <div className="barra-lateral__marca-expandida">
              
                <MarcaCedroIA contexto="escuro" textoClassName="marca-cedro__texto--grande" />
                {/* <button
                id="cedro-barra-lateral-recolher-topo"
                type="button"
                onClick={toggleCollapsed}
                className="botao-icone barra-lateral__botao-recolher-topo"
                title="Recolher menu (Ctrl+B)">
                
                  <PanelLeftClose size={20} />
                </button> */}
              </div> :

            <div className="barra-lateral__marca-recolhida">
                <img
                  src="/novalogo-interface.png"
                  alt="Laboratório Cedro"
                  width={48}
                  height={48}
                  decoding="async"
                  draggable={false}
                  className="barra-lateral__logo-recolhida"
                />
              </div>
          }
        </div>
      </header>

      <nav
        id="cedro-barra-lateral-navegacao"
        className="barra-lateral__navegacao rolagem-personalizada"
        aria-label="Navegação principal">
        
        {sidebarGroups.map((group, groupIndex) => {
          const groupCollapsed = Boolean(collapsedGroups[group.title]);

          return (
            <section
              key={group.title}
              className="barra-lateral__grupo"
              data-grupo={group.title}>
              
              {groupIndex > 0 && <div className="barra-lateral__separador" />}

              {!visuallyCollapsed &&
              <button
                type="button"
                className="barra-lateral__grupo-cabecalho"
                onClick={() => toggleGroup(group.title)}
                aria-expanded={!groupCollapsed}>
                
                  <span>{group.title}</span>
                  <motion.span animate={{ rotate: groupCollapsed ? -90 : 0 }}>
                    <ChevronDown size={13} />
                  </motion.span>
                </button>
              }

              <AnimatePresence initial={false}>
                {visuallyCollapsed || !groupCollapsed ?
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="barra-lateral__grupo-itens">
                  
                    {group.items.map((item) => {
                    const active = activeTab === item.id;
                    const Icon = item.icon;
                    const badgeModifier = item.badgeTipo ?
                    `barra-lateral__badge--${item.badgeTipo}` :
                    "";

                    return (
                      <div key={item.id} className="barra-lateral__item-container">
                          <button
                          id={`cedro-menu-${item.id}`}
                          data-pagina={item.id}
                          type="button"
                          onClick={() => {
                            navegarPara(item.id);
                            if (window.innerWidth < 768 && setIsSidebarOpen) setIsSidebarOpen(false);
                          }}
                          onMouseEnter={() => setHoveredItemId(item.id)}
                          onMouseLeave={() => setHoveredItemId(null)}
                          className={`barra-lateral__item ${active ? "barra-lateral__item--ativo" : ""} ${visuallyCollapsed ? "barra-lateral__item--recolhido" : ""}`}
                          aria-current={active ? "page" : undefined}>
                          
                            {active && <span className="barra-lateral__indicador-ativo" />}

                            <span className="barra-lateral__item-icone">
                              <Icon size={19} />
                            </span>

                            {!visuallyCollapsed &&
                          <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="barra-lateral__item-texto">
                            
                                {item.label}
                              </motion.span>
                          }

                            {!visuallyCollapsed && item.badge !== null && item.badge !== undefined &&
                          <span className={`barra-lateral__badge ${badgeModifier}`}>
                                {item.badge}
                              </span>
                          }

                            {visuallyCollapsed && item.badge !== null && item.badge !== undefined &&
                          <span className="barra-lateral__ponto-badge" />
                          }
                          </button>

                          <AnimatePresence>
                            {visuallyCollapsed && hoveredItemId === item.id &&
                          <motion.div
                            initial={{ opacity: 0, x: -4 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -4 }}
                            className="barra-lateral__tooltip">
                            
                                <div className="barra-lateral__tooltip-titulo">
                                  <span>{item.label}</span>
                                  {item.badge !== null && item.badge !== undefined &&
                              <span className={`barra-lateral__badge ${badgeModifier}`}>
                                      {item.badge}
                                    </span>
                              }
                                </div>
                                <p className="barra-lateral__tooltip-descricao">{item.description}</p>
                              </motion.div>
                          }
                          </AnimatePresence>
                        </div>);

                  })}
                  </motion.div> :
                null}
              </AnimatePresence>
            </section>);

        })}
      </nav>

      <footer className="barra-lateral__rodape">
        {/* <button
          id="cedro-barra-lateral-recolher"
          type="button"
          onClick={toggleCollapsed}
          className="barra-lateral__botao-recolher"
          title={visuallyCollapsed ? "Expandir menu lateral (Ctrl+B)" : "Recolher menu lateral (Ctrl+B)"}>
          
          <span className="barra-lateral__botao-recolher-conteudo">
            {visuallyCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            {!visuallyCollapsed && <span>Recolher Menu</span>}
          </span>
          {!visuallyCollapsed && <kbd className="barra-lateral__atalho">Ctrl+B</kbd>}
        </button> */}

        <button
          type="button"
          className={`barra-lateral__perfil ${visuallyCollapsed ? "barra-lateral__perfil--recolhido" : ""}`}
          onClick={() => navegarPara("profile")}
          title="Abrir meu perfil"
          aria-label="Abrir meu perfil">
          <div className="barra-lateral__avatar" title={profile?.full_name || "Usuário Cedro"}>
            {profile?.avatar_url ?
            <img
              src={profile.avatar_url}
              alt={profile?.full_name || "Foto do usuário"}
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }} /> :

            profile?.full_name ?
            <span>{profile.full_name.charAt(0).toUpperCase()}</span> :

            <User size={16} />
            }
          </div>

          {!visuallyCollapsed &&
          <div className="barra-lateral__perfil-texto">
              <span className="barra-lateral__perfil-nome">
                {profile?.full_name || "Usuário Cedro"}
              </span>
              <span className="barra-lateral__perfil-papel">
                {obterCargoPrincipal(profile?.cargo) || "Cargo não informado"}
              </span>
            </div>
          }
        </button>
      </footer>
    </motion.aside>);

};

export default Sidebar;
