import { Router } from "express";

import {
  decidir,
  inicializar,
  listar,
  obterConfiguracao,
  salvarConfiguracao,
  redefinirStatus,
} from "../controladores/aprovacoes.controlador";
import { autenticar } from "../middlewares/autenticacao.middleware";
import { autorizarPapeis } from "../middlewares/autorizacao.middleware";
import {
  criarSolicitacao as criarSolicitacaoTI,
  enviarRespostas as enviarRespostasTI,
  listarInteracoes as listarInteracoesTI,
  listarPendencias as listarPendenciasTI,
  salvarRascunho as salvarRascunhoTI,
} from "../controladores/interacoes-ti.controlador";

const aprovacoesRotas = Router();

aprovacoesRotas.use(autenticar);
aprovacoesRotas.get("/config", obterConfiguracao);
aprovacoesRotas.put("/config", autorizarPapeis("admin"), salvarConfiguracao);
aprovacoesRotas.get("/list", listar);
aprovacoesRotas.post("/init", inicializar);
aprovacoesRotas.post("/decide", decidir);
aprovacoesRotas.post("/reset-status", redefinirStatus);
aprovacoesRotas.get("/ti-interactions/pending", listarPendenciasTI);
aprovacoesRotas.get("/ti-interactions", listarInteracoesTI);
aprovacoesRotas.post("/ti-interactions/request", criarSolicitacaoTI);
aprovacoesRotas.put("/ti-interactions/:id/draft", salvarRascunhoTI);
aprovacoesRotas.post("/ti-interactions/:id/submit", enviarRespostasTI);


export { aprovacoesRotas };
