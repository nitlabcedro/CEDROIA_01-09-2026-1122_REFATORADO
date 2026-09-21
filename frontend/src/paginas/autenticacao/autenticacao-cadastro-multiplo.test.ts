import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const autenticacao = readFileSync(
  new URL("./Autenticacao.tsx", import.meta.url),
  "utf8",
);
const estilos = readFileSync(
  new URL("../../estilos/paginas/autenticacao.css", import.meta.url),
  "utf8",
);

describe("cadastro com múltiplas atribuições", () => {
  it("restaura a inclusão e permite remover somente atribuições adicionais", () => {
    assert.match(autenticacao, /\+ Adicionar outro cargo\/setor/);
    assert.match(
      autenticacao,
      /setCombos\(\[\.\.\.combos,\s*\{\s*setor:\s*"",\s*cargo:\s*""\s*\}\]\)/,
    );
    assert.match(autenticacao, /\{index > 0 && \(/);
    assert.match(autenticacao, /setCombos\(combos\.filter\(\(_,\s*i\) => i !== index\)\)/);
  });

  it("remove setores e cargos já escolhidos das opções adicionais", () => {
    assert.match(autenticacao, /itemIndex !== index && item\.setor === setor/);
    assert.match(autenticacao, /itemIndex !== index && item\.cargo === cargo/);
    assert.match(autenticacao, /validarAtribuicoesCadastro\(combos,\s*sectors\)/);
  });

  it("mantém o primeiro par no metadata e persiste a lista no perfil", () => {
    assert.match(autenticacao, /const atribuicaoPrincipal = combos\[0\]/);
    assert.match(
      autenticacao,
      /const atribuicoesSerializadas = serializarAtribuicoesCadastro\(combos,\s*sectors\)/,
    );
    assert.match(autenticacao, /guardarAtribuicoesPerfilPendentes\(userId,\s*atribuicoesSerializadas\)/);
    assert.match(autenticacao, /persistirAtribuicoesPerfil\(userId,\s*atribuicoesSerializadas/);
    assert.match(autenticacao, /removerAtribuicoesPerfilPendentes\(userId\)/);
    assert.doesNotMatch(autenticacao, /profileData[\s\S]*combos\[0\]/);
  });

  it("empilha atribuições sem criar largura horizontal", () => {
    assert.match(
      estilos,
      /\.autenticacao-signup__atribuicao\s*\{[^}]*width:\s*100%;[^}]*min-width:\s*0;/s,
    );
    assert.match(estilos, /\.pagina-autenticacao[^}]*overflow-x:\s*hidden;/s);
  });
});
