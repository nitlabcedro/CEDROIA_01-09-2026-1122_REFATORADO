import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2, Plus, Send, Trash2, X } from "lucide-react";

import { IconeIA } from "@/componentes/comuns/IconeIA";
import {
  criarBlocoPerguntasTI,
  encerrarConversaComunicacaoTI,
  enviarMensagemComunicacaoTI,
  finalizarBlocoRespostasTI,
  listarInteracoesTI,
  salvarRespostaBlocoTI,
} from "@/servicos/interacoes-ti";
import {
  LIMITE_PERGUNTA_BLOCO_TI,
  LIMITE_MENSAGEM_COMUNICACAO_TI,
  LIMITE_RESPOSTA_BLOCO_TI,
  MAXIMO_PERGUNTAS_BLOCO_TI,
  MENSAGEM_LIMITE_COMUNICACAO_TI,
} from "@/constantes/comunicacao-ti";
import type {
  SolicitacaoInformacoesTI,
  TurnoComunicacaoTI,
} from "@/tipos";
import {
  criarTravaEnvioComunicacaoTI,
  mensagemComunicacaoTIValida,
  obterConversaAbertaTI,
  perguntasBlocoTIValidas,
  respostaBlocoTIValida,
  usuarioPodeEscreverComunicacaoTI,
} from "@/utilitarios/comunicacao-ti";
import { obterMensagemErroUsuario } from "@/utilitarios/mensagens-erro";

type Props = {
  aberto: boolean;
  recordId: string;
  nomeFerramenta?: string;
  papelUsuario: TurnoComunicacaoTI;
  currentUserId: string;
  interacoesIniciais?: SolicitacaoInformacoesTI[];
  onFechar: () => void;
  onAtualizar?: (interacoes: SolicitacaoInformacoesTI[]) => void | Promise<void>;
};

