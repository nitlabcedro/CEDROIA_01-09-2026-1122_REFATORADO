import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Loader2, MessageSquareWarning, Send, X } from "lucide-react";

import {
  enviarRespostasTI,
  listarPendenciasTI,
  salvarRascunhoRespostasTI } from
"@/servicos/interacoes-ti";
import type { SolicitacaoInformacoesTI } from "@/tipos";
import { obterMensagemErroUsuario } from "@/utilitarios/mensagens-erro";
import {
  INTERVALO_PENDENCIAS_TI_MS,
  registrarPollingComVisibilidade,
} from "@/utilitarios/polling-visibilidade";

export default function NotificacaoPerguntasTI() {
  const [pendencias, setPendencias] = useState<SolicitacaoInformacoesTI[]>([]);
  const [solicitacaoAbertaId, setSolicitacaoAbertaId] = useState<string | null>(null);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [rascunhoAlterado, setRascunhoAlterado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const requisicaoPendenteRef = useRef(false);
  const componenteAtivoRef = useRef(true);

  const carregarPendencias = useCallback(async () => {
    if (requisicaoPendenteRef.current) return;
    requisicaoPendenteRef.current = true;

    try {
      const dados = await listarPendenciasTI();
      if (!componenteAtivoRef.current) return;
      setPendencias(dados);
      setErro("");
    } catch (error: any) {
      // Durante a implantação, antes da migration, a notificação apenas permanece inativa.
      console.warn("Não foi possível carregar pendências da TI:", error?.message || error);
    } finally {
      requisicaoPendenteRef.current = false;
    }
  }, []);

  useEffect(() => {
    componenteAtivoRef.current = true;

    const controle = registrarPollingComVisibilidade({
      intervaloMs: INTERVALO_PENDENCIAS_TI_MS,
      executar: () => {
        void carregarPendencias();
      },
      documento: document,
      executarAoIniciar: true,
    });

    return () => {
      controle.dispose();
      componenteAtivoRef.current = false;
      requisicaoPendenteRef.current = false;
    };
  }, [carregarPendencias]);

  const solicitacaoAberta = useMemo(
    () => pendencias.find((item) => item.id === solicitacaoAbertaId) || null,
    [pendencias, solicitacaoAbertaId]
  );

  const pendenciaPrincipal = pendencias[0] || null;

  useEffect(() => {
    if (!solicitacaoAberta) return;
    const iniciais: Record<string, string> = {};
    solicitacaoAberta.perguntas.forEach((pergunta) => {
      iniciais[pergunta.id] = pergunta.resposta || "";
    });
    setRespostas(iniciais);
    setRascunhoAlterado(false);
    setErro("");
  }, [solicitacaoAberta?.id]);

  const respostasPayload = useMemo(
    () => solicitacaoAberta?.perguntas.map((pergunta) => ({
      perguntaId: pergunta.id,
      resposta: respostas[pergunta.id] || ""
    })) || [],
    [solicitacaoAberta, respostas]
  );

  const totalRespondidas = useMemo(
    () => respostasPayload.filter((item) => item.resposta.trim().length > 0).length,
    [respostasPayload]
  );

  const todasRespondidas = solicitacaoAberta ?
  totalRespondidas === solicitacaoAberta.perguntas.length && solicitacaoAberta.perguntas.length > 0 :
  false;

  useEffect(() => {
    if (!solicitacaoAberta || !rascunhoAlterado || enviando) return;

    const timer = window.setTimeout(async () => {
      try {
        setSalvando(true);
        await salvarRascunhoRespostasTI(solicitacaoAberta.id, respostasPayload);
        setRascunhoAlterado(false);
      } catch (error: unknown) {
        console.error("Erro ao salvar rascunho das respostas da TI:", error);
        setErro(obterMensagemErroUsuario(error, "aprovacao"));
      } finally {
        setSalvando(false);
      }
    }, 800);

    return () => window.clearTimeout(timer);
  }, [solicitacaoAberta, respostasPayload, rascunhoAlterado, enviando]);

  const abrirPendencia = (id: string) => {
    setSolicitacaoAbertaId(id);
  };

  const fecharModal = async () => {
    if (solicitacaoAberta && rascunhoAlterado) {
      try {
        setSalvando(true);
        await salvarRascunhoRespostasTI(solicitacaoAberta.id, respostasPayload);
        setRascunhoAlterado(false);
      } catch (error: unknown) {
        console.error("Erro ao salvar rascunho ao fechar perguntas da TI:", error);
        setErro(obterMensagemErroUsuario(error, "aprovacao"));
        setSalvando(false);
        return;
      } finally {
        setSalvando(false);
      }
    }
    setSolicitacaoAbertaId(null);
  };

  const enviar = async () => {
    if (!solicitacaoAberta || !todasRespondidas) return;

    try {
      setEnviando(true);
      setErro("");
      await enviarRespostasTI(solicitacaoAberta.id, respostasPayload);
      setSolicitacaoAbertaId(null);
      setRespostas({});
      setRascunhoAlterado(false);
      await carregarPendencias();
    } catch (error: unknown) {
      console.error("Erro ao enviar respostas para a TI:", error);
      setErro(obterMensagemErroUsuario(error, "aprovacao"));
    } finally {
      setEnviando(false);
    }
  };

  if (!pendenciaPrincipal) return null;

  const respondidasCard = pendenciaPrincipal.perguntas.filter((pergunta) =>
  String(pergunta.resposta || "").trim()
  ).length;

  return (
    <>
      <AnimatePresence>
        <motion.aside
          key={pendenciaPrincipal.id}
          initial={{ opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.96 }}
          className="notificacao-ti-pendente notificacao-ti__notificacao-ti-pendente-estrutura"
          aria-live="polite">
          
          <div className="notificacao-ti__grupo">
            <div className="notificacao-ti__grupo-2" />
            <div className="notificacao-ti__grupo-3">
              <div className="notificacao-ti__grupo-4">
                <div className="notificacao-ti__grupo-5">
                  <MessageSquareWarning size={20} />
                </div>
                <div className="notificacao-ti__grupo-informacoes-solicitadas-pela-t">
                  <p className="notificacao-ti__descricao-informacoes-solicitadas-pela-t">
                    Informações solicitadas pela TI
                  </p>
                  <h4 className="notificacao-ti__titulo-item">
                    {pendenciaPrincipal.nomeFerramenta || pendenciaPrincipal.iaRecordId}
                  </h4>
                  <p className="notificacao-ti__descricao-a-equipe-de-ti-enviou-pergunta">
                    A equipe de TI enviou {pendenciaPrincipal.perguntas.length} pergunta(s) para continuar a análise da sua solicitação.
                  </p>
                  <div className="notificacao-ti__grupo-de-respondidas">
                    <span className="notificacao-ti__texto-de-respondidas">
                      {respondidasCard} de {pendenciaPrincipal.perguntas.length} respondidas
                      {pendencias.length > 1 ? ` • ${pendencias.length} pendências` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => abrirPendencia(pendenciaPrincipal.id)}
                      className="notificacao-ti__botao">
                      
                      {respondidasCard > 0 ? "Continuar respondendo" : "Responder agora"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.aside>
      </AnimatePresence>

      <AnimatePresence>
        {solicitacaoAberta &&
        <div className="cedro-modal-overlay notificacao-ti__grupo-6">
            <motion.button
            type="button"
            aria-label="Fechar formulário de respostas"
            onClick={fecharModal}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="notificacao-ti__elemento-fechar-formulario-de-respostas" />
          

            <motion.section
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            className="cedro-modal-painel notificacao-ti__elemento">
            
              <div className="notificacao-ti__grupo-7" />
              <header className="notificacao-ti__cabecalho-etapa-2-ti-rodada">
                <div>
                  <p className="notificacao-ti__descricao-etapa-2-ti-rodada">
                    Etapa 2 — TI • Rodada {solicitacaoAberta.numeroRodada}
                  </p>
                  <h3 className="notificacao-ti__titulo-bloco-informacoes-solicitadas-pela-t">
                    Informações solicitadas pela TI
                  </h3>
                  <p className="notificacao-ti__descricao">
                    {solicitacaoAberta.nomeFerramenta || solicitacaoAberta.iaRecordId}
                  </p>
                </div>
                <button
                type="button"
                onClick={fecharModal}
                className="notificacao-ti__botao-fechar-e-continuar-depois"
                title="Fechar e continuar depois">
                
                  <X size={17} />
                </button>
              </header>

              <div className="notificacao-ti__grupo-responda-todas-as-perguntas-vo">
                <div className="notificacao-ti__grupo-responda-todas-as-perguntas-vo-2">
                  <p className="notificacao-ti__descricao-responda-todas-as-perguntas-vo">
                    Responda todas as perguntas. Você pode fechar esta janela e continuar depois; o rascunho é salvo automaticamente. A notificação só desaparecerá após o envio completo.
                  </p>
                </div>

                {solicitacaoAberta.perguntas.map((pergunta) =>
              <div key={pergunta.id} className="notificacao-ti__grupo-8">
                    <div className="notificacao-ti__grupo-4">
                      <span className="notificacao-ti__texto">
                        {String(pergunta.ordem).padStart(2, "0")}
                      </span>
                      <div className="notificacao-ti__grupo-informacoes-solicitadas-pela-t">
                        <p className="notificacao-ti__descricao-2">
                          {pergunta.pergunta}
                        </p>
                        <label className="notificacao-ti__rotulo-sua-resposta">
                          Sua resposta
                        </label>
                        <textarea
                      value={respostas[pergunta.id] || ""}
                      onChange={(event) => {
                        setRespostas((anterior) => ({ ...anterior, [pergunta.id]: event.target.value }));
                        setRascunhoAlterado(true);
                      }}
                      placeholder="Digite sua resposta..."
                      className="notificacao-ti__campo-texto-digite-sua-resposta" />
                    
                      </div>
                    </div>
                  </div>
              )}

                {erro &&
              <div className="notificacao-ti__grupo-9">
                    {erro}
                  </div>
              }
              </div>

              <footer className="notificacao-ti__rodape">
                <div className="notificacao-ti__grupo-de-respondidas-2">
                  <span className={todasRespondidas ? "notificacao-ti__texto-de-respondidas-2" : "notificacao-ti__texto-de-respondidas-3"}>
                    {totalRespondidas} de {solicitacaoAberta.perguntas.length} respondidas
                  </span>
                  <span className="notificacao-ti__texto-2">
                    {salvando ? <><Loader2 size={12} className="notificacao-ti__icone-loader2" /> Salvando rascunho...</> : <><CheckCircle2 size={12} /> Rascunho salvo</>}
                  </span>
                </div>
                <button
                type="button"
                onClick={enviar}
                disabled={!todasRespondidas || enviando}
                className="notificacao-ti__botao-2">
                
                  {enviando ? <Loader2 size={15} className="notificacao-ti__icone-loader2" /> : <Send size={15} />}
                  {enviando ? "Enviando respostas..." : "Enviar respostas para a TI"}
                </button>
              </footer>
            </motion.section>
          </div>
        }
      </AnimatePresence>
    </>);

}
