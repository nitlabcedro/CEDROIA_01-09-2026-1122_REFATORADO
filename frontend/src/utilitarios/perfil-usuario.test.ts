import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  contarAtribuicoesPerfil,
  definirSetorInicialSolicitacao,
  mesclarAtualizacaoPerfil,
  obterAtribuicoesPerfil,
  mesclarPerfilBuscado,
  obterCargoPrincipal,
  obterCargoVinculadoAoSetor,
  obterRotuloNivelAcesso,
  obterSetorPrincipal,
  obterSetoresVinculadosPerfil,
  resolverAtribuicoesPerfil,
} from "./perfil-usuario";

describe("apresentação do perfil do usuário", () => {
  it("renderiza setor e cargo reais sem fallback de cargo", () => {
    assert.deepEqual(obterAtribuicoesPerfil("NIT", "Gerente"), [
      { setor: "NIT", cargo: "Gerente" },
    ]);
    assert.equal(obterCargoPrincipal("Gerente"), "Gerente");
    assert.deepEqual(obterAtribuicoesPerfil("NIT", ""), [
      { setor: "NIT", cargo: "" },
    ]);
  });

  it("mantém role user internamente e exibe o rótulo Usuário", () => {
    const role = "user";

    assert.equal(role, "user");
    assert.equal(obterRotuloNivelAcesso(role), "Usuário");
    assert.notEqual(obterRotuloNivelAcesso(role), "Colaborador");
  });

  it("carrega múltiplas atribuições na mesma ordem persistida", () => {
    assert.deepEqual(
      obterAtribuicoesPerfil("NIT; TI", "Coordenador; Desenvolvedor"),
      [
        { setor: "NIT", cargo: "Coordenador" },
        { setor: "TI", cargo: "Desenvolvedor" },
      ],
    );
    assert.equal(obterCargoPrincipal("Coordenador; Desenvolvedor"), "Coordenador");
  });

  it("exibe dois e três pares reconstruídos por índice", () => {
    assert.deepEqual(
      obterAtribuicoesPerfil(
        "Núcleo de Inovação e Tecnologia;Tecnologia da Informação",
        "Moderação;Analista",
      ),
      [
        { setor: "Núcleo de Inovação e Tecnologia", cargo: "Moderação" },
        { setor: "Tecnologia da Informação", cargo: "Analista" },
      ],
    );

    assert.deepEqual(
      obterAtribuicoesPerfil("NIT; TI; RH", "Gerente; Analista; Coordenador"),
      [
        { setor: "NIT", cargo: "Gerente" },
        { setor: "TI", cargo: "Analista" },
        { setor: "RH", cargo: "Coordenador" },
      ],
    );
  });

  it("conta setores e cargos únicos sem reduzir ao primeiro par", () => {
    const dois = obterAtribuicoesPerfil(
      "Núcleo de Inovação e Tecnologia; Tecnologia da Informação",
      "Moderação; Analista",
    );
    assert.deepEqual(contarAtribuicoesPerfil(dois), {
      pares: 2,
      setores: 2,
      cargos: 2,
    });

    const tres = obterAtribuicoesPerfil("NIT; TI; RH", "Gerente; Analista; Coordenador");
    assert.deepEqual(contarAtribuicoesPerfil(tres), {
      pares: 3,
      setores: 3,
      cargos: 3,
    });
  });

  it("usa metadata só quando o perfil está vazio e nunca substitui lista completa", () => {
    assert.deepEqual(
      resolverAtribuicoesPerfil({ setor: "", cargo: "" }, { setor: "NIT", cargo: "Gerente" }),
      [{ setor: "NIT", cargo: "Gerente" }],
    );

    assert.deepEqual(
      resolverAtribuicoesPerfil(
        { setor: "NIT; TI", cargo: "Moderação; Analista" },
        { setor: "NIT", cargo: "Moderação" },
      ),
      [
        { setor: "NIT", cargo: "Moderação" },
        { setor: "TI", cargo: "Analista" },
      ],
    );
  });

  it("preserva pares adicionais ao salvar nome ou foto", () => {
    const persistido = {
      id: "user-1",
      full_name: "Nome Original",
      setor: "NIT; TI",
      cargo: "Moderação; Analista",
      status: "Autorizado" as const,
    };

    const aposNome = mesclarAtualizacaoPerfil(persistido, {
      full_name: "Nome Alterado",
    });
    assert.equal(aposNome.setor, persistido.setor);
    assert.equal(aposNome.cargo, persistido.cargo);

    const aposFoto = mesclarAtualizacaoPerfil(persistido, {
      avatar_url: "https://example.test/avatar.png",
    });
    assert.equal(aposFoto.setor, persistido.setor);
    assert.equal(aposFoto.cargo, persistido.cargo);
  });

  it("expõe somente setores vinculados e associa o cargo pelo mesmo índice", () => {
    const setor = "NIT; TI; RH";
    const cargo = "Gerente; Analista; Coordenador";
    assert.deepEqual(obterSetoresVinculadosPerfil(setor), ["NIT", "TI", "RH"]);
    assert.equal(obterCargoVinculadoAoSetor("TI", setor, cargo), "Analista");
    assert.equal(definirSetorInicialSolicitacao(["NIT"]), "NIT");
    assert.equal(definirSetorInicialSolicitacao(["NIT", "TI"]), "");
    assert.equal(definirSetorInicialSolicitacao(["NIT", "TI"], "TI"), "TI");
  });

  it("expõe setor principal e mescla perfil buscado com sessão nula", () => {
    assert.equal(
      obterSetorPrincipal("Núcleo de Inovação e Tecnologia;Tecnologia da Informação"),
      "Núcleo de Inovação e Tecnologia",
    );

    const perfil = {
      id: "user-1",
      full_name: "Usuário",
      setor: "NIT; TI",
      cargo: "Moderação; Analista",
      status: "Autorizado" as const,
    };
    assert.deepEqual(mesclarPerfilBuscado(null, perfil), perfil);
  });
});
