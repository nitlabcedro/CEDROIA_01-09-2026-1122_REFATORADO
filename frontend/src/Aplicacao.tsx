import { Suspense, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Info,
  MessageSquare,
  X } from
"lucide-react";

import { Sidebar } from "@/componentes/layout/BarraLateral";
import { Topbar } from "@/componentes/layout/BarraSuperior";
import MenuMobile from "@/componentes/layout/MenuMobile";
import FundoLaboratorio from "@/componentes/fundo/FundoLaboratorio";
import CarregamentoPagina from "@/componentes/comuns/CarregamentoPagina";
import { useAplicacao } from "@/hooks/useAplicacao";
import {
  Autenticacao,
  Chat,
  FormularioCadastro,
  GerenciadorSetores,
  Inventario,
  MapaSetores,
  PaginaAprovacao,
  Painel,
  PainelAdministrativo,
  PerfilUsuario,
  RedefinirSenha,
  VisualizacaoRelatorio,
} from "@/paginas/lazyPaginas";
import NotificacaoPerguntasTI from "@/componentes/aprovacoes/NotificacaoPerguntasTI";
import NotificacaoRespostaTI from "@/componentes/aprovacoes/NotificacaoRespostaTI";
import {
  atualizarMensagemTransitoriaLogin,
  decidirTelaAplicacao,
} from "@/utilitarios/recuperacao-senha";

