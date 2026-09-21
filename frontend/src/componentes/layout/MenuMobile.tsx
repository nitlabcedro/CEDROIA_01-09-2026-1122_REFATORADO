import { TITULOS_ABAS, type AbaAplicacao } from "@/constantes/navegacao";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  ClipboardList,
  LayoutDashboard,
  Menu,
  MessageSquare,
  PlusCircle,
  ShieldAlert,
  ShieldCheck,
  UserCircle,
  Users,
  X } from
"lucide-react";
import type { LucideIcon } from "lucide-react";

import type { UserProfile } from "@/tipos";
import MarcaCedroIA from "@/componentes/layout/MarcaCedroIA";
import { obterCargoPrincipal, obterSetorPrincipal } from "@/utilitarios/perfil-usuario";
import type { NavegarPara } from "@/hooks/useAplicacao";

interface MenuMobileProps {
  activeTab: AbaAplicacao;
  navegarPara: NavegarPara;
  profile?: UserProfile | null;
  isCurrentUserAdmin: boolean;
  isCurrentUserPrivileged: boolean;
  unreadChatCount?: number;
}

interface ItemMenuMobile {
  id: AbaAplicacao;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  privilegedOnly?: boolean;
}

interface GrupoMenuMobile {
  titulo: string;
  itens: ItemMenuMobile[];
}

const grupos: GrupoMenuMobile[] = [
{
  titulo: "Principal",
  itens: [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "inventory", label: "Minhas IAs", icon: ClipboardList },
  { id: "new", label: "Nova Solicitação", icon: PlusCircle }]

},
{
  titulo: "Governança",
  itens: [
  { id: "approval_queue", label: "Aprovação de IAs", icon: ShieldCheck, privilegedOnly: true },
  { id: "sectors", label: "Mapa de IAs", icon: Users, adminOnly: true },
  { id: "sectors_mgr", label: "Setores", icon: Building2, adminOnly: true },
  { id: "admin", label: "Administração IA", icon: ShieldAlert, privilegedOnly: true }]

},
{
  titulo: "Auxiliares",
  itens: [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "profile", label: "Meu Perfil", icon: UserCircle }]

}];



