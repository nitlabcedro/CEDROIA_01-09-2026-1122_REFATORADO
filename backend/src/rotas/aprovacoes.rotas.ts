import { Router } from "express";

import {
  decidir,
  detalhar,
  inicializar,
  listar,
  obterConfiguracao,
  resumir,
  salvarConfiguracao,
  redefinirStatus,
  cancelar,
} from "../controladores/aprovacoes.controlador";
import { autenticar } from "../middlewares/autenticacao.middleware";
import { autorizarPapeis } from "../middlewares/autorizacao.middleware";
import {
  criarBloco as criarBlocoTI,
  criarSolicitacao as criarSolicitacaoTI,
  finalizarBloco as finalizarBlocoTI,
  salvarRespostaBloco as salvarRespostaBlocoTI,
  encerrarConversa as encerrarConversaTI,
  enviarMensagem as enviarMensagemTI,
  enviarRespostas as enviarRespostasTI,
  listarInteracoes as listarInteracoesTI,
  listarPendencias as listarPendenciasTI,
  listarPendenciasResponsavel as listarPendenciasResponsavelTI,
  salvarRascunho as salvarRascunhoTI,
} from "../controladores/interacoes-ti.controlador";

const aprovacoesRotas = Router();

aprovacoesRotas.use(autenticar);
aprovacoesRotas.get("/config", obterConfiguracao);
aprovacoesRotas.put("/config", autorizarPapeis("admin"), salvarConfiguracao);
aprovacoesRotas.get("/list", listar);
aprovacoesRotas.get("/summary", resumir);
aprovacoesRotas.get("/detail/:recordId", detalhar);
aprovacoesRotas.post("/init", inicializar);
aprovacoesRotas.post("/decide", decidir);
aprovacoesRotas.post("/reset-status", autorizarPapeis("admin"), redefinirStatus);
aprovacoesRotas.post("/cancel", cancelar);
aprovacoesRotas.get("/ti-interactions/pending", listarPendenciasTI);
aprovacoesRotas.get("/ti-interactions/pending-ti", listarPendenciasResponsavelTI);
aprovacoesRotas.get("/ti-interactions", listarInteracoesTI);
aprovacoesRotas.post("/ti-interactions/blocks", criarBlocoTI);
aprovacoesRotas.post("/ti-interactions/request", criarSolicitacaoTI);
aprovacoesRotas.put("/ti-interactions/:id/questions/:questionId", salvarRespostaBlocoTI);
aprovacoesRotas.post("/ti-interactions/:id/finalize", finalizarBlocoTI);
aprovacoesRotas.post("/ti-interactions/:id/message", enviarMensagemTI);
aprovacoesRotas.post("/ti-interactions/:id/close-round", encerrarConversaTI);
aprovacoesRotas.put("/ti-interactions/:id/draft", salvarRascunhoTI);
aprovacoesRotas.post("/ti-interactions/:id/submit", enviarRespostasTI);


export { aprovacoesRotas };
