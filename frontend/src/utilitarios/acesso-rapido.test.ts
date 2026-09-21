import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { obterAtalhosAcessoRapido } from "./acesso-rapido";

describe("acesso rápido do dashboard", () => {
  it("usa as rotas centrais oficiais", () => {
    const atalhos = obterAtalhosAcessoRapido({ isAdmin: true, isPrivileged: true });
    const rotas = Object.fromEntries(atalhos.map((atalho) => [atalho.aba, atalho.rota]));

    assert.deepEqual(rotas, {
      new: "/nova-solicitacao",
      inventory: "/inventario",
      approval_queue: "/aprovacoes",
      report: "/relatorios",
      sectors: "/mapa-ias",
      admin: "/administracao",
    });
  });

  it("exibe Administração para usuário privilegiado segundo a regra existente", () => {
    const atalhos = obterAtalhosAcessoRapido({ isAdmin: false, isPrivileged: true });
    assert.equal(atalhos.some((atalho) => atalho.aba === "admin"), true);
  });

  it("oculta Administração de usuário sem permissão", () => {
    const atalhos = obterAtalhosAcessoRapido({ isAdmin: false, isPrivileged: false });
    assert.equal(atalhos.some((atalho) => atalho.aba === "admin"), false);
  });

  it("respeita também as permissões existentes de Aprovações e Mapa de IAs", () => {
    const comum = obterAtalhosAcessoRapido({ isAdmin: false, isPrivileged: false });
    const moderador = obterAtalhosAcessoRapido({ isAdmin: false, isPrivileged: true });

    assert.equal(comum.some((atalho) => atalho.aba === "approval_queue"), false);
    assert.equal(moderador.some((atalho) => atalho.aba === "approval_queue"), true);
    assert.equal(moderador.some((atalho) => atalho.aba === "sectors"), false);
  });
});
