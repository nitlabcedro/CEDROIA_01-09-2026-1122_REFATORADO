import type { TextareaHTMLAttributes } from "react";

import {
  LIMITE_TEXTO_FLUXO_APROVACAO,
  MENSAGEM_LIMITE_TEXTO_FLUXO_APROVACAO,
} from "@/constantes/fluxo-aprovacao";
import {
  aplicarLimiteEntradaFluxoAprovacao,
  formatarContadorTextoFluxoAprovacao,
} from "@/utilitarios/texto-fluxo-aprovacao";

type CampoTextoLongoFluxoAprovacaoProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "maxLength"> & {
  mostrarContador?: boolean;
};

export function CampoTextoLongoFluxoAprovacao({
  value = "",
  onChange,
  mostrarContador = true,
  className = "",
  ...rest
}: CampoTextoLongoFluxoAprovacaoProps) {
  const texto = String(value);
  const exibeAvisoLimite = texto.length >= LIMITE_TEXTO_FLUXO_APROVACAO;

  return (
    <div className="campo-texto-fluxo-aprovacao">
      <textarea
        {...rest}
        className={className}
        value={texto}
        onChange={(evento) => {
          const limitado = aplicarLimiteEntradaFluxoAprovacao(texto, evento.target.value);
          if (limitado !== evento.target.value) {
            evento.target.value = limitado;
          }
          onChange?.(evento);
        }}
      />
      {mostrarContador && (
        <p className="campo-texto-fluxo-aprovacao__contador" aria-live="polite">
          <span>{formatarContadorTextoFluxoAprovacao(texto.length)}</span>
          {exibeAvisoLimite && (
            <span className="campo-texto-fluxo-aprovacao__limite">
              {texto.length > LIMITE_TEXTO_FLUXO_APROVACAO
                ? "Conteúdo legado acima do limite atual. Ao editar, reduza para no máximo 2000 caracteres."
                : MENSAGEM_LIMITE_TEXTO_FLUXO_APROVACAO}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
