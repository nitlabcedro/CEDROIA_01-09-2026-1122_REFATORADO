import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  validarESerializarAtribuicoes,
  validarPayloadAtualizacaoAtribuicoes,
  type SetorParaValidacao,
} from "./administracao-atribuicoes.servico";

const USER_ID = "123e4567-e89b-42d3-a456-426614174000";
const setores: SetorParaValidacao[] = [
  { name: "NIT", cargos: ["Analista", "Gerente"], status: "Ativo" },
  { name: "TI", cargos: ["Analista", "Desenvolvedor"], status: "Ativo" },
  { name: "RH", cargos: ["Coordenador"], status: "Inativo" },
];

const payload = (atribuicoes: Array<{ setor: string; cargo: string }>) => ({
  userId: USER_ID,
  atribuicoes,
});

describe("atribuições administrativas de usuário", () => {
  it("1. valida e serializa um vínculo", () => {
    const dados = validarPayloadAtualizacaoAtribuicoes(
      payload([{ setor: "NIT", cargo: "Gerente" }]),
    );
    assert.deepEqual(validarESerializarAtribuicoes(dados.atribuicoes, setores), {
      setor: "NIT",
      cargo: "Gerente",
    });
  });

  it("2. valida e serializa múltiplos vínculos", () => {
    const dados = validarPayloadAtualizacaoAtribuicoes(
      payload([
        { setor: "NIT", cargo: "Gerente" },
        { setor: "TI", cargo: "Desenvolvedor" },
      ]),
    );
    assert.deepEqual(validarESerializarAtribuicoes(dados.atribuicoes, setores), {
      setor: "NIT; TI",
      cargo: "Gerente; Desenvolvedor",
    });
  });

  it("3b. serializa o mesmo setor e cargo para um usuário sem consultar ocupação de outras contas", () => {
    const dados = validarPayloadAtualizacaoAtribuicoes(
      payload([{ setor: "NIT", cargo: "Analista" }]),
    );
    assert.deepEqual(validarESerializarAtribuicoes(dados.atribuicoes, setores), {
      setor: "NIT",
      cargo: "Analista",
    });
  });

  it("3. permite o mesmo cargo em setores diferentes", () => {
    const dados = validarPayloadAtualizacaoAtribuicoes(
      payload([
        { setor: "NIT", cargo: "Analista" },
        { setor: "TI", cargo: "Analista" },
      ]),
    );
    assert.deepEqual(validarESerializarAtribuicoes(dados.atribuicoes, setores), {
      setor: "NIT; TI",
      cargo: "Analista; Analista",
    });
  });

  it("4. rejeita setor duplicado", () => {
    assert.throws(
      () => validarPayloadAtualizacaoAtribuicoes(payload([
        { setor: "NIT", cargo: "Analista" },
        { setor: "NIT", cargo: "Gerente" },
      ])),
      /mesmo setor/i,
    );
  });

  it("5. rejeita cargo inválido para o setor", () => {
    assert.throws(
      () => validarESerializarAtribuicoes(
        [{ setor: "NIT", cargo: "Desenvolvedor" }],
        setores,
      ),
      /não pertence ao setor/i,
    );
  });

  it("6. rejeita setor inexistente", () => {
    assert.throws(
      () => validarESerializarAtribuicoes(
        [{ setor: "Financeiro", cargo: "Analista" }],
        setores,
      ),
      /não existe/i,
    );
  });

  it("7. rejeita setor inativo", () => {
    assert.throws(
      () => validarESerializarAtribuicoes(
        [{ setor: "RH", cargo: "Coordenador" }],
        setores,
      ),
      /não está ativo/i,
    );
  });

  it("9. rejeita payload tentando alterar role", () => {
    assert.throws(
      () => validarPayloadAtualizacaoAtribuicoes({
        ...payload([{ setor: "NIT", cargo: "Analista" }]),
        role: "admin",
      }),
      /campo não permitido: role/i,
    );
  });

  it("10. rejeita payload tentando alterar sector_locked", () => {
    assert.throws(
      () => validarPayloadAtualizacaoAtribuicoes({
        ...payload([{ setor: "NIT", cargo: "Analista" }]),
        sector_locked: false,
      }),
      /campo não permitido: sector_locked/i,
    );
  });

  it("11. preserva a ordem Setor[n] -> Cargo[n]", () => {
    const atribuicoes = [
      { setor: "TI", cargo: "Desenvolvedor" },
      { setor: "NIT", cargo: "Gerente" },
    ];
    assert.deepEqual(validarESerializarAtribuicoes(atribuicoes, setores), {
      setor: "TI; NIT",
      cargo: "Desenvolvedor; Gerente",
    });
  });

  it("rejeita lista vazia e userId inválido", () => {
    assert.throws(
      () => validarPayloadAtualizacaoAtribuicoes(payload([])),
      /pelo menos uma atribuição/i,
    );
    assert.throws(
      () => validarPayloadAtualizacaoAtribuicoes({
        userId: "não-é-uuid",
        atribuicoes: [{ setor: "NIT", cargo: "Analista" }],
      }),
      /usuário alvo inválido/i,
    );
  });
});
