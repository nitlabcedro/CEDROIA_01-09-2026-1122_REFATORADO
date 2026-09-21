import type { Request, Response } from "express";

import {
  criarBlocoPerguntasTI,
  criarSolicitacaoInformacoesTI,
  finalizarBlocoRespostasTI,
  salvarRespostaBlocoTI,
  encerrarConversaComunicacaoTI,
  enviarMensagemComunicacaoTI,
  enviarRespostasInformacoesTI,
  listarInteracoesTI,
  listarPendenciasResponsavelTI,
  listarPendenciasSolicitanteTI,
  salvarRascunhoInformacoesTI,
} from "../servicos/interacoes-ti.servico";

export function criarBloco(req: Request, res: Response) {
  return criarBlocoPerguntasTI(req, res);
}

export function salvarRespostaBloco(req: Request, res: Response) {
  return salvarRespostaBlocoTI(req, res);
}

export function finalizarBloco(req: Request, res: Response) {
  return finalizarBlocoRespostasTI(req, res);
}

export function listarInteracoes(req: Request, res: Response) {
  return listarInteracoesTI(req, res);
}

export function listarPendencias(req: Request, res: Response) {
  return listarPendenciasSolicitanteTI(req, res);
}

export function listarPendenciasResponsavel(req: Request, res: Response) {
  return listarPendenciasResponsavelTI(req, res);
}

export function criarSolicitacao(req: Request, res: Response) {
  return criarSolicitacaoInformacoesTI(req, res);
}

export function enviarMensagem(req: Request, res: Response) {
  return enviarMensagemComunicacaoTI(req, res);
}

export function encerrarConversa(req: Request, res: Response) {
  return encerrarConversaComunicacaoTI(req, res);
}

export function salvarRascunho(req: Request, res: Response) {
  return salvarRascunhoInformacoesTI(req, res);
}

export function enviarRespostas(req: Request, res: Response) {
  return enviarRespostasInformacoesTI(req, res);
}
