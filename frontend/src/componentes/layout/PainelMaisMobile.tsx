import { useEffect, useId, useState } from "react";
import {
  Building2,
  PlusCircle,
  ShieldAlert,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { TITULOS_ABAS } from "@/constantes/navegacao";
import type { AbaPainelMais } from "@/constantes/navegacao-mobile";
import type { NavegarPara } from "@/hooks/useAplicacao";

const ICONES_MAIS: Record<AbaPainelMais, LucideIcon> = {
  new: PlusCircle,
  sectors: Users,
  sectors_mgr: Building2,
  admin: ShieldAlert,
  profile: UserCircle,
};

interface PainelMaisMobileProps {
  aberto: boolean;
  abaAtiva: string;
  itens: AbaPainelMais[];
  onFechar: () => void;
  navegarPara: NavegarPara;
}

export default function PainelMaisMobile({
  aberto,
  abaAtiva,
  itens,
  onFechar,
  navegarPara,
}: PainelMaisMobileProps) {
  const tituloId = useId();
  const [presente, setPresente] = useState(aberto);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (aberto) {
      setPresente(true);
      const quadro = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setVisivel(true));
      });
      return () => window.cancelAnimationFrame(quadro);
    }

    setVisivel(false);
    const timer = window.setTimeout(() => setPresente(false), 220);
    return () => window.clearTimeout(timer);
  }, [aberto]);

  useEffect(() => {
    if (!presente) return;

    const overflowAnterior = document.body.style.overflow;
    const fecharComEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onFechar();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", fecharComEscape);

    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", fecharComEscape);
    };
  }, [onFechar, presente]);

  if (!presente) return null;

  const selecionar = (aba: AbaPainelMais) => {
    onFechar();
    navegarPara(aba);
  };

  return (
    <div className={`painel-mais-mobile ${visivel ? "painel-mais-mobile--visivel" : ""}`}>
      <button
        type="button"
        className="painel-mais-mobile__backdrop"
        aria-label="Fechar menu"
        onClick={onFechar}
      />

      <section
        id="cedro-painel-mais"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="painel-mais-mobile__conteudo"
      >
        <span className="painel-mais-mobile__alca" aria-hidden="true" />

        <header className="painel-mais-mobile__cabecalho">
          <h2 id={tituloId} className="painel-mais-mobile__titulo">Mais opções</h2>
          <button
            type="button"
            className="painel-mais-mobile__fechar"
            aria-label="Fechar menu"
            onClick={onFechar}
          >
            <X size={20} />
          </button>
        </header>

        <div className="painel-mais-mobile__lista">
          {itens.map((aba) => {
            const Icone = ICONES_MAIS[aba];
            const ativo = abaAtiva === aba;

            return (
              <button
                key={aba}
                type="button"
                data-pagina={aba}
                className={`painel-mais-mobile__item ${ativo ? "painel-mais-mobile__item--ativo" : ""}`}
                aria-current={ativo ? "page" : undefined}
                aria-label={TITULOS_ABAS[aba]}
                onClick={() => selecionar(aba)}
              >
                <span className="painel-mais-mobile__item-icone">
                  <Icone size={20} />
                </span>
                <span className="painel-mais-mobile__item-texto">{TITULOS_ABAS[aba]}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
