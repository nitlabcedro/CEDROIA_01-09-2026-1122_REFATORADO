import { Router } from "express";

import { enviarAvatar } from "../controladores/usuarios.controlador";
import { autenticar } from "../middlewares/autenticacao.middleware";

const usuariosRotas = Router();

usuariosRotas.post("/upload", autenticar, enviarAvatar);

export { usuariosRotas };
