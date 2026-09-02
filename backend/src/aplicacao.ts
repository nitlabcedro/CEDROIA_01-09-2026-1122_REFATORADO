import express from "express";

import { validarAmbiente } from "./configuracoes/ambiente";
import { aprovacoesRotas } from "./rotas/aprovacoes.rotas";
import { administracaoRotas } from "./rotas/administracao.rotas";
import { usuariosRotas } from "./rotas/usuarios.rotas";
import { tratarErros } from "./middlewares/erros.middleware";

validarAmbiente();

const app = express();
const rotasApi = express.Router();

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

rotasApi.use("/admin", administracaoRotas);
rotasApi.use("/avatar", usuariosRotas);
rotasApi.use("/workflow", aprovacoesRotas);

app.use("/api", rotasApi);
app.use("/.netlify/functions/api", rotasApi);
app.use(tratarErros);

export { app };
