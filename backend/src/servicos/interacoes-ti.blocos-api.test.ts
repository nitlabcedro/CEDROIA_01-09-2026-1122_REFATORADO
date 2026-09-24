import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ler = (relativo: string) => readFileSync(
  fileURLToPath(new URL(relativo, import.meta.url)),
  "utf8",
);

describe("API de blocos estruturados TI", () => {
  const rotas = ler("../rotas/aprovacoes.rotas.ts");
  const servico = ler("./interacoes-ti.servico.ts");

  it("expõe endpoints separados para criar, salvar pergunta e finalizar", () => {
    assert.match(rotas, /post\("\/ti-interactions\/blocks", criarBlocoTI\)/);
    assert.match(rotas, /put\("\/ti-interactions\/:id\/questions\/:questionId", salvarRespostaBlocoTI\)/);
    assert.match(rotas, /post\("\/ti-interactions\/:id\/finalize", finalizarBlocoTI\)/);
  });

  it("usa identidade autenticada e não aceita papel ou usuário arbitrário", () => {
    for (const nome of [
      "criarBlocoPerguntasTI",
      "salvarRespostaBlocoTI",
      "finalizarBlocoRespostasTI",
    ]) {
      const inicio = servico.indexOf(`export async function ${nome}`);
      const fim = servico.indexOf("\nexport async function ", inicio + 1);
      const corpo = servico.slice(inicio, fim > inicio ? fim : undefined);
      assert.match(corpo, /obterUsuarioAutenticado\(req\)/);
      assert.doesNotMatch(corpo, /auth\.getUser/);
      assert.doesNotMatch(corpo, /req\.body\?\.(userId|requesterId|authorRole|isAdmin)/);
    }
  });

  it("mantém endpoints legados de rascunho e envio em lote", () => {
    assert.match(rotas, /put\("\/ti-interactions\/:id\/draft", salvarRascunhoTI\)/);
    assert.match(rotas, /post\("\/ti-interactions\/:id\/submit", enviarRespostasTI\)/);
    assert.match(servico, /current_turn !== null[\s\S]*Rascunho disponível somente para rodadas legadas/);
    assert.match(servico, /current_turn !== null[\s\S]*Envio em lote disponível somente para rodadas legadas/);
  });
});