export default function MenuMobile({
  activeTab,
  navegarPara,
  profile,
  isCurrentUserAdmin,
  isCurrentUserPrivileged,
  unreadChatCount = 0
}: MenuMobileProps) {
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const privileged = isCurrentUserPrivileged || isCurrentUserAdmin;

  useEffect(() => {
    if (!menuMobileAberto) return;

    const overflowAnterior = document.body.style.overflow;
    const fecharComEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuMobileAberto(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", fecharComEscape);

    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", fecharComEscape);
    };
  }, [menuMobileAberto]);

  const navegar = (tab: AbaAplicacao) => {
    navegarPara(tab);
    setMenuMobileAberto(false);
  };

  return (
    <>
      <header id="cedro-menu-mobile" data-componente="menu-mobile" className="menu-mobile">
        <div className="menu-mobile__barra">
          <button
            id="cedro-menu-mobile-abrir"
            type="button"
            onClick={() => setMenuMobileAberto(true)}
            className="botao-icone menu-mobile__botao"
            aria-label="Abrir menu de navegação"
            aria-expanded={menuMobileAberto}>
            
            <Menu size={23} />
          </button>

          <div className="menu-mobile__marca">
            <MarcaCedroIA contexto="escuro" />
            <p className="menu-mobile__titulo-pagina">{TITULOS_ABAS[activeTab]}</p>
          </div>

          <button
            id="cedro-menu-mobile-perfil"
            type="button"
            onClick={() => navegar("profile")}
            className={`botao-icone menu-mobile__perfil-botao ${activeTab === "profile" ? "menu-mobile__perfil-botao--ativo" : ""}`}
            aria-label="Abrir meu perfil">
            
            {profile?.avatar_url ?
            <img
              src={profile.avatar_url}
              alt={profile.full_name || "Usuário Cedro"}
              className="menu-mobile__perfil-imagem" /> :


            <UserCircle size={23} />
            }
          </button>
        </div>
      </header>

      <AnimatePresence>
        {menuMobileAberto &&
        <>
            <motion.button
            id="cedro-menu-mobile-sobreposicao"
            type="button"
            aria-label="Fechar menu"
            className="menu-mobile__sobreposicao"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMenuMobileAberto(false)} />
          

            <motion.aside
            id="cedro-menu-mobile-painel"
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navegação"
            className="menu-mobile__painel"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}>
            
              <div className="menu-mobile__painel-cabecalho">
                <div className="menu-mobile__painel-cabecalho-conteudo">
                  <MarcaCedroIA contexto="escuro" textoClassName="marca-cedro__texto--grande" />
                  <button
                  id="cedro-menu-mobile-fechar"
                  type="button"
                  onClick={() => setMenuMobileAberto(false)}
                  className="botao-icone menu-mobile__fechar"
                  aria-label="Fechar menu de navegação">
                  
                    <X size={22} />
                  </button>
                </div>
              </div>

              <nav className="menu-mobile__navegacao" aria-label="Navegação mobile">
                {grupos.map((grupo) => {
                const itensVisiveis = grupo.itens.filter(
                  (item) =>
                  (!item.adminOnly || isCurrentUserAdmin) && (
                  !item.privilegedOnly || privileged)
                );

                if (itensVisiveis.length === 0) return null;

                return (
                  <section className="menu-mobile__grupo" data-grupo={grupo.titulo} key={grupo.titulo}>
                      <h2 className="menu-mobile__grupo-titulo">{grupo.titulo}</h2>
                      <div className="menu-mobile__grupo-itens">
                        {itensVisiveis.map((item) => {
                        const Icone = item.icon;
                        const ativo = activeTab === item.id;

                        return (
                          <button
                            id={`cedro-menu-mobile-${item.id}`}
                            key={item.id}
                            data-pagina={item.id}
                            type="button"
                            onClick={() => navegar(item.id)}
                            aria-current={ativo ? "page" : undefined}
                            className={`menu-mobile__item ${ativo ? "menu-mobile__item--ativo" : ""}`}>
                            
                              <span className="menu-mobile__item-icone">
                                <Icone size={18} />
                              </span>
                              <span className="menu-mobile__item-texto">{item.label}</span>
                              {item.id === "chat" && unreadChatCount > 0 &&
                            <span className="menu-mobile__badge">
                                  {unreadChatCount > 99 ? "99+" : unreadChatCount}
                                </span>
                            }
                            </button>);

                      })}
                      </div>
                    </section>);

              })}
              </nav>

              <footer className="menu-mobile__usuario">
                <button
                id="cedro-menu-mobile-usuario"
                type="button"
                onClick={() => navegar("profile")}
                className="menu-mobile__usuario-botao">
                
                  <div className="menu-mobile__usuario-avatar">
                    {profile?.avatar_url ?
                  <img src={profile.avatar_url} alt={profile.full_name || "Usuário Cedro"} /> :

                  profile?.full_name?.charAt(0).toUpperCase() || <UserCircle size={22} />
                  }
                  </div>
                  <div className="menu-mobile__usuario-dados">
                    <p className="menu-mobile__usuario-nome">{profile?.full_name || "Usuário Cedro"}</p>
                    {obterCargoPrincipal(profile?.cargo) && (
                      <p className="menu-mobile__usuario-cargo">
                        {obterCargoPrincipal(profile?.cargo)}
                      </p>
                    )}
                    {obterSetorPrincipal(profile?.setor) && (
                      <p className="menu-mobile__usuario-setor">
                        {obterSetorPrincipal(profile?.setor)}
                      </p>
                    )}
                  </div>
                </button>
              </footer>
            </motion.aside>
          </>
        }
      </AnimatePresence>
    </>);

}
