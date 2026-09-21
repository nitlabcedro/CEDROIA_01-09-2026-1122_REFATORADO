import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircleReply } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import ModalComunicacaoTI from "@/componentes/aprovacoes/ModalComunicacaoTI";
import { listarPendenciasResponsavelTI } from "@/servicos/interacoes-ti";
import type { SolicitacaoInformacoesTI } from "@/tipos";
import {
  INTERVALO_PENDENCIAS_TI_MS,
  registrarPollingComVisibilidade,
} from "@/utilitarios/polling-visibilidade";

export default function NotificacaoRespostaTI({ currentUserId }: { currentUserId: string }) {
  const [pendencias, setPendencias] = useState<SolicitacaoInformacoesTI[]>([]);
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const requisicaoPendenteRef = useRef(false);
  const ativoRef = useRef(true);

  const carregarPendencias = useCallback(async () => {
    if (requisicaoPendenteRef.current) return;
    requisicaoPendenteRef.current = true;
    try {
      const dados = await listarPendenciasResponsavelTI();
      if (ativoRef.current) setPendencias(dados);
    } catch (error: unknown) {
      console.warn("Não foi possível carregar respostas pendentes para a TI:", error);
    } finally {
      requisicaoPendenteRef.current = false;
    }
  }, []);

  useEffect(() => {
    ativoRef.current = true;
    const controle = registrarPollingComVisibilidade({
      intervaloMs: INTERVALO_PENDENCIAS_TI_MS,
      executar: () => void carregarPendencias(),
      documento: document,
      executarAoIniciar: true,
    });
    return () => {
      ativoRef.current = false;
      requisicaoPendenteRef.current = false;
      controle.dispose();
    };
  }, [carregarPendencias]);

  const principal = pendencias[0] || null;
  const aberta = pendencias.find((item) => item.id === abertaId) || null;
  if (!principal) return null;

  return (
    <>
      <AnimatePresence>
        <motion.aside
          key={principal.id}
          initial={{ opacity: 0, y: 28, scale: .96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: .96 }}
          className="notificacao-ti-pendente notificacao-ti__notificacao-ti-pendente-estrutura notificacao-ti__notificacao-ti-pendente-estrutura--responsavel"
          aria-live="polite"
        >
          <div className="notificacao-ti__grupo">
            <div className="notificacao-ti__grupo-2" />
            <div className="notificacao-ti__grupo-3">
              <div className="notificacao-ti__grupo-4">
                <div className="notificacao-ti__grupo-5">
                  <MessageCircleReply size={20} />
                </div>
                <div className="notificacao-ti__grupo-informacoes-solicitadas-pela-t">
                  <p className="notificacao-ti__descricao-informacoes-solicitadas-pela-t">
                    {principal.modo === "bloco" ? "Respostas recebidas" : "Resposta recebida"}
                  </p>
                  <h4 className="notificacao-ti__titulo-item">
                    {principal.nomeFerramenta || principal.iaRecordId}
                  </h4>
                  <p className="notificacao-ti__descricao-a-equipe-de-ti-enviou-pergunta">
                    {principal.modo === "bloco"
                      ? "O solicitante respondeu todas as informações solicitadas."
                      : "O solicitante respondeu à solicitação de informações da etapa TI."}
                  </p>
                  <div className="notificacao-ti__grupo-de-respondidas">
                    <span className="notificacao-ti__texto-de-respondidas">
                      Ação da TI obrigatória
                      {pendencias.length > 1 ? ` • ${pendencias.length} pendências` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAbertaId(principal.id)}
                      className="notificacao-ti__botao"
                    >
                      Abrir conversa
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.aside>
      </AnimatePresence>

      {aberta && (
        <ModalComunicacaoTI
          aberto
          recordId={aberta.iaRecordId}
          nomeFerramenta={aberta.nomeFerramenta}
          papelUsuario="ti"
          currentUserId={currentUserId}
          interacoesIniciais={[aberta]}
          onFechar={() => setAbertaId(null)}
          onAtualizar={async () => {
            await carregarPendencias();
          }}
        />
      )}
    </>
  );
}
