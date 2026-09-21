import {
  BarChart3,
  Boxes,
  ClipboardCheck,
  FilePlus2,
  Network,
  Settings2,
  type LucideIcon,
} from "lucide-react";

import type { NavegarPara } from "@/hooks/useAplicacao";
import { obterAtalhosAcessoRapido } from "@/utilitarios/acesso-rapido";
import type { AbaAplicacao } from "@/constantes/navegacao";

interface AcessoRapidoProps {
  navegarPara: NavegarPara;
  isAdmin: boolean;
  isPrivileged: boolean;
}

const ICONES: Record<string, LucideIcon> = {
  new: FilePlus2,
  inventory: Boxes,
  approval_queue: ClipboardCheck,
  report: BarChart3,
  sectors: Network,
  admin: Settings2,
};

export function AcessoRapido({
  navegarPara,
  isAdmin,
  isPrivileged,
}: AcessoRapidoProps) {
  const atalhos = obterAtalhosAcessoRapido({ isAdmin, isPrivileged });

  return (
    <section className="acesso-rapido cedro-card-premium" aria-labelledby="acesso-rapido-titulo">
      <header className="acesso-rapido__cabecalho">
        <h3 id="acesso-rapido-titulo">Acesso rápido</h3>
        <p>Atalhos para as principais áreas</p>
      </header>

      <div className="acesso-rapido__grade">
        {atalhos.map((atalho) => {
          const Icone = ICONES[atalho.aba];
          return (
            <button
              key={atalho.aba}
              type="button"
              className="acesso-rapido__item"
              data-rota={atalho.rota}
              onClick={() => navegarPara(atalho.aba as AbaAplicacao)}
            >
              <span className="acesso-rapido__icone" aria-hidden="true">
                <Icone size={18} strokeWidth={1.8} />
              </span>
              <span className="acesso-rapido__texto">
                <strong>{atalho.titulo}</strong>
                <small>{atalho.descricao}</small>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
