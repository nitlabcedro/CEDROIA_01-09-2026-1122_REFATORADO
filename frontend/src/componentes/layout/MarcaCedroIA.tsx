import React from "react";

interface MarcaCedroIAProps {
  compacta?: boolean;
  contexto?: "claro" | "escuro";
  className?: string;
  textoClassName?: string;
}

/**
 * Marca visual única do Cedro IA.
 *
 * A classe raiz é semântica e os modificadores representam apenas estado/contexto.
 * A imagem fica em /frontend/public para não depender de import ou URL externa.
 */
export const MarcaCedroIA: React.FC<MarcaCedroIAProps> = ({
  compacta = false,
  contexto = "escuro",
  className = "",
  textoClassName = ""
}) => {
  return (
    <div
      data-componente="marca-cedro-ia"
      className={`marca-cedro marca-cedro--${contexto} ${compacta ? "marca-cedro--compacta" : ""} ${className}`.trim()}
      aria-label="Cedro IA">
      
      <span className="marca-cedro__icone">
        <img
          src="/NIT.webp"
          alt=""
          width={56}
          height={56}
          decoding="async"
          draggable={false}
          className="marca-cedro__imagem" />
        
      </span>

      {/* {!compacta && (
         <span className={`marca-cedro__texto ${textoClassName}`.trim()}>
           Cedro <span className="marca-cedro__texto-ia">IaA</span>
         </span>
        )} */}
    </div>);

};

export default MarcaCedroIA;
