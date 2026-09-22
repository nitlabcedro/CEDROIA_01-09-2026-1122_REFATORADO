import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  normalizarSetoresAtivos,
  validarAtribuicaoCadastro,
  validarAtribuicoesCadastro,
  validarDuplicidadesAtribuicoesCadastro,
} from "../../utilitarios/cadastro-usuario";
import { serializarAtribuicoesPerfil } from "../../utilitarios/perfil-usuario";

const perfil = readFileSync(new URL("./PerfilUsuario.tsx", import.meta.url), "utf8");
const contexto = readFileSync(new URL("../../contextos/ContextoAutenticacao.tsx", import.meta.url), "utf8");

const setores = normalizarSetoresAtivos([
  { name: "NIT", cargos: ["Moderação"], status: "Ativo" },
  { name: "Almoxarifado", cargos: ["COORDENADOR", "ANALISTA"], status: "Ativo" },
  { name: "Anatomia Patológica", cargos: ["COORDENADOR"], status: "Ativo" },
  { name: "Apoio", cargos: ["COORDENADOR"], status: "Ativo" },
]);

const perfilComCargoRepetido = [
  { setor: "NIT", cargo: "Moderação" },
  { setor: "Almoxarifado", cargo: "COORDENADOR" },
  { setor: "Anatomia Patológica", cargo: "COORDENADOR" },
  { setor: "Apoio", cargo: "COORDENADOR" },
];

describe("leitura de múltiplas atribuições no perfil", () => {
  it("carrega pares a partir de perfis com fallback de metadata", () => {
    assert.match(perfil, /resolverAtribuicoesPerfil\(profile,\s*metadata\)/);
    assert.match(perfil, /user\?\.user_metadata/);
    assert.match(perfil, /serializarAtribuicoesPerfil\(atribuicoes\)/);
  });

  it("exibe e contabiliza todos os pares sem reduzir a combos\[0\]", () => {
    assert.match(perfil, /atribuicoesExibidas\.map/);
    assert.match(perfil, /data-contagem-pares=\{contagemAtribuicoes\.pares\}/);
    assert.match(perfil, /data-contagem-setores=\{contagemAtribuicoes\.setores\}/);
    assert.match(perfil, /data-contagem-cargos=\{contagemAtribuicoes\.cargos\}/);
    assert.doesNotMatch(perfil, /combos\[0\]/);
    assert.match(perfil, /perfil__elemento-2--principal/);
    assert.match(perfil, /perfil__elemento-2--adicional/);
  });

  it("não apaga pares adicionais ao salvar nome ou foto", () => {
    assert.match(perfil, /serializarAtribuicoesPerfil\(editCombos\)/);
    assert.match(perfil, /serializarAtribuicoesPerfil\(atribuicoesCarregadas\)/);
    assert.match(perfil, /refreshProfile\(\{ avatar_url: finalAvatarUrl \}\)/);
    assert.match(contexto, /setProfile\(\(prev\) => mesclarAtualizacaoPerfil\(prev,\s*updatedFields\)\)/);
    assert.match(contexto, /sincronizarAtribuicoesPerfilPendentes\(userId\)/);
    assert.doesNotMatch(contexto, /preferirAtribuicoesMaisCompletas/);
  });
});

describe("edição de perfil: mesmo cargo em setores diferentes", () => {
  it("mostra todos os cargos do setor no dropdown, mesmo se o cargo já foi escolhido em outro setor", () => {
    assert.match(perfil, /options=\{cargosPorSetor\[combo\.setor\] \|\| \[\]\}/);
    assert.doesNotMatch(perfil, /itemIndex !== index && item\.cargo === cargo/);
    assert.match(
      perfil,
      /setor === combo\.setor \|\| !editCombos\.some\(\(item, itemIndex\) => \(\s*itemIndex !== index && item\.setor === setor/,
    );
  });

  it("permite salvar COORDENADOR repetido em setores diferentes e preserva a ordem", () => {
    assert.equal(validarDuplicidadesAtribuicoesCadastro(perfilComCargoRepetido), null);
    assert.equal(validarAtribuicoesCadastro(perfilComCargoRepetido, setores), null);
    assert.deepEqual(serializarAtribuicoesPerfil(perfilComCargoRepetido), {
      setor: "NIT; Almoxarifado; Anatomia Patológica; Apoio",
      cargo: "Moderação; COORDENADOR; COORDENADOR; COORDENADOR",
    });
  });

  it("bloqueia setor repetido e cargo que não pertence ao setor", () => {
    assert.equal(
      validarDuplicidadesAtribuicoesCadastro([
        { setor: "Almoxarifado", cargo: "COORDENADOR" },
        { setor: "Almoxarifado", cargo: "ANALISTA" },
      ]),
      "Não é permitido selecionar o mesmo setor mais de uma vez.",
    );
    assert.equal(
      validarAtribuicaoCadastro(
        { setor: "NIT", cargo: "COORDENADOR" },
        setores,
      ),
      "O cargo selecionado não pertence ao setor informado.",
    );
  });
});
