import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { usuarioPodeConsultarInteracoesTI } from "./interacoes-ti.servico";

const ler = (relativo: string) => readFileSync(
  fileURLToPath(new URL(relativo, import.meta.url)),
  "utf8",
);

describe("autenticação das rotas de interações TI", () => {
  const rotas = ler("../rotas/aprovacoes.rotas.ts");
  const controlador = ler("../controladores/interacoes-ti.controlador.ts");
  const servico = ler("./interacoes-ti.servico.ts");
  const inicioObterUsuario = servico.indexOf("async function obterUsuarioAutenticado");
  const fimObterUsuario = servico.indexOf("\nexport function usuarioPodeConsultarInteracoesTI");
  const obterUsuario = servico.slice(inicioObterUsuario, fimObterUsuario);

  it("rotas TI passam pelo middleware autenticar e não revalidam JWT", () => {
    assert.match(rotas, /aprovacoesRotas\.use\(autenticar\)/);
    assert.match(rotas, /get\("\/ti-interactions\/pending"/);
    assert.match(rotas, /get\("\/ti-interactions\/pending-ti"/);
    assert.doesNotMatch(controlador, /auth\.getUser/);
    assert.doesNotMatch(servico, /auth\.getUser/);
    assert.doesNotMatch(obterUsuario, /getUser\s*\(/);
  });

  it("identidade da TI vem de req.usuarioAutenticado do middleware", () => {
    assert.match(obterUsuario, /usuarioAutenticado/);
    assert.match(obterUsuario, /if \(!usuario\?\.id\) throw new Error\("UNAUTHORIZED"\)/);
    assert.match(obterUsuario, /eq\("id", usuario\.id\)/);
    assert.match(obterUsuario, /user: usuario/);
    assert.doesNotMatch(obterUsuario, /req\.headers\.authorization/);
    assert.doesNotMatch(obterUsuario, /req\.body/);
    assert.doesNotMatch(obterUsuario, /req\.query/);
  });

  it("handlers TI continuam usando obterUsuarioAutenticado sem papel arbitrário do cliente", () => {
    const handlers = [
      "listarInteracoesTI",
      "listarPendenciasSolicitanteTI",
      "listarPendenciasResponsavelTI",
      "criarBlocoPerguntasTI",
      "criarSolicitacaoInformacoesTI",
      "salvarRespostaBlocoTI",
      "finalizarBlocoRespostasTI",
      "enviarMensagemComunicacaoTI",
      "encerrarConversaComunicacaoTI",
      "salvarRascunhoInformacoesTI",
      "enviarRespostasInformacoesTI",
    ];

    for (const nome of handlers) {
      const inicio = servico.indexOf(`export async function ${nome}`);
      assert.ok(inicio >= 0, `handler ausente: ${nome}`);
      const fim = servico.indexOf("\nexport async function ", inicio + 1);
      const corpo = servico.slice(inicio, fim > inicio ? fim : undefined);
      assert.match(corpo, /obterUsuarioAutenticado\(req\)/);
      assert.doesNotMatch(corpo, /req\.body\?\.(userId|requesterId|authorRole|isAdmin)/);
    }
  });

  it("permissões de consulta da TI permanecem iguais", () => {
    assert.equal(usuarioPodeConsultarInteracoesTI({
      userId: "admin-1",
      role: "ADMIN",
      ownerId: null,
      responsavelTiId: "ti-1",
    }), true);
    assert.equal(usuarioPodeConsultarInteracoesTI({
      userId: "solicitante-1",
      role: "user",
      ownerId: null,
      responsavelTiId: "ti-1",
    }), false);
    assert.equal(usuarioPodeConsultarInteracoesTI({
      userId: "ti-1",
      role: "user",
      ownerId: "solicitante-1",
      responsavelTiId: "ti-1",
    }), true);
    assert.equal(usuarioPodeConsultarInteracoesTI({
      userId: "outro-1",
      role: "user",
      ownerId: "solicitante-1",
      responsavelTiId: "ti-1",
    }), false);
  });
});
