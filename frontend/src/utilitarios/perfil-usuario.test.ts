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
  perfilImpedeEtapaSolicitacao,
  resolverAtribuicoesPerfil,
  resolverOpcoesSetorSolicitacao,
  setorSolicitacaoValido,
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

describe("setor da solicitação: criação x edição administrativa", () => {
  const SETOR_REGISTRO = "Núcleo de Inovação e Tecnologia";
  const SETORES_DO_ADMIN = ["Moderação"];
  const SETORES_ATIVOS = ["Moderação", "Núcleo de Inovação e Tecnologia", "Tecnologia da Informação"];

  it("A. criação comum continua limitada aos setores vinculados ao usuário", () => {
    const contexto = {
      edicaoAdministrativa: false,
      setoresVinculados: ["NIT", "TI"],
      setoresAtivos: SETORES_ATIVOS,
      setorOriginal: SETOR_REGISTRO,
    };

    assert.deepEqual(resolverOpcoesSetorSolicitacao(contexto), ["NIT", "TI"]);
    assert.equal(setorSolicitacaoValido("TI", contexto), true);
    assert.equal(setorSolicitacaoValido("RH", contexto), false);
    assert.equal(setorSolicitacaoValido(SETOR_REGISTRO, contexto), false);
  });

  it("B. admin abre solicitação de outro setor e o setor original aparece no seletor", () => {
    const contexto = {
      edicaoAdministrativa: true,
      setoresVinculados: SETORES_DO_ADMIN,
      setoresAtivos: SETORES_ATIVOS,
      setorOriginal: SETOR_REGISTRO,
    };

    assert.ok(resolverOpcoesSetorSolicitacao(contexto).includes(SETOR_REGISTRO));
    assert.equal(setorSolicitacaoValido(SETOR_REGISTRO, contexto), true);

    // O setor original continua na lista mesmo se já tiver saído dos setores ativos.
    assert.deepEqual(
      resolverOpcoesSetorSolicitacao({ ...contexto, setoresAtivos: ["Moderação"] }),
      [SETOR_REGISTRO, "Moderação"],
    );
    // E também antes de os setores ativos chegarem do Supabase.
    assert.deepEqual(
      resolverOpcoesSetorSolicitacao({ ...contexto, setoresAtivos: [] }),
      [SETOR_REGISTRO],
    );
  });

  it("C. admin salva sem alterar: o setor do registro permanece válido e único", () => {
    const contexto = {
      edicaoAdministrativa: true,
      setoresVinculados: SETORES_DO_ADMIN,
      setoresAtivos: SETORES_ATIVOS,
      setorOriginal: SETOR_REGISTRO,
    };

    const opcoes = resolverOpcoesSetorSolicitacao(contexto);
    assert.equal(opcoes.filter((setor) => setor === SETOR_REGISTRO).length, 1);
    assert.equal(setorSolicitacaoValido(SETOR_REGISTRO, contexto), true);
    // Nenhum fallback devolve o setor do administrador quando o registro já tem setor.
    assert.equal(
      definirSetorInicialSolicitacao(SETORES_DO_ADMIN, SETOR_REGISTRO),
      SETOR_REGISTRO,
    );
  });

  it("D. admin pode selecionar conscientemente qualquer outro setor ativo", () => {
    const contexto = {
      edicaoAdministrativa: true,
      setoresVinculados: SETORES_DO_ADMIN,
      setoresAtivos: SETORES_ATIVOS,
      setorOriginal: SETOR_REGISTRO,
    };

    assert.deepEqual(resolverOpcoesSetorSolicitacao(contexto), SETORES_ATIVOS);
    assert.equal(setorSolicitacaoValido("Tecnologia da Informação", contexto), true);
  });

  it("I. setor continua obrigatório na criação e na edição", () => {
    const criacao = { edicaoAdministrativa: false, setoresVinculados: ["NIT"] };
    const edicao = { edicaoAdministrativa: true, setoresVinculados: SETORES_DO_ADMIN };

    for (const vazio of ["", "   ", "Não definido", "Nao definido", null, undefined]) {
      assert.equal(setorSolicitacaoValido(vazio, criacao), false);
      assert.equal(setorSolicitacaoValido(vazio, edicao), false);
    }
    assert.equal(setorSolicitacaoValido("NIT", criacao), true);
  });
});

describe("completude de perfil: criação x edição administrativa", () => {
  const perfilCompleto = {
    full_name: "Ana Souza",
    setor: "NIT",
    cargo: "Analista",
  };
  const perfilIncompleto = {
    full_name: "Admin Sem Cargo",
    setor: "Moderação",
    cargo: "",
  };

  it("A. criação comum com perfil incompleto continua bloqueada", () => {
    assert.equal(perfilImpedeEtapaSolicitacao({
      edicaoAdministrativa: false,
      profile: perfilIncompleto,
    }), true);
    assert.equal(perfilImpedeEtapaSolicitacao({
      edicaoAdministrativa: false,
      profile: { full_name: "", setor: "NIT", cargo: "Analista" },
    }), true);
    assert.equal(perfilImpedeEtapaSolicitacao({
      edicaoAdministrativa: false,
      profile: null,
    }), true);
  });

  it("B. criação comum com perfil completo continua funcionando", () => {
    assert.equal(perfilImpedeEtapaSolicitacao({
      edicaoAdministrativa: false,
      profile: perfilCompleto,
    }), false);
  });

  it("C. admin com perfil incompleto consegue editar registro existente", () => {
    assert.equal(perfilImpedeEtapaSolicitacao({
      edicaoAdministrativa: true,
      profile: perfilIncompleto,
    }), false);
    assert.equal(perfilImpedeEtapaSolicitacao({
      edicaoAdministrativa: true,
      profile: { full_name: "", setor: "", cargo: "" },
    }), false);
  });

  it("D. admin com perfil completo continua editando normalmente", () => {
    assert.equal(perfilImpedeEtapaSolicitacao({
      edicaoAdministrativa: true,
      profile: perfilCompleto,
    }), false);
  });

  it("H. setor e cargo do registro não dependem do perfil do admin", () => {
    const setorRegistro = "Núcleo de Inovação e Tecnologia";
    const cargoRegistro = "Coordenador";
    assert.equal(
      definirSetorInicialSolicitacao(["Moderação"], setorRegistro),
      setorRegistro,
    );
    assert.notEqual(
      obterCargoVinculadoAoSetor(setorRegistro, "Moderação", "Administrador"),
      cargoRegistro,
    );
    assert.equal(
      obterCargoVinculadoAoSetor(setorRegistro, "Moderação", "Administrador"),
      "",
    );
  });
});
