import { useState } from "react";
import {
  ClipboardList,
  LayoutDashboard,
  MessageSquare,
  MoreHorizontal,
  PlusCircle,
  ShieldCheck,
} from "lucide-react";

import {
  acaoCentralAtiva,
  obterAcaoCentral,
  obterItensPainelMais,
  painelMaisAtivo,
} from "@/constantes/navegacao-mobile";
import type { AbaAplicacao } from "@/constantes/navegacao";
import type { NavegarPara } from "@/hooks/useAplicacao";
import PainelMaisMobile from "@/componentes/layout/PainelMaisMobile";

interface NavegacaoInferiorMobileProps {
  activeTab: AbaAplicacao;
  navegarPara: NavegarPara;
  isCurrentUserAdmin: boolean;
  isCurrentUserPrivileged: boolean;
  pendingMyTurnCount?: number;
  unreadChatCount?: number;
}

export default function NavegacaoInferiorMobile({
  activeTab,
  navegarPara,
  isCurrentUserAdmin,
  isCurrentUserPrivileged,
  pendingMyTurnCount = 0,
  unreadChatCount = 0,
}: NavegacaoInferiorMobileProps) {
  const [maisAberto, setMaisAberto] = useState(false);
  const acaoCentral = obterAcaoCentral(isCurrentUserPrivileged);
  const itensMais = obterItensPainelMais(isCurrentUserAdmin, isCurrentUserPrivileged);
  const centralAtiva = acaoCentralAtiva(activeTab, isCurrentUserPrivileged);
  const maisAtivo = painelMaisAtivo(activeTab, isCurrentUserPrivileged);
  const IconeCentral = acaoCentral.aba === "approval_queue" ? ShieldCheck : PlusCircle;
  const mostrarPontoAprovacao =
    acaoCentral.aba === "approval_queue" && pendingMyTurnCount > 0;
  const seloChat = unreadChatCount > 99 ? "99+" : unreadChatCount;

  const irPara = (aba: AbaAplicacao) => {
    setMaisAberto(false);
    navegarPara(aba);
  };

  return (
    <>
      <nav
        id="cedro-navegacao-inferior"
        className="navegacao-inferior-mobile"
        aria-label="Navegação principal"
      >
        <button
          type="button"
          className={`navegacao-inferior-mobile__item ${activeTab === "dashboard" ? "navegacao-inferior-mobile__item--ativo" : ""}`}
          aria-label="Dashboard"
          aria-current={activeTab === "dashboard" ? "page" : undefined}
          onClick={() => irPara("dashboard")}
        >
          <LayoutDashboard size={22} />
          <span className="navegacao-inferior-mobile__rotulo">Dashboard</span>
          <span className="navegacao-inferior-mobile__indicador" aria-hidden="true" />
        </button>

        <button
          type="button"
          className={`navegacao-inferior-mobile__item ${activeTab === "inventory" ? "navegacao-inferior-mobile__item--ativo" : ""}`}
          aria-label="Minhas IAs"
          aria-current={activeTab === "inventory" ? "page" : undefined}
          onClick={() => irPara("inventory")}
        >
          <ClipboardList size={22} />
          <span className="navegacao-inferior-mobile__rotulo">Minhas IAs</span>
          <span className="navegacao-inferior-mobile__indicador" aria-hidden="true" />
        </button>

        <button
          type="button"
          className="navegacao-inferior-mobile__item navegacao-inferior-mobile__item--central"
          aria-label={
            mostrarPontoAprovacao
              ? `${acaoCentral.rotulo}, há solicitações na sua etapa`
              : acaoCentral.rotulo
          }
          aria-current={centralAtiva ? "page" : undefined}
          onClick={() => irPara(acaoCentral.aba)}
        >
          <span
            className={`navegacao-inferior-mobile__central-botao ${centralAtiva ? "navegacao-inferior-mobile__central-botao--ativo" : ""}`}
            aria-hidden="true"
          >
            <IconeCentral size={26} />
            {mostrarPontoAprovacao && (
              <span className="navegacao-inferior-mobile__ponto-aprovacao" />
            )}
          </span>
          <span
            className={`navegacao-inferior-mobile__rotulo ${centralAtiva ? "navegacao-inferior-mobile__rotulo--ativo" : ""}`}
          >
            {acaoCentral.rotulo}
          </span>
          <span className="navegacao-inferior-mobile__indicador" aria-hidden="true" />
        </button>

        <button
          type="button"
          className={`navegacao-inferior-mobile__item ${activeTab === "chat" ? "navegacao-inferior-mobile__item--ativo" : ""}`}
          aria-label={unreadChatCount > 0 ? `Chat, ${unreadChatCount} não lidas` : "Chat"}
          aria-current={activeTab === "chat" ? "page" : undefined}
          onClick={() => irPara("chat")}
        >
          <span className="navegacao-inferior-mobile__icone-chat">
            <MessageSquare size={22} />
            {unreadChatCount > 0 && (
              <span className="navegacao-inferior-mobile__selo">{seloChat}</span>
            )}
          </span>
          <span className="navegacao-inferior-mobile__rotulo">Chat</span>
          <span className="navegacao-inferior-mobile__indicador" aria-hidden="true" />
        </button>

        <button
          type="button"
          className={`navegacao-inferior-mobile__item ${maisAtivo ? "navegacao-inferior-mobile__item--ativo" : ""}`}
          aria-label="Mais"
          aria-expanded={maisAberto}
          aria-controls="cedro-painel-mais"
          aria-current={maisAtivo ? "page" : undefined}
          onClick={() => setMaisAberto((aberto) => !aberto)}
        >
          <MoreHorizontal size={22} />
          <span className="navegacao-inferior-mobile__rotulo">Mais</span>
          <span className="navegacao-inferior-mobile__indicador" aria-hidden="true" />
        </button>
      </nav>

      <PainelMaisMobile
        aberto={maisAberto}
        abaAtiva={activeTab}
        itens={itensMais}
        onFechar={() => setMaisAberto(false)}
        navegarPara={navegarPara}
      />
    </>
  );
}
