import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  criarMetadataCadastro,
  manterCargoAoTrocarSetor,
  normalizarSetoresAtivos,
  podeEnviarAtribuicoesCadastro,
  podeEnviarCadastro,
  serializarAtribuicoesCadastro,
  validarAtribuicaoCadastro,
  validarAtribuicoesCadastro,
} from "./cadastro-usuario";

const setores = normalizarSetoresAtivos([
  { name: "NIT", cargos: ["Gerente", "Coordenador"], status: "Ativo" },
  { name: "TI", cargos: ["Desenvolvedor"], status: "Ativo" },
  { name: "RH", cargos: ["Gerente", "Analista"], status: "Ativo" },
  { name: "Inativo", cargos: ["Gerente"], status: "Inativo" },
]);

describe("cadastro de usuário", () => {
  it("rejeita cadastro sem setor", () => {
    assert.equal(
      validarAtribuicaoCadastro({ setor: "", cargo: "Gerente" }, setores),
      "Selecione um setor.",
    );
    assert.equal(podeEnviarCadastro({ setor: "", cargo: "Gerente" }, setores), false);
  });

  it("rejeita cadastro sem cargo", () => {
    assert.equal(
      validarAtribuicaoCadastro({ setor: "NIT", cargo: "" }, setores),
      "Selecione um cargo.",
    );
    assert.equal(podeEnviarCadastro({ setor: "NIT", cargo: "" }, setores), false);
  });

  it("rejeita cargo que não pertence ao setor ativo", () => {
    assert.equal(
      validarAtribuicaoCadastro({ setor: "NIT", cargo: "Desenvolvedor" }, setores),
      "O cargo selecionado não pertence ao setor informado.",
    );
    assert.equal(
      validarAtribuicaoCadastro({ setor: "Inativo", cargo: "Gerente" }, setores),
      "O cargo selecionado não pertence ao setor informado.",
    );
  });

  it("limpa o cargo anterior ao trocar para setor incompatível", () => {
    assert.equal(manterCargoAoTrocarSetor("Gerente", "TI", setores), "");
    assert.equal(manterCargoAoTrocarSetor("Gerente", "NIT", setores), "Gerente");
  });

  it("envia exatamente full_name, setor e cargo no metadata", () => {
    const metadata = criarMetadataCadastro(
      { fullName: " Ivaldo Pontes Figueiredo ", setor: "NIT", cargo: "Gerente" },
      setores,
    );

    assert.deepEqual(metadata, {
      full_name: "Ivaldo Pontes Figueiredo",
      setor: "NIT",
      cargo: "Gerente",
    });
    assert.equal("role" in metadata, false);
    assert.equal(Object.values(metadata).includes("Geral"), false);
    assert.equal(Object.values(metadata).includes("Colaborador"), false);
  });

  it("valida e serializa uma ou várias atribuições preservando a principal", () => {
    assert.equal(
      podeEnviarAtribuicoesCadastro([{ setor: "NIT", cargo: "Gerente" }], setores),
      true,
    );

    const atribuicoes = [
      { setor: "NIT", cargo: "Coordenador" },
      { setor: "TI", cargo: "Desenvolvedor" },
    ];

    assert.equal(validarAtribuicoesCadastro(atribuicoes, setores), null);
    assert.deepEqual(serializarAtribuicoesCadastro(atribuicoes, setores), {
      setor: "NIT; TI",
      cargo: "Coordenador; Desenvolvedor",
    });
  });

  it("impede setor ou cargo duplicado", () => {
    assert.equal(
      validarAtribuicoesCadastro([
        { setor: "NIT", cargo: "Gerente" },
        { setor: "NIT", cargo: "Coordenador" },
      ], setores),
      "Não é permitido selecionar o mesmo setor mais de uma vez.",
    );

    assert.equal(
      validarAtribuicoesCadastro([
        { setor: "NIT", cargo: "Gerente" },
        { setor: "RH", cargo: "Gerente" },
      ], setores),
      "Não é permitido selecionar o mesmo cargo mais de uma vez.",
    );
  });

  it("volta a uma atribuição válida após remover o item adicional", () => {
    const atribuicoes = [
      { setor: "NIT", cargo: "Coordenador" },
      { setor: "TI", cargo: "Desenvolvedor" },
    ];

    const semAdicional = atribuicoes.filter((_, indice) => indice !== 1);
    assert.equal(validarAtribuicoesCadastro(semAdicional, setores), null);
    assert.deepEqual(serializarAtribuicoesCadastro(semAdicional, setores), {
      setor: "NIT",
      cargo: "Coordenador",
    });
  });
});
