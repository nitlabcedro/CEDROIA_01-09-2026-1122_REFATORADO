import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const fonte = readFileSync(
  resolve(process.cwd(), "frontend/src/paginas/administracao/GerenciadorSetores.tsx"),
  "utf8",
);

describe("GerenciadorSetores — ocupantes e busca", () => {
  it("agrupa vários usuários no mesmo cargo na visualização do setor", () => {
    assert.match(fonte, /agruparOcupantesPorCargo\(selectedSectorName,\s*formCargos,\s*profiles\)/);
    assert.match(fonte, /grupo\.usuarios\.map/);
    assert.doesNotMatch(fonte, /cargo\.usuario\b/);
  });

  it("protege a busca contra name/responsible indefinidos e pesquisa só nome e responsável", () => {
    assert.match(fonte, /setorCorrespondeBusca\(searchTerm/);
    assert.match(fonte, /textoMinusculoSeguro/);
    assert.match(fonte, /normalizarDetalhesSetor\(/);
    assert.match(fonte, /sec\.name/);
    assert.match(fonte, /sec\.responsible/);
    assert.doesNotMatch(fonte, /sec\.description/);
    assert.doesNotMatch(
      fonte,
      /sec\.responsible\.toLowerCase\(\)/,
    );
  });

  it("não possui campo, estado ou persistência de description", () => {
    assert.doesNotMatch(fonte, /formDescription/);
    assert.doesNotMatch(fonte, /Histórico \/ Descrição/);
    assert.doesNotMatch(fonte, /setor-cartao__descricao/);
    assert.doesNotMatch(fonte, /description:/);
    assert.match(fonte, /fetchSectorsList\(\)/);
  });

  it("salva edição pelo submit do formulário, sem disparar o handler duas vezes", () => {
    assert.match(fonte, /<form onSubmit=\{handleSaveForm\}/);
    assert.match(fonte, /type="submit"/);
    assert.doesNotMatch(fonte, /onClick=\{handleSaveForm\}/);
  });

  it("conta colaboradores pelo par setor/cargo e não pela string inteira de perfis.setor", () => {
    assert.match(fonte, /perfilPertenceAoSetor\(p,\s*sectorName\)/);
    assert.doesNotMatch(
      fonte,
      /\(p\.setor \|\| ""\)\.trim\(\)\.toLowerCase\(\) === sectorName/,
    );
  });
});
