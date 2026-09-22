import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AbaAplicacao } from "../constantes/navegacao";
import {
  criarUrlNavegacao,
  interpretarUrlNavegacao,
  urlsNavegacaoIguais,
} from "./navegacao";

const ROTAS_ESPERADAS: Array<[AbaAplicacao, string]> = [
  ["dashboard", "/painel"],
  ["inventory", "/inventario"],
  ["new", "/nova-solicitacao"],
  ["report", "/relatorios"],
  ["profile", "/perfil"],
  ["chat", "/chat"],
  ["sectors", "/mapa-ias"],
  ["admin", "/administracao"],
  ["sectors_mgr", "/setores"],
  ["approval_queue", "/aprovacoes"],
];

describe("navegação por URL", () => {
  it("converte todas as abas em rotas estáveis", () => {
    for (const [aba, rota] of ROTAS_ESPERADAS) {
      assert.equal(criarUrlNavegacao(aba), rota);
    }
  });

  it("converte todas as rotas em abas", () => {
    for (const [aba, rota] of ROTAS_ESPERADAS) {
      assert.deepEqual(interpretarUrlNavegacao(rota), {
        tipo: "aba",
        aba,
      });
    }
  });

  it("normaliza barra final sem confundir a rota", () => {
    assert.deepEqual(interpretarUrlNavegacao("/inventario/"), {
      tipo: "aba",
      aba: "inventory",
    });
  });

  it("preserva o identificador necessário ao relatório", () => {
    const id = "IA-00000005";
    assert.equal(criarUrlNavegacao("report", { registroId: id }), `/relatorios?id=${id}`);
    assert.deepEqual(interpretarUrlNavegacao("/relatorios", `?id=${id}`), {
      tipo: "aba",
      aba: "report",
      registroId: id,
    });
  });

  it("codifica identificadores e aceita URL completa no parsing", () => {
    const id = "IA Cedro/05";
    assert.equal(
      criarUrlNavegacao("new", { registroId: id }),
      "/nova-solicitacao?id=IA+Cedro%2F05",
    );
    assert.deepEqual(
      interpretarUrlNavegacao("https://ia.labcedro.app/nova-solicitacao?id=IA+Cedro%2F05"),
      {
        tipo: "aba",
        aba: "new",
        registroId: id,
      },
    );
  });

  it("distingue raiz, reset de senha e rota desconhecida", () => {
    assert.deepEqual(interpretarUrlNavegacao("/"), { tipo: "raiz" });
    assert.deepEqual(interpretarUrlNavegacao("/reset-password"), {
      tipo: "reset-password",
    });
    assert.deepEqual(interpretarUrlNavegacao("/reset-password/"), {
      tipo: "reset-password",
    });
    assert.deepEqual(interpretarUrlNavegacao("/rota-inexistente"), {
      tipo: "invalida",
    });
  });

  it("compara pathname e parâmetros para evitar histórico duplicado", () => {
    assert.equal(
      urlsNavegacaoIguais(
        "https://ia.labcedro.app/inventario",
        "/inventario",
      ),
      true,
    );
    assert.equal(
      urlsNavegacaoIguais(
        "/relatorios?id=IA-00000005",
        "/relatorios?id=IA-00000006",
      ),
      false,
    );
  });
});
