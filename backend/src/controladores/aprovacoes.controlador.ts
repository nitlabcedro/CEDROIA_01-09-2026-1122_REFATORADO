import type { Request, Response } from "express";

import {
  cancelarSolicitacao,
  decidirWorkflow,
  inicializarWorkflow,
  listarWorkflows,
  obterConfiguracaoWorkflow,
  obterWorkflowVisivel,
  resumirWorkflowsVisiveis,
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

export function resumir(req: Request, res: Response) {
  return resumirWorkflowsVisiveis(req, res);
}

export function detalhar(req: Request, res: Response) {
  return obterWorkflowVisivel(req, res);
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

export function cancelar(req: Request, res: Response) {
  return cancelarSolicitacao(req, res);
}
