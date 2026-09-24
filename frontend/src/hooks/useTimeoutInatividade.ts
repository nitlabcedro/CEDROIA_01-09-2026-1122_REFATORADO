import { useEffect, useRef } from "react";

import { CHAVES_ARMAZENAMENTO_LOCAL } from "@/constantes/armazenamento-local";
import { criarControleTimeoutInatividade } from "@/utilitarios/timeout-inatividade";

export function useTimeoutInatividade(opcoes: {
  ativo: boolean;
  encerrarSessao: () => void | Promise<void>;
}) {
  const encerrarSessaoRef = useRef(opcoes.encerrarSessao);
  encerrarSessaoRef.current = opcoes.encerrarSessao;
  const esteveAtivoRef = useRef(false);

  useEffect(() => {
    if (!opcoes.ativo) {
      if (esteveAtivoRef.current && typeof window !== "undefined") {
        window.localStorage.removeItem(CHAVES_ARMAZENAMENTO_LOCAL.ULTIMA_ATIVIDADE);
        esteveAtivoRef.current = false;
      }
      return;
    }

    if (typeof window === "undefined") return;

    esteveAtivoRef.current = true;
    const controle = criarControleTimeoutInatividade({
      armazenamento: window.localStorage,
      encerrarSessao: () => encerrarSessaoRef.current(),
      alvoEventos: window,
      documento: document,
    });
    controle.iniciar();

    return () => {
      controle.dispose();
    };
  }, [opcoes.ativo]);
}
