import type { ElementType, ReactNode } from "react";

type TextoExibicaoFluxoAprovacaoProps = {
  children: ReactNode;
  className?: string;
  as?: ElementType;
};

/** Exibe texto longo do fluxo com quebra segura — sem truncar conteúdo legado. */
export function TextoExibicaoFluxoAprovacao({
  children,
  className = "",
  as: Componente = "p",
}: TextoExibicaoFluxoAprovacaoProps) {
  const classes = ["texto-fluxo-aprovacao", className].filter(Boolean).join(" ");
  return <Componente className={classes}>{children}</Componente>;
}
