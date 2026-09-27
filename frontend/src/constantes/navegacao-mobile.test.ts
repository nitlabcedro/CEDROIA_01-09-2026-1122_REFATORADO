import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  acaoCentralAtiva,
  obterAcaoCentral,
  obterItensPainelMais,
  painelMaisAtivo,
} from "@/constantes/navegacao-mobile";

describe("navegação inferior mobile", () => {
  it("define Nova Solicitação como ação central do usuário comum", () => {
    assert.deepEqual(obterAcaoCentral(false), { aba: "new", rotulo: "Nova" });
  });

  it("define Aprovação de IAs como ação central do administrador", () => {
    assert.deepEqual(obterAcaoCentral(true), { aba: "approval_queue", rotulo: "Aprovação" });
  });

  it("define Aprovação de IAs como ação central do moderador", () => {
    assert.deepEqual(obterAcaoCentral(true), { aba: "approval_queue", rotulo: "Aprovação" });
  });

  it("mostra só Meu Perfil no Mais do usuário comum", () => {
    assert.deepEqual(obterItensPainelMais(false, false), ["profile"]);
  });

  it("mostra Nova Solicitação, Administração IA e Meu Perfil no Mais do moderador", () => {
    assert.deepEqual(obterItensPainelMais(false, true), ["new", "admin", "profile"]);
  });

  it("mostra Nova Solicitação, Mapa, Setores, Administração e Perfil no Mais do administrador", () => {
    assert.deepEqual(obterItensPainelMais(true, true), [
      "new",
      "sectors",
      "sectors_mgr",
      "admin",
      "profile",
    ]);
  });

  it("marca o botão central e o Mais conforme a aba ativa e o papel", () => {
    assert.equal(acaoCentralAtiva("new", false), true);
    assert.equal(painelMaisAtivo("new", false), false);

    assert.equal(acaoCentralAtiva("approval_queue", true), true);
    assert.equal(painelMaisAtivo("approval_queue", true), false);

    assert.equal(acaoCentralAtiva("new", true), false);
    assert.equal(painelMaisAtivo("new", true), true);

    assert.equal(painelMaisAtivo("profile", false), true);
    assert.equal(painelMaisAtivo("admin", true), true);
    assert.equal(painelMaisAtivo("sectors", true), true);
    assert.equal(painelMaisAtivo("sectors_mgr", true), true);
    assert.equal(painelMaisAtivo("dashboard", false), false);
    assert.equal(painelMaisAtivo("chat", true), false);
  });
});
