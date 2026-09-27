import { TITULOS_ABAS, type AbaAplicacao } from "@/constantes/navegacao";
import { UserCircle } from "lucide-react";

import type { UserProfile } from "@/tipos";
import MarcaCedroIA from "@/componentes/layout/MarcaCedroIA";
import type { NavegarPara } from "@/hooks/useAplicacao";

interface MenuMobileProps {
  activeTab: AbaAplicacao;
  navegarPara: NavegarPara;
  profile?: UserProfile | null;
}

export default function MenuMobile({
  activeTab,
  navegarPara,
  profile,
}: MenuMobileProps) {
  return (
    <header id="cedro-menu-mobile" data-componente="menu-mobile" className="menu-mobile">
      <div className="menu-mobile__barra">
        <div className="menu-mobile__equilibrio" aria-hidden="true" />

        <div className="menu-mobile__marca">
          <MarcaCedroIA contexto="escuro" />
          <p className="menu-mobile__titulo-pagina">{TITULOS_ABAS[activeTab]}</p>
        </div>

        <button
          id="cedro-menu-mobile-perfil"
          type="button"
          onClick={() => navegarPara("profile")}
          className={`botao-icone menu-mobile__perfil-botao ${activeTab === "profile" ? "menu-mobile__perfil-botao--ativo" : ""}`}
          aria-label="Abrir meu perfil"
          aria-current={activeTab === "profile" ? "page" : undefined}>
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
  );
}
