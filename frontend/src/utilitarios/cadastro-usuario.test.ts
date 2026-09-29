import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  criarMetadataCadastro,
  filtrarNomeCompletoCadastro,
  manterCargoAoTrocarSetor,
  normalizarSetoresAtivos,
  podeEnviarAtribuicoesCadastro,
  podeEnviarCadastro,
  serializarAtribuicoesCadastro,
  validarAtribuicaoCadastro,
  validarAtribuicoesCadastro,
  validarNomeCompletoCadastro,
} from "./cadastro-usuario";

const setores = normalizarSetoresAtivos([
  { name: "NIT", cargos: ["Gerente", "Coordenador"], status: "Ativo" },
  { name: "TI", cargos: ["Desenvolvedor"], status: "Ativo" },
  { name: "RH", cargos: ["Gerente", "Analista"], status: "Ativo" },
  { name: "Gestão Administrativa", cargos: ["COORDENADOR", "ANALISTA"], status: "Ativo" },
  { name: "Núcleo de Inovação e Tecnologia", cargos: ["COORDENADOR"], status: "Ativo" },
  { name: "Anatomia Patológica", cargos: ["COORDENADOR"], status: "Ativo" },
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

  it("envia 1 par completo no metadata sem role nem sector_locked", () => {
    const metadata = criarMetadataCadastro(
      {
        fullName: " Ivaldo Pontes Figueiredo ",
        atribuicoes: [{ setor: "NIT", cargo: "Gerente" }],
      },
      setores,
    );

    assert.deepEqual(metadata, {
      full_name: "Ivaldo Pontes Figueiredo",
      setor: "NIT",
      cargo: "Gerente",
      atribuicoes: [{ setor: "NIT", cargo: "Gerente" }],
    });
    assert.equal("role" in metadata, false);
    assert.equal("sector_locked" in metadata, false);
    assert.equal(Object.values(metadata).includes("Geral"), false);
    assert.equal(Object.values(metadata).includes("Colaborador"), false);
  });

  it("envia 2 pares preservando ordem e o par principal em setor/cargo", () => {
    const metadata = criarMetadataCadastro(
      {
        fullName: "Ivaldo Pontes Figueiredo",
        atribuicoes: [
          { setor: "NIT", cargo: "Coordenador" },
          { setor: "TI", cargo: "Desenvolvedor" },
        ],
      },
      setores,
    );

    assert.deepEqual(metadata.atribuicoes, [
      { setor: "NIT", cargo: "Coordenador" },
      { setor: "TI", cargo: "Desenvolvedor" },
    ]);
    assert.equal(metadata.setor, "NIT");
    assert.equal(metadata.cargo, "Coordenador");
    assert.equal("role" in metadata, false);
    assert.equal("sector_locked" in metadata, false);
  });

  it("envia 3 pares preservando ordem e o par principal em setor/cargo", () => {
    const metadata = criarMetadataCadastro(
      {
        fullName: "Ivaldo Pontes Figueiredo",
        atribuicoes: [
          { setor: "NIT", cargo: "Coordenador" },
          { setor: "TI", cargo: "Desenvolvedor" },
          { setor: "RH", cargo: "Analista" },
        ],
      },
      setores,
    );

    assert.deepEqual(metadata.atribuicoes, [
      { setor: "NIT", cargo: "Coordenador" },
      { setor: "TI", cargo: "Desenvolvedor" },
      { setor: "RH", cargo: "Analista" },
    ]);
    assert.equal(metadata.setor, "NIT");
    assert.equal(metadata.cargo, "Coordenador");
    assert.equal(metadata.atribuicoes.length, 3);
  });

  it("rejeita metadata com cargo inválido, setor inexistente ou pares duplicados", () => {
    assert.throws(
      () => criarMetadataCadastro(
        {
          fullName: "Ivaldo",
          atribuicoes: [{ setor: "NIT", cargo: "Desenvolvedor" }],
        },
        setores,
      ),
      /não pertence ao setor/i,
    );

    assert.throws(
      () => criarMetadataCadastro(
        {
          fullName: "Ivaldo",
          atribuicoes: [{ setor: "Financeiro", cargo: "Gerente" }],
        },
        setores,
      ),
      /não pertence ao setor/i,
    );

    assert.throws(
      () => criarMetadataCadastro(
        {
          fullName: "Ivaldo",
          atribuicoes: [
            { setor: "NIT", cargo: "Gerente" },
            { setor: "NIT", cargo: "Coordenador" },
          ],
        },
        setores,
      ),
      /mesmo setor/i,
    );
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

  it("permite o mesmo cargo em setores diferentes e serializa na ordem", () => {
    const doisPares = [
      { setor: "Gestão Administrativa", cargo: "COORDENADOR" },
      { setor: "Núcleo de Inovação e Tecnologia", cargo: "COORDENADOR" },
    ];
    assert.equal(validarAtribuicoesCadastro(doisPares, setores), null);
    assert.equal(podeEnviarAtribuicoesCadastro(doisPares, setores), true);
    assert.deepEqual(serializarAtribuicoesCadastro(doisPares, setores), {
      setor: "Gestão Administrativa; Núcleo de Inovação e Tecnologia",
      cargo: "COORDENADOR; COORDENADOR",
    });

    const tresPares = [
      { setor: "Gestão Administrativa", cargo: "COORDENADOR" },
      { setor: "Núcleo de Inovação e Tecnologia", cargo: "COORDENADOR" },
      { setor: "Anatomia Patológica", cargo: "COORDENADOR" },
    ];
    assert.equal(validarAtribuicoesCadastro(tresPares, setores), null);
    assert.deepEqual(serializarAtribuicoesCadastro(tresPares, setores), {
      setor: "Gestão Administrativa; Núcleo de Inovação e Tecnologia; Anatomia Patológica",
      cargo: "COORDENADOR; COORDENADOR; COORDENADOR",
    });
  });

  it("bloqueia o mesmo setor mais de uma vez, mesmo com cargos iguais ou diferentes", () => {
    assert.equal(
      validarAtribuicoesCadastro([
        { setor: "Gestão Administrativa", cargo: "COORDENADOR" },
        { setor: "Gestão Administrativa", cargo: "ANALISTA" },
      ], setores),
      "Não é permitido selecionar o mesmo setor mais de uma vez.",
    );

    assert.equal(
      validarAtribuicoesCadastro([
        { setor: "Gestão Administrativa", cargo: "COORDENADOR" },
        { setor: "Gestão Administrativa", cargo: "COORDENADOR" },
      ], setores),
      "Não é permitido selecionar o mesmo setor mais de uma vez.",
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

  it("filtra e valida nome completo apenas com letras e acentos", () => {
    assert.equal(filtrarNomeCompletoCadastro("João123 Silva!"), "João Silva");
    assert.equal(filtrarNomeCompletoCadastro("José María Ção"), "José María Ção");
    assert.equal(validarNomeCompletoCadastro("  Maria José  "), null);
    assert.equal(validarNomeCompletoCadastro(""), "Informe o nome completo.");
    assert.equal(
      validarNomeCompletoCadastro("Ana2"),
      "O nome completo deve conter apenas letras e acentos.",
    );
  });

  it("permite o mesmo setor e o mesmo cargo em contas independentes", () => {
    const par = { setor: "NIT", cargo: "Gerente" };
    assert.equal(validarAtribuicaoCadastro(par, setores), null);
    assert.equal(validarAtribuicaoCadastro(par, setores), null);
    assert.equal(podeEnviarCadastro(par, setores), true);
    assert.equal(
      criarMetadataCadastro({ fullName: "Usuário A", atribuicoes: [par] }, setores).cargo,
      "Gerente",
    );
    assert.equal(
      criarMetadataCadastro({ fullName: "Usuário B", atribuicoes: [par] }, setores).cargo,
      "Gerente",
    );
  });
});
