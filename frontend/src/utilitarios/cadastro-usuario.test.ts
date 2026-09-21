import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  criarMetadataCadastro,
  manterCargoAoTrocarSetor,
  normalizarSetoresAtivos,
  podeEnviarCadastro,
  validarAtribuicaoCadastro,
} from "./cadastro-usuario";

const setores = normalizarSetoresAtivos([
  { name: "NIT", cargos: ["Gerente", "Coordenador"], status: "Ativo" },
  { name: "TI", cargos: ["Desenvolvedor"], status: "Ativo" },
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
});
