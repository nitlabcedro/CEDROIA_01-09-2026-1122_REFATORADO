import { Router } from "express";

import { autenticar } from "../middlewares/autenticacao.middleware";
import { autorizarPapeis } from "../middlewares/autorizacao.middleware";
import { excluirRegistroIa } from "../servicos/registros-exclusao.servico";
import { gerarProximoIdRegistro } from "../servicos/registros-ia-id.servico";

const registrosRotas = Router();

registrosRotas.use(autenticar);
registrosRotas.post("/next-id", gerarProximoIdRegistro);
registrosRotas.delete("/:id", autorizarPapeis("admin"), excluirRegistroIa);

export { registrosRotas };
