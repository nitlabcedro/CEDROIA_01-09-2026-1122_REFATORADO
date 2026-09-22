import { Router } from "express";

import { autenticar } from "../middlewares/autenticacao.middleware";
import { gerarProximoIdRegistro } from "../servicos/registros-ia-id.servico";

const registrosRotas = Router();

registrosRotas.use(autenticar);
registrosRotas.post("/next-id", gerarProximoIdRegistro);

export { registrosRotas };
