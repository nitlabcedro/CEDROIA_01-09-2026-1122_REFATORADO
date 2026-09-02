import type { Request, Response } from "express";

import {
  criarSolicitacaoInformacoesTI,
  enviarRespostasInformacoesTI,
  listarInteracoesTI,
  listarPendenciasSolicitanteTI,
  salvarRascunhoInformacoesTI,
} from "../servicos/interacoes-ti.servico";

export function listarInteracoes(req: Request, res: Response) {
  return listarInteracoesTI(req, res);
}

export function listarPendencias(req: Request, res: Response) {
  return listarPendenciasSolicitanteTI(req, res);
}

export function criarSolicitacao(req: Request, res: Response) {
  return criarSolicitacaoInformacoesTI(req, res);
}

export function salvarRascunho(req: Request, res: Response) {
  return salvarRascunhoInformacoesTI(req, res);
}

export function enviarRespostas(req: Request, res: Response) {
  return enviarRespostasInformacoesTI(req, res);
}
