import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  obterAtribuicoesPerfil,
  obterCargoPrincipal,
  obterRotuloNivelAcesso,
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
});
