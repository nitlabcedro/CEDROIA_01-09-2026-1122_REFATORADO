import type { ErrorRequestHandler } from "express";

export const tratarErros: ErrorRequestHandler = (erro, _req, res, _next) => {
  const mensagem = erro instanceof Error ? erro.message : "Erro interno do servidor";

  console.error("[ERRO]", mensagem);

  res.status(500).json({
    sucesso: false,
    mensagem,
    error: mensagem,
  });
};
