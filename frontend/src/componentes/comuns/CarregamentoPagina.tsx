type CarregamentoPaginaProps = {
  /** Tela cheia (login/auth) ou área de conteúdo já dentro do layout autenticado */
  variante?: "tela-cheia" | "conteudo";
};

export default function CarregamentoPagina({ variante = "conteudo" }: CarregamentoPaginaProps) {
  const classeRaiz =
    variante === "tela-cheia" ? "aplicacao__grupo" : "aplicacao__carregamento-pagina";

  return (
    <div
      className={classeRaiz}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Carregando página"
    >
      <div className="aplicacao__grupo-2" />
    </div>
  );
}
