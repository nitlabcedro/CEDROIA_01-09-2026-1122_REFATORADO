import { Router } from "express";

import {
  atualizarAtribuicoesUsuario,
  atualizarPapelUsuario,
  excluirUsuario,
} from "../controladores/administracao.controlador";
import { autenticar } from "../middlewares/autenticacao.middleware";
import { autorizarPapeis } from "../middlewares/autorizacao.middleware";

const administracaoRotas = Router();

administracaoRotas.use(autenticar, autorizarPapeis("admin"));
administracaoRotas.post("/update-assignments", atualizarAtribuicoesUsuario);
administracaoRotas.post("/update-role", atualizarPapelUsuario);
administracaoRotas.post("/delete-user", excluirUsuario);

export { administracaoRotas };