function formatarHorario(dataIso: string) {
  const data = new Date(dataIso);
  if (Number.isNaN(data.getTime())) return "";
  return data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatarData(dataIso: string) {
  const data = new Date(dataIso);
  if (Number.isNaN(data.getTime())) return "";
  return data.toLocaleDateString("pt-BR");
}

export default function ModalComunicacaoTI({
  aberto,
  recordId,
  nomeFerramenta,
  papelUsuario,
  currentUserId,
  interacoesIniciais = [],
  onFechar,
  onAtualizar,
}: Props) {
  const [interacoes, setInteracoes] = useState(interacoesIniciais);
  const [mensagem, setMensagem] = useState("");
  const [perguntasNovoBloco, setPerguntasNovoBloco] = useState([""]);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [estadoSalvamento, setEstadoSalvamento] = useState<
    Record<string, "nao_respondida" | "salvando" | "salva" | "erro">
  >({});
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [encerrando, setEncerrando] = useState(false);
  const [erro, setErro] = useState("");
  const travaEnvioRef = useRef(criarTravaEnvioComunicacaoTI());
  const travaFinalizacaoRef = useRef(criarTravaEnvioComunicacaoTI());
  const salvamentosEmAndamentoRef = useRef(new Set<string>());
  const fimHistoricoRef = useRef<HTMLDivElement | null>(null);

  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      setErro("");
      const dados = await listarInteracoesTI(recordId);
      setInteracoes(dados);
      return dados;
    } catch (error: unknown) {
      console.error("Erro ao carregar comunicação da TI:", error);
      setErro(obterMensagemErroUsuario(error, "chat"));
      return null;
    } finally {
      setCarregando(false);
    }
  }, [recordId]);

  useEffect(() => {
    if (!aberto) return;
    setMensagem("");
    setPerguntasNovoBloco([""]);
    setErro("");
    void carregar();
  }, [aberto, carregar]);

  useEffect(() => {
    if (aberto) setInteracoes(interacoesIniciais);
  }, [aberto, interacoesIniciais]);

  const interacoesOrdenadas = useMemo(
    () => [...interacoes].sort((a, b) => a.numeroRodada - b.numeroRodada),
    [interacoes],
  );
  const conversaAberta = useMemo(
    () => obterConversaAbertaTI(interacoes),
    [interacoes],
  );
  const blocoAberto = conversaAberta?.modo === "bloco" ? conversaAberta : null;
  const podeCriarBloco = papelUsuario === "ti"
    && (!conversaAberta || (blocoAberto?.estado === "aguardando_ti"));
  const podeEscreverChat = conversaAberta?.modo === "chat"
    && usuarioPodeEscreverComunicacaoTI(papelUsuario, conversaAberta);
  const podeEncerrar = papelUsuario === "ti"
    && (conversaAberta?.modo === "chat" || conversaAberta?.modo === "bloco")
    && conversaAberta.estado === "aguardando_ti";

  useEffect(() => {
    if (!blocoAberto) {
      setRespostas({});
      setEstadoSalvamento({});
      return;
    }
    setRespostas(Object.fromEntries(
      blocoAberto.perguntas.map((pergunta) => [pergunta.id, pergunta.resposta || ""]),
    ));
    setEstadoSalvamento(Object.fromEntries(
      blocoAberto.perguntas.map((pergunta) => [
        pergunta.id,
        pergunta.resposta?.trim() ? "salva" : "nao_respondida",
      ]),
    ));
  }, [blocoAberto?.id]);

  useEffect(() => {
    if (!aberto) return;
    fimHistoricoRef.current?.scrollIntoView({ block: "end" });
  }, [aberto, interacoes]);

  const atualizarAposMutacao = async () => {
    const dados = await carregar();
    if (dados) await onAtualizar?.(dados);
  };

  const aplicarInteracaoAtualizada = async (atualizada: SolicitacaoInformacoesTI) => {
    const proximas = [
      ...interacoes.filter((interacao) => interacao.id !== atualizada.id),
      atualizada,
    ].sort((a, b) => a.numeroRodada - b.numeroRodada);
    setInteracoes(proximas);
    await onAtualizar?.(proximas);
  };

  const enviar = async () => {
    if (!podeEscreverChat || !travaEnvioRef.current.tentarIniciar()) return;
    if (!mensagemComunicacaoTIValida(mensagem)) {
      setErro(
        mensagem.trim().length > LIMITE_MENSAGEM_COMUNICACAO_TI
          ? MENSAGEM_LIMITE_COMUNICACAO_TI
          : "Digite uma mensagem antes de enviar.",
      );
      travaEnvioRef.current.liberar();
      return;
    }

    setEnviando(true);
    setErro("");
    try {
      await enviarMensagemComunicacaoTI(conversaAberta!.id, mensagem);
      setMensagem("");
      await atualizarAposMutacao();
    } catch (error: unknown) {
      console.error("Erro ao enviar mensagem da comunicação TI:", error);
      setErro(obterMensagemErroUsuario(error, "chat"));
    } finally {
      travaEnvioRef.current.liberar();
      setEnviando(false);
    }
  };

  const enviarNovoBloco = async () => {
    if (!podeCriarBloco || !travaEnvioRef.current.tentarIniciar()) return;
    if (!perguntasBlocoTIValidas(perguntasNovoBloco)) {
      setErro("Preencha de 1 a 10 perguntas, com no máximo 1000 caracteres cada.");
      travaEnvioRef.current.liberar();
      return;
    }
    try {
      setEnviando(true);
      setErro("");
      const criada = await criarBlocoPerguntasTI(recordId, perguntasNovoBloco);
      setPerguntasNovoBloco([""]);
      await aplicarInteracaoAtualizada(criada);
      await atualizarAposMutacao();
    } catch (error: unknown) {
      console.error("Erro ao criar bloco de perguntas TI:", error);
      setErro(obterMensagemErroUsuario(error, "chat"));
    } finally {
      travaEnvioRef.current.liberar();
      setEnviando(false);
    }
  };

  const salvarResposta = async (perguntaId: string) => {
    if (!blocoAberto || blocoAberto.estado !== "aguardando_solicitante") return;
    const resposta = respostas[perguntaId] || "";
    if (!respostaBlocoTIValida(resposta) || salvamentosEmAndamentoRef.current.has(perguntaId)) {
      if (!respostaBlocoTIValida(resposta)) {
        setEstadoSalvamento((anterior) => ({ ...anterior, [perguntaId]: "erro" }));
        setErro("A resposta deve ter entre 1 e 1000 caracteres.");
      }
      return;
    }
    salvamentosEmAndamentoRef.current.add(perguntaId);
    setEstadoSalvamento((anterior) => ({ ...anterior, [perguntaId]: "salvando" }));
    setErro("");
    try {
      const atualizada = await salvarRespostaBlocoTI(blocoAberto.id, perguntaId, resposta);
      setEstadoSalvamento((anterior) => ({ ...anterior, [perguntaId]: "salva" }));
      await aplicarInteracaoAtualizada(atualizada);
    } catch (error: unknown) {
      console.error("Erro ao salvar resposta do bloco TI:", error);
      setEstadoSalvamento((anterior) => ({ ...anterior, [perguntaId]: "erro" }));
      setErro(obterMensagemErroUsuario(error, "aprovacao"));
    } finally {
      salvamentosEmAndamentoRef.current.delete(perguntaId);
    }
  };

  const finalizarBloco = async () => {
    if (!blocoAberto?.todasRespondidas || !travaFinalizacaoRef.current.tentarIniciar()) return;
    if (!window.confirm("Após enviar, as respostas não poderão mais ser alteradas.")) {
      travaFinalizacaoRef.current.liberar();
      return;
    }
    try {
      setFinalizando(true);
      setErro("");
      const atualizada = await finalizarBlocoRespostasTI(blocoAberto.id);
      await aplicarInteracaoAtualizada(atualizada);
    } catch (error: unknown) {
      console.error("Erro ao finalizar bloco TI:", error);
      setErro(obterMensagemErroUsuario(error, "aprovacao"));
    } finally {
      travaFinalizacaoRef.current.liberar();
      setFinalizando(false);
    }
  };

  const encerrar = async () => {
    if (!podeEncerrar || !conversaAberta || encerrando) return;
    if (!window.confirm("Encerrar conversa? O histórico continuará disponível.")) return;

    try {
      setEncerrando(true);
      setErro("");
      await encerrarConversaComunicacaoTI(conversaAberta.id);
      await atualizarAposMutacao();
    } catch (error: unknown) {
      console.error("Erro ao encerrar comunicação TI:", error);
      setErro(obterMensagemErroUsuario(error, "chat"));
    } finally {
      setEncerrando(false);
    }
  };

  if (!aberto) return null;

  const estadoInformativo = conversaAberta?.modo === "legado"
    ? "Esta rodada usa o formulário legado de perguntas e respostas."
    : conversaAberta?.estado === "aguardando_solicitante"
      ? "Aguardando resposta do solicitante."
      : conversaAberta?.estado === "aguardando_ti"
        ? "Aguardando análise da TI."
        : papelUsuario === "ti"
          ? "Envie uma mensagem para iniciar uma nova conversa."
          : "Conversa encerrada.";

  return (
    <div className="comunicacao-ti-modal" role="presentation">
      <button
        type="button"
        className="comunicacao-ti-modal__fundo"
        aria-label="Fechar comunicação"
        onClick={onFechar}
      />
      <section
        className="comunicacao-ti-modal__painel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="comunicacao-ti-titulo"
      >
        <header className="comunicacao-ti-modal__cabecalho">
          <div className="comunicacao-ti-modal__titulo-wrap">
            <IconeIA
              nome={nomeFerramenta || recordId}
              tamanho={36}
              className="comunicacao-ti-modal__icone"
            />
            <div>
              <h2 id="comunicacao-ti-titulo">Comunicação com o solicitante</h2>
              <p>{nomeFerramenta || recordId} • Etapa TI</p>
            </div>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar comunicação">
            <X size={20} />
          </button>
        </header>

        <div className="comunicacao-ti-modal__historico" aria-live="polite">
          {carregando && interacoes.length === 0 && (
            <div className="comunicacao-ti-modal__estado">
              <Loader2 size={18} className="comunicacao-ti__girando" />
              Carregando conversa...
            </div>
          )}

          {!carregando && interacoesOrdenadas.length === 0 && (
            <div className="comunicacao-ti-modal__vazio">
              Ainda não há mensagens nesta comunicação.
            </div>
          )}

          {interacoesOrdenadas.map((interacao) => (
            <section key={interacao.id} className="comunicacao-ti-rodada">
              <div className="comunicacao-ti-rodada__separador">
                <span>Rodada {interacao.numeroRodada}</span>
                {interacao.estado === "encerrada" && <span>Encerrada</span>}
              </div>
              {interacao.modo === "bloco" && (
                <article className="comunicacao-ti-bloco">
                  <div className="comunicacao-ti-bloco__cabecalho">
                    <strong>TI • Bloco de perguntas</strong>
                    <time dateTime={interacao.criadoEm}>
                      {formatarData(interacao.criadoEm)} • {formatarHorario(interacao.criadoEm)}
                    </time>
                  </div>
                  <div className="comunicacao-ti-bloco__perguntas">
                    {interacao.perguntas.map((pergunta, indice) => {
                      const editavel = interacao.id === blocoAberto?.id
                        && papelUsuario === "solicitante"
                        && interacao.estado === "aguardando_solicitante";
                      const status = estadoSalvamento[pergunta.id] || "nao_respondida";
                      return (
                        <section key={pergunta.id} className="comunicacao-ti-bloco__pergunta">
                          <label htmlFor={`resposta-bloco-${pergunta.id}`}>
                            <span>Pergunta {indice + 1} de {interacao.perguntas.length}</span>
                            <strong>{pergunta.pergunta}</strong>
                          </label>
                          {editavel ? (
                            <>
                              <textarea
                                id={`resposta-bloco-${pergunta.id}`}
                                value={respostas[pergunta.id] || ""}
                                onChange={(event) => {
                                  setRespostas((anterior) => ({
                                    ...anterior,
                                    [pergunta.id]: event.target.value,
                                  }));
                                  setEstadoSalvamento((anterior) => ({
                                    ...anterior,
                                    [pergunta.id]: "nao_respondida",
                                  }));
                                  if (erro) setErro("");
                                }}
                                maxLength={LIMITE_RESPOSTA_BLOCO_TI}
                                rows={3}
                                disabled={status === "salvando" || finalizando}
                              />
                              <div className="comunicacao-ti-bloco__resposta-acoes">
                                <span>{(respostas[pergunta.id] || "").length} / {LIMITE_RESPOSTA_BLOCO_TI}</span>
                                <span role="status">
                                  {status === "salvando" ? "Salvando..."
                                    : status === "salva" ? "Salva"
                                      : status === "erro" ? "Erro ao salvar"
                                        : "Não respondida"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => void salvarResposta(pergunta.id)}
                                  disabled={
                                    status === "salvando"
                                    || finalizando
                                    || !respostaBlocoTIValida(respostas[pergunta.id] || "")
                                  }
                                >
                                  {status === "salvando" ? "Salvando..." : "Salvar resposta"}
                                </button>
                              </div>
                            </>
                          ) : (
                            <div className="comunicacao-ti-bloco__resposta">
                              <span>Resposta</span>
                              <p>{pergunta.resposta?.trim() || "Não respondida"}</p>
                            </div>
                          )}
                        </section>
                      );
                    })}
                  </div>
                  <footer className="comunicacao-ti-bloco__status">
                    {interacao.totalRespondidas} de {interacao.totalPerguntas} respondidas
                    {interacao.estado === "aguardando_solicitante"
                      ? " • Aguardando respostas do solicitante"
                      : interacao.estado === "aguardando_ti"
                        ? " • Respostas enviadas para a TI"
                        : ""}
                    {interacao.respondidoEm
                      ? ` • Respondido em ${formatarData(interacao.respondidoEm)} às ${formatarHorario(interacao.respondidoEm)}`
                      : ""}
                  </footer>
                </article>
              )}
              {interacao.modo !== "bloco" && (interacao.mensagens || []).map((item) => (
                <article
                  key={item.id}
                  className={`comunicacao-ti-mensagem comunicacao-ti-mensagem--${item.papelAutor}`}
                >
                  <div className="comunicacao-ti-mensagem__meta">
                    <strong>
                      {item.papelAutor === "ti" ? "TI" : "Solicitante"}
                      {item.autorId === currentUserId ? " • você" : ""}
                    </strong>
                    <span>{item.autorNome}</span>
                  </div>
                  <p>{item.conteudo}</p>
                  <time dateTime={item.criadoEm}>
                    {formatarData(item.criadoEm)} • {formatarHorario(item.criadoEm)}
                  </time>
                </article>
              ))}
            </section>
          ))}
          <div ref={fimHistoricoRef} />
        </div>

        <footer className="comunicacao-ti-modal__composer">
          {podeCriarBloco && (
            <section className="comunicacao-ti-criacao">
              <strong>Solicitar informações</strong>
              {perguntasNovoBloco.map((pergunta, indice) => (
                <div key={indice} className="comunicacao-ti-criacao__pergunta">
                  <label htmlFor={`nova-pergunta-ti-${indice}`}>Pergunta {indice + 1}</label>
                  <textarea
                    id={`nova-pergunta-ti-${indice}`}
                    value={pergunta}
                    onChange={(event) => {
                      setPerguntasNovoBloco((anteriores) => anteriores.map(
                        (item, itemIndice) => itemIndice === indice ? event.target.value : item,
                      ));
                      if (erro) setErro("");
                    }}
                    maxLength={LIMITE_PERGUNTA_BLOCO_TI}
                    rows={2}
                    disabled={enviando || encerrando}
                  />
                  <div className="comunicacao-ti-criacao__acoes-pergunta">
                    <span>{pergunta.length} / {LIMITE_PERGUNTA_BLOCO_TI}</span>
                    {perguntasNovoBloco.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setPerguntasNovoBloco((anteriores) =>
                          anteriores.filter((_, itemIndice) => itemIndice !== indice))}
                        aria-label={`Remover pergunta ${indice + 1}`}
                        disabled={enviando}
                      >
                        <Trash2 size={14} /> Remover
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <div className="comunicacao-ti-criacao__acoes">
                <button
                  type="button"
                  onClick={() => setPerguntasNovoBloco((anteriores) => [...anteriores, ""])}
                  disabled={enviando || perguntasNovoBloco.length >= MAXIMO_PERGUNTAS_BLOCO_TI}
                >
                  <Plus size={15} /> Adicionar pergunta
                </button>
                <button
                  type="button"
                  onClick={() => void enviarNovoBloco()}
                  disabled={enviando || !perguntasBlocoTIValidas(perguntasNovoBloco)}
                  className="comunicacao-ti-modal__enviar"
                >
                  {enviando
                    ? <Loader2 size={16} className="comunicacao-ti__girando" />
                    : <Send size={16} />}
                  {enviando ? "Enviando..." : "Enviar perguntas"}
                </button>
              </div>
            </section>
          )}

          {blocoAberto?.estado === "aguardando_solicitante" && papelUsuario === "solicitante" && (
            <div className="comunicacao-ti-bloco__finalizacao">
              <span>
                {blocoAberto.totalRespondidas} de {blocoAberto.totalPerguntas} respondidas
              </span>
              <button
                type="button"
                onClick={() => void finalizarBloco()}
                disabled={!blocoAberto.todasRespondidas || finalizando}
                className="comunicacao-ti-modal__enviar"
              >
                {finalizando
                  ? <Loader2 size={16} className="comunicacao-ti__girando" />
                  : <CheckCircle2 size={16} />}
                {finalizando ? "Enviando..." : "Enviar respostas para a TI"}
              </button>
            </div>
          )}

          {!podeCriarBloco && !podeEscreverChat
            && !(blocoAberto?.estado === "aguardando_solicitante" && papelUsuario === "solicitante") && (
            <p className="comunicacao-ti-modal__informativo">{estadoInformativo}</p>
          )}
          {podeEscreverChat && (
            <>
              <textarea
                value={mensagem}
                onChange={(event) => {
                  setMensagem(event.target.value);
                  if (erro) setErro("");
                }}
                maxLength={LIMITE_MENSAGEM_COMUNICACAO_TI}
                placeholder="Digite sua mensagem..."
                rows={3}
                disabled={enviando || encerrando}
                autoFocus
              />
              <div className="comunicacao-ti-modal__composer-acoes">
                <span>{mensagem.length} / {LIMITE_MENSAGEM_COMUNICACAO_TI}</span>
                <button
                  type="button"
                  onClick={enviar}
                  disabled={enviando || encerrando || !mensagem.trim()}
                  className="comunicacao-ti-modal__enviar"
                >
                  {enviando ? <Loader2 size={16} className="comunicacao-ti__girando" /> : <Send size={16} />}
                  {enviando ? "Enviando..." : "Enviar"}
                </button>
              </div>
            </>
          )}

          {erro && (
            <div className="comunicacao-ti-modal__erro" role="alert">
              {erro}
              {!enviando && (
                <button type="button" onClick={() => void carregar()}>
                  Tentar novamente
                </button>
              )}
            </div>
          )}

          {podeEncerrar && (
            <button
              type="button"
              onClick={encerrar}
              disabled={enviando || encerrando}
              className="comunicacao-ti-modal__encerrar"
            >
              {encerrando ? "Encerrando..." : "Encerrar conversa"}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