export default function Aplicacao() {
  const {
    user,
    profile,
    authLoading,
    recuperacaoSenhaEmAndamento,
    isCurrentUserAdmin,
    isCurrentUserPrivileged,
    activeTab,
    navegarPara,
    records,
    workflows,
    workflowSummaries,
    approvalConfig,
    profiles,
    profilesCatalog,
    supabaseStatus,
    selectedRecord,
    originTab,
    isSidebarOpen,
    setIsSidebarOpen,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    isDarkMode,
    triggerAlertsRefresh,
    systemAlerts,
    activeUnreadAlertsCount,
    unreadChatCount,
    toasts,
    removeToast,
    handleEdit,
    handleView,
    handleDelete,
    handleCancelRequest,
    handleSave,
    handleSaveApprovalConfig,
    handleUpdateStatus,
    handleResetStatus,
    handleUpdateUserAssignments,
    handleUpdateUserRole,
    handleDeleteUser,
    refreshRecords,
    signOut
  } = useAplicacao();
  const [isDesktopViewport, setIsDesktopViewport] = useState(() =>
  window.matchMedia("(min-width: 1024px)").matches
  );
  const [mensagemLogin, setMensagemLogin] = useState<string | null>(null);
  const [, forcarRenderAutenticacao] = useState(0);
  const telaAplicacao = decidirTelaAplicacao({
    carregando: authLoading,
    temUsuario: Boolean(user),
    recuperacaoAtiva: recuperacaoSenhaEmAndamento,
    pathname: window.location.pathname,
  });
  const mobileContentRef = useRef<HTMLElement | null>(null);
  const desktopContentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const atualizarViewport = (event: MediaQueryListEvent) => {
      setIsDesktopViewport(event.matches);
    };

    setIsDesktopViewport(mediaQuery.matches);
    mediaQuery.addEventListener("change", atualizarViewport);

    return () => mediaQuery.removeEventListener("change", atualizarViewport);
  }, []);

  useEffect(() => {
    const resetarPosicao = () => {
      mobileContentRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
      desktopContentRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };

    const frame = window.requestAnimationFrame(resetarPosicao);
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab]);

  if (
    telaAplicacao === "redefinir-senha"
    || telaAplicacao === "redefinir-senha-invalida"
  ) {
    return (
      <div className={isDarkMode ? "dark" : ""}>
        <Suspense fallback={<CarregamentoPagina variante="tela-cheia" />}>
          <RedefinirSenha
            onConcluida={(mensagem) => setMensagemLogin((atual) =>
              atualizarMensagemTransitoriaLogin(atual, {
                tipo: "redefinicao-concluida",
                mensagem,
              })
            )}
            onRetornarLogin={() => forcarRenderAutenticacao((versao) => versao + 1)}
          />
        </Suspense>
      </div>);

  }

  if (telaAplicacao === "carregando") {
    return <CarregamentoPagina variante="tela-cheia" />;

  }

  if (telaAplicacao === "login") {
    return (
      <div className={isDarkMode ? "dark" : ""}>
        <Suspense fallback={<CarregamentoPagina variante="tela-cheia" />}>
          <Autenticacao
            mensagemInicial={mensagemLogin}
            onAuthSuccess={() => setMensagemLogin((atual) =>
              atualizarMensagemTransitoriaLogin(atual, {
                tipo: "login-normal-concluido",
              })
            )}
          />
        </Suspense>
      </div>);

  }

  const renderConteudoAtivo = () =>
  <Suspense fallback={<CarregamentoPagina />}>
  <>
      {activeTab === "dashboard" &&
    <Painel records={records} onNavigate={navegarPara} onView={handleView} isAdmin={isCurrentUserAdmin} isPrivileged={isCurrentUserPrivileged} workflows={workflows} approvalConfig={approvalConfig} currentUserId={user.id} />
    }
      {activeTab === "inventory" &&
    <Inventario
      records={records}
      onEdit={handleEdit}
      onView={handleView}
      onAdd={() => {
        navegarPara("new");
      }}
      onRefresh={refreshRecords}
      approvalConfig={approvalConfig}
      onSaveApprovalConfig={handleSaveApprovalConfig}
      isAdmin={isCurrentUserAdmin}
      workflows={workflowSummaries}
      currentUser={user}
      currentUserProfile={profile}
      onCancelRequest={handleCancelRequest} />

    }
      {activeTab === "sectors" && isCurrentUserAdmin &&
    <MapaSetores records={records} profiles={profiles} workflows={workflows} />
    }
      {activeTab === "sectors_mgr" && isCurrentUserAdmin &&
    <GerenciadorSetores records={records} profiles={profiles} onRefresh={refreshRecords} approvalConfig={approvalConfig} onSaveApprovalConfig={handleSaveApprovalConfig} />
    }
      {activeTab === "approval_queue" && isCurrentUserPrivileged &&
    <PaginaAprovacao
      records={records}
      profiles={profiles}
      workflows={workflows}
      approvalConfig={approvalConfig}
      currentUserId={user.id}
      onUpdateStatus={handleUpdateStatus}
      onSaveApprovalConfig={handleSaveApprovalConfig}
      onViewRecord={handleView}
      isAdmin={isCurrentUserAdmin} />

    }
      {activeTab === "admin" && isCurrentUserPrivileged &&
    <PainelAdministrativo
      records={records}
      profiles={profiles}
      onUpdateStatus={handleUpdateStatus}
      onViewRecord={handleView}
      onEditRecord={handleEdit}
      onDeleteRecord={handleDelete}
      onUpdateUserAssignments={handleUpdateUserAssignments}
      onUpdateUserRole={handleUpdateUserRole}
      onDeleteUser={handleDeleteUser}
      approvalConfig={approvalConfig}
      onSaveApprovalConfig={handleSaveApprovalConfig}
      currentUserId={user.id}
      workflows={workflows}
      supabaseStatus={supabaseStatus}
      onResetStatus={handleResetStatus}
      onNavigate={navegarPara} />

    }
      {activeTab === "new" &&
    <FormularioCadastro
      initialData={selectedRecord}
      onSave={handleSave}
      onCancel={() => navegarPara("inventory")}
      isAdmin={isCurrentUserAdmin} />

    }
      {activeTab === "report" && (
    selectedRecord ?
    <VisualizacaoRelatorio
      record={selectedRecord}
      onBack={() => {
        if (originTab && originTab !== "report") {
          navegarPara(originTab);
        } else {
          navegarPara("inventory");
        }
      }}
      onEdit={handleEdit}
      isAdmin={isCurrentUserAdmin}
      workflows={workflows}
      approvalConfig={approvalConfig} /> :


    <Inventario
      records={records}
      onEdit={handleEdit}
      onView={handleView}
      onAdd={() => {
        navegarPara("new");
      }}
      onRefresh={refreshRecords}
      approvalConfig={approvalConfig}
      onSaveApprovalConfig={handleSaveApprovalConfig}
      isAdmin={isCurrentUserAdmin}
      workflows={workflowSummaries}
      currentUser={user}
      currentUserProfile={profile}
      onCancelRequest={handleCancelRequest} />)


    }
      {activeTab === "chat" && <Chat catalogProfiles={profilesCatalog} />}
      {activeTab === "profile" && <PerfilUsuario />}
    </>
  </Suspense>;


  return (
    <div id="cedro-aplicacao" data-componente="aplicacao" className={`aplicacao ${isDarkMode ? "dark" : ""}`}>
      <FundoLaboratorio />

      {/* VERSÃO MOBILE DO CEDRO IA MONITOR */}
      {!isDesktopViewport &&
      <div id="cedro-estrutura-mobile" className="aplicacao__estrutura-mobile">
        <MenuMobile
          activeTab={activeTab}
          navegarPara={navegarPara}
          profile={profile}
          isCurrentUserAdmin={isCurrentUserAdmin}
          isCurrentUserPrivileged={isCurrentUserPrivileged}
          unreadChatCount={unreadChatCount} />
        

        {/* 2. CONTEÚDO */}
        <main
          ref={mobileContentRef}
          id="cedro-conteudo-principal-mobile"
          className={`aplicacao__conteudo-mobile ${
          activeTab === "chat" ?
          "aplicacao__conteudo-mobile--chat" :
          "aplicacao__conteudo-mobile--pagina mobile-safe-bottom"}`
          }>
          
          <div
            id={`pagina-${activeTab}`}
            className={`pagina aplicacao__pagina-mobile ${
            activeTab === "chat" ? "pagina--chat aplicacao__pagina-mobile--chat" : "aplicacao__pagina-mobile--padrao"}`
            }
            data-pagina={activeTab}
            key={activeTab}>
            
            {renderConteudoAtivo()}
          </div>
        </main>
      </div>
      }

      {/* VERSÃO DESKTOP COMPLETA DO CEDRO IA MONITOR */}
      {isDesktopViewport &&
      <div id="cedro-estrutura-desktop" className="aplicacao__estrutura-desktop">

      <Sidebar
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          isSidebarCollapsed={isSidebarCollapsed}
          setIsSidebarCollapsed={setIsSidebarCollapsed}
          activeTab={activeTab}
          navegarPara={navegarPara}
          profile={profile}
          isCurrentUserAdmin={isCurrentUserAdmin}
          isCurrentUserPrivileged={isCurrentUserPrivileged}
          unreadChatCount={unreadChatCount} />
        

      {/* Main Content Area */}
      <main id="cedro-conteudo-principal-desktop" className="aplicacao__conteudo-desktop">
        <Topbar
            profile={profile}
            isCurrentUserAdmin={isCurrentUserAdmin}
            activeUnreadAlertsCount={activeUnreadAlertsCount}
            navegarPara={navegarPara}
            systemAlerts={systemAlerts}
            triggerAlertsRefresh={triggerAlertsRefresh}
            records={records}
            signOut={signOut} />
          

        <div
            ref={desktopContentRef}
            className={`aplicacao__area-pagina rolagem-personalizada ${activeTab === "chat" ? "aplicacao__area-pagina--chat" : ""}`}>
            

          <div
              key={activeTab}
              data-pagina={activeTab}
              id={`pagina-${activeTab}`}
              className={`pagina aplicacao__pagina-desktop ${
              activeTab === "chat" ? "pagina--chat aplicacao__pagina-desktop--chat" : ""}`
              }>
              
              {renderConteudoAtivo()}
          </div>
        </div>
      </main>
    </div>
      }

      {/* Pendência persistente de perguntas da Etapa 2 — TI */}
      <NotificacaoPerguntasTI currentUserId={user.id} />
      <NotificacaoRespostaTI currentUserId={user.id} />

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {/* Removed redundant delete modal as it's handled by components */}
      </AnimatePresence>

      {/* Notificações da aplicação */}
      <div className="aplicacao__notificacoes">
        <AnimatePresence>
          {toasts.map((toast) => {
            const configuracao = toast.type === "success"
              ? { icone: CheckCircle2, rotulo: "Sucesso", variante: "sucesso" }
              : toast.type === "error"
                ? { icone: CircleAlert, rotulo: "Erro", variante: "erro" }
              : toast.type === "warning"
                ? { icone: AlertTriangle, rotulo: "Aviso / Alerta", variante: "aviso" }
                : toast.type === "chat"
                  ? { icone: MessageSquare, rotulo: "Mensagem Chat", variante: "chat" }
                  : { icone: Info, rotulo: "Sistema", variante: "informacao" };
            const IconComponent = configuracao.icone;

            return (
              <motion.article
                key={toast.id}
                initial={{ scale: 0.97, opacity: 0, y: 24 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0, x: 36 }}
                transition={{ type: "spring", stiffness: 330, damping: 30 }}
                className={`aplicacao-toast aplicacao-toast--${configuracao.variante}`}
                role={toast.type === "error" ? "alert" : "status"}
                aria-live={toast.type === "error" ? "assertive" : "polite"}
              >
                <span className="aplicacao-toast__acento" />
                <span className="aplicacao-toast__icone"><IconComponent size={20} /></span>

                <div className="aplicacao-toast__conteudo">
                  <div className="aplicacao-toast__cabecalho">
                    <div>
                      <span className="aplicacao-toast__tipo">{configuracao.rotulo}</span>
                      <h4 className="aplicacao-toast__titulo">{toast.title}</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeToast(toast.id)}
                      className="aplicacao-toast__fechar"
                      title="Fechar"
                      aria-label="Fechar notificação"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <p className="aplicacao-toast__mensagem">{toast.message}</p>

                  {toast.actionLabel && toast.onAction && (
                    <div className="aplicacao-toast__acoes">
                      <button
                        type="button"
                        onClick={() => {
                          toast.onAction?.();
                          removeToast(toast.id);
                        }}
                        className="aplicacao-toast__acao"
                      >
                        {toast.actionLabel}
                      </button>
                    </div>
                  )}
                </div>

                <span className="aplicacao-toast__progresso">
                  <motion.span
                    initial={{ width: "100%" }}
                    animate={{ width: "0%" }}
                    transition={{ duration: 6, ease: "linear" }}
                  />
                </span>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>
    </div>);

}
