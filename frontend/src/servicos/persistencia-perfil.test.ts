import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  guardarAtribuicoesPerfilPendentes,
  lerAtribuicoesPerfilPendentes,
  sincronizarAtribuicoesPerfilPendentes,
} from "./persistencia-perfil";
import { obterAtribuicoesPerfil } from "../utilitarios/perfil-usuario";

class ArmazenamentoMemoria {
  private dados = new Map<string, string>();

  getItem(chave: string) {
    return this.dados.get(chave) ?? null;
  }

  setItem(chave: string, valor: string) {
    this.dados.set(chave, valor);
  }

  removeItem(chave: string) {
    this.dados.delete(chave);
  }
}

describe("persistência das atribuições do perfil", () => {
  for (const caso of [
    { setor: "NIT", cargo: "Gerente", quantidade: 1 },
    { setor: "NIT; TI", cargo: "Gerente; Analista", quantidade: 2 },
    { setor: "NIT; TI; RH", cargo: "Gerente; Analista; Coordenador", quantidade: 3 },
  ]) {
    it(`persiste e recupera ${caso.quantidade} par(es) em uma nova sessão`, async () => {
      const storage = new ArmazenamentoMemoria();
      const banco = new Map<string, { setor?: string | null; cargo?: string | null }>();
      const userId = `user-${caso.quantidade}`;

      guardarAtribuicoesPerfilPendentes(userId, caso, storage);
      await sincronizarAtribuicoesPerfilPendentes(
        userId,
        storage,
        async (id, atribuicoes) => {
          banco.set(id, { ...atribuicoes });
          return banco.get(id)!;
        },
      );

      const lidoEmNovaSessao = banco.get(userId)!;
      assert.equal(
        obterAtribuicoesPerfil(lidoEmNovaSessao.setor, lidoEmNovaSessao.cargo).length,
        caso.quantidade,
      );
      assert.equal(lerAtribuicoesPerfilPendentes(userId, storage), null);
    });
  }

  it("falha se a gravação confirmar apenas combos[0] e mantém a pendência", async () => {
    const storage = new ArmazenamentoMemoria();
    const userId = "user-regressao";
    guardarAtribuicoesPerfilPendentes(
      userId,
      { setor: "NIT; TI; RH", cargo: "Gerente; Analista; Coordenador" },
      storage,
    );

    await assert.rejects(
      sincronizarAtribuicoesPerfilPendentes(
        userId,
        storage,
        async () => ({ setor: "NIT", cargo: "Gerente" }),
      ),
      /não confirmou todas as atribuições/i,
    );
    assert.ok(lerAtribuicoesPerfilPendentes(userId, storage));
  });
});
