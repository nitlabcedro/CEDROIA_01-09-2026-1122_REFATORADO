import type { Request, Response } from "express";

import {
  decidirWorkflow,
  inicializarWorkflow,
  listarWorkflows,
  obterConfiguracaoWorkflow,
  salvarConfiguracaoWorkflow,
  redefinirStatusWorkflow,
} from "../servicos/aprovacao.servico";

export function obterConfiguracao(req: Request, res: Response) {
  return obterConfiguracaoWorkflow(req, res);
}

export function salvarConfiguracao(req: Request, res: Response) {
  return salvarConfiguracaoWorkflow(req, res);
}

export function listar(req: Request, res: Response) {
  return listarWorkflows(req, res);
}

export function inicializar(req: Request, res: Response) {
  return inicializarWorkflow(req, res);
}

export function decidir(req: Request, res: Response) {
  return decidirWorkflow(req, res);
}

export function redefinirStatus(req: Request, res: Response) {
  return redefinirStatusWorkflow(req, res);
}
