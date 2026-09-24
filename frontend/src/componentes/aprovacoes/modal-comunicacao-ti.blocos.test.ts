import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ler = (relativo: string) => readFileSync(
  fileURLToPath(new URL(relativo, import.meta.url)),
  "utf8",
);

describe("ModalComunicacaoTI — blocos estruturados", () => {
  const componente = ler("./ModalComunicacaoTI.tsx");
  const estilos = ler("../../estilos/componentes/comunicacao-ti.css");

  it("oferece criação explícita de 1 a 10 perguntas com contador e remoção", () => {
    assert.match(componente, /MAXIMO_PERGUNTAS_BLOCO_TI/);
    assert.match(componente, /Adicionar pergunta/);
    assert.match(componente, /Remover pergunta/);
    assert.match(componente, /Enviar perguntas/);
    assert.match(componente, /LIMITE_PERGUNTA_BLOCO_TI/);
  });

  it("usa labels reais sem botão ou estado de salvamento individual", () => {
    assert.match(componente, /htmlFor=\{`resposta-bloco-/);
    assert.match(componente, /id=\{`resposta-bloco-/);
    assert.doesNotMatch(componente, />Salvar resposta</);
    assert.doesNotMatch(componente, /"Salvando\.\.\."/);
    assert.doesNotMatch(componente, /Erro ao salvar/);
    assert.doesNotMatch(componente, /setTimeout[\s\S]*salvarRespostaBlocoTI/);
  });

  it("salva respostas locais válidas antes de finalizar e bloqueia repetição", () => {
    assert.match(componente, /respostasLocaisBlocoTIValidas/);
    assert.match(componente, /salvarEFinalizarRespostasBlocoTI/);
    assert.match(componente, /salvarRespostaBlocoTI\(blocoAberto\.id, perguntaId, resposta\)/);
    assert.match(componente, /finalizarBlocoRespostasTI\(blocoAberto\.id\)/);
    assert.doesNotMatch(componente, /blocoAberto\?\.todasRespondidas/);
    assert.match(componente, /Após enviar, as respostas não poderão mais ser alteradas/);
    assert.match(componente, /travaFinalizacaoRef/);
    assert.match(componente, /Enviar respostas para a TI/);
    assert.match(componente, /disabled=\{!todasRespostasLocaisValidas \|\| finalizando\}/);
    assert.match(componente, /disabled=\{finalizando\}/);
  });

  it("preserva chat, legado e vários blocos no histórico", () => {
    assert.match(componente, /interacao\.modo === "bloco"/);
    assert.match(componente, /interacao\.modo !== "bloco"/);
    assert.match(componente, /interacoesOrdenadas\.map/);
    assert.match(componente, /TI • Bloco de perguntas/);
    assert.match(componente, /Não respondida/);
  });

  it("protege textos longos e mantém layout móvel sem scroll horizontal", () => {
    for (const regra of [
      "overflow-wrap: anywhere",
      "word-break: break-word",
      "white-space: pre-wrap",
      "max-width: 100%",
      "min-width: 0",
      "overflow-x: hidden",
      "@media (max-width: 640px)",
    ]) {
      assert.match(estilos, new RegExp(regra.replace(/[()]/g, "\\$&")));
    }
  });
});
