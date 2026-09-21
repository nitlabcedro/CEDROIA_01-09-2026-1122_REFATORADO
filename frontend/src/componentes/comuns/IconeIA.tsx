import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

import {
  ASSET_IA_GENERICA,
  obterIdentidadeIA,
} from "@/utilitarios/identidade-ia";

interface IconeIAProps {
  nome: string;
  tamanho?: number;
  decorativo?: boolean;
  personalizada?: boolean;
  className?: string;
}

export function obterProximoAssetAposFalha(assetAtual: string): string | null {
  return assetAtual === ASSET_IA_GENERICA ? null : ASSET_IA_GENERICA;
}

export function IconeIA({
  nome,
  tamanho = 36,
  decorativo = true,
  personalizada = false,
  className = "",
}: IconeIAProps) {
  const identidade = obterIdentidadeIA(nome, { personalizada });
  const [assetEmUso, setAssetEmUso] = useState<string | null>(identidade.asset);

  useEffect(() => {
    setAssetEmUso(identidade.asset);
  }, [identidade.asset]);

  const estilo = { width: tamanho, height: tamanho };
  const classe = `icone-ia icone-ia--${identidade.id} ${className}`.trim();

  if (!assetEmUso) {
    return (
      <span
        className={`${classe} icone-ia--fallback`}
        style={estilo}
        role={decorativo ? undefined : "img"}
        aria-hidden={decorativo || undefined}
        aria-label={decorativo ? undefined : identidade.nome}
      >
        <Sparkles size={Math.max(16, Math.round(tamanho * 0.5))} aria-hidden="true" />
      </span>
    );
  }

  return (
    <span className={classe} style={estilo} aria-hidden={decorativo || undefined}>
      <img
        src={assetEmUso}
        alt={decorativo ? "" : identidade.nome}
        onError={() => setAssetEmUso(obterProximoAssetAposFalha(assetEmUso))}
        className="icone-ia__imagem"
      />
    </span>
  );
}
