import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import type { UserProfile } from "../tipos";
import { aplicarPapelNaListaPerfis } from "../utilitarios/perfil-usuario";

function ler(relativo: string): string {
  return readFileSync(resolve(process.cwd(), relativo), "utf8");
}

const hook = ler("frontend/src/hooks/useAplicacao.ts");

const ALVO = "123e4567-e89b-42d3-a456-426614174000";
const OUTRO = "223e4567-e89b-42d3-a456-426614174111";

function criarPerfil(id: string, role: UserProfile["role"]): UserProfile {
  return {
    id,
    full_name: `Usuário ${id.slice(0, 4)}`,
    role,
    status: "Autorizado",
    setor: "NIT; TI",
    cargo: "Gerente; Analista",
    contato: "usuario@cedro.test",
    avatar_url: "https://cdn.cedro.test/avatar.png",
    last_seen: "2026-09-22T12:00:00.000Z",
    updated_at: "2026-09-22T11:00:00.000Z",
  };
}

/** Reproduz o trecho de sucesso do handleUpdateUserRole sobre os dois estados. */
function aplicarSucessoDaApi(
  profiles: UserProfile[],
  profilesCatalog: UserProfile[],
  userId: string,
  newRole: UserProfile["role"],
) {
  return {
    profiles: aplicarPapelNaListaPerfis(profiles, userId, newRole),
    profilesCatalog: aplicarPapelNaListaPerfis(profilesCatalog, userId, newRole),
  };
}

describe("atualização visual de role na Administração", () => {
  it("A) Fazer Admin atualiza o estado para admin", () => {
    const perfis = [criarPerfil(ALVO, "user"), criarPerfil(OUTRO, "user")];

    const atualizados = aplicarPapelNaListaPerfis(perfis, ALVO, "admin");

    assert.equal(atualizados.find((p) => p.id === ALVO)?.role, "admin");
    assert.equal(atualizados.find((p) => p.id === OUTRO)?.role, "user");
  });

  it("B) Revogar Admin atualiza o estado para user", () => {
    const perfis = [criarPerfil(ALVO, "admin"), criarPerfil(OUTRO, "admin")];

    const atualizados = aplicarPapelNaListaPerfis(perfis, ALVO, "user");

    assert.equal(atualizados.find((p) => p.id === ALVO)?.role, "user");
    assert.equal(atualizados.find((p) => p.id === OUTRO)?.role, "admin");
  });

  it("C) profiles é atualizado após o sucesso da API", () => {
    const resultado = aplicarSucessoDaApi(
      [criarPerfil(ALVO, "user")],
      [criarPerfil(ALVO, "user")],
      ALVO,
      "admin",
    );

    assert.equal(resultado.profiles[0].role, "admin");
    assert.match(hook, /setProfiles\(prev => \{\s*const atualizados = aplicarPapelNaListaPerfis\(prev, userId, newRole\)/);
  });

  it("D) profilesCatalog é atualizado após o sucesso da API", () => {
    const resultado = aplicarSucessoDaApi(
      [criarPerfil(ALVO, "user")],
      [criarPerfil(ALVO, "user")],
      ALVO,
      "admin",
    );

    assert.equal(resultado.profilesCatalog[0].role, "admin");
    assert.match(
      hook,
      /setProfilesCatalog\(prev => aplicarPapelNaListaPerfis\(prev, userId, newRole\)\)/,
    );
  });

  it("E) demais campos do perfil são preservados", () => {
    const original = criarPerfil(ALVO, "user");

    const [atualizado] = aplicarPapelNaListaPerfis([original], ALVO, "admin");

    assert.deepEqual(atualizado, { ...original, role: "admin" });
    assert.equal(atualizado.full_name, original.full_name);
    assert.equal(atualizado.setor, original.setor);
    assert.equal(atualizado.cargo, original.cargo);
    assert.equal(atualizado.avatar_url, original.avatar_url);
    assert.equal(atualizado.contato, original.contato);
    assert.equal(atualizado.last_seen, original.last_seen);
  });

  it("E) não substitui o perfil por uma resposta parcial do backend", () => {
    const corpoSucesso = hook.slice(
      hook.indexOf("if (result.success && result.profile)"),
      hook.indexOf("// Full refresh to ensure consistency across all data"),
    );

    assert.doesNotMatch(corpoSucesso, /\?\s*result\.profile\s*:/);
    assert.match(corpoSucesso, /seedProfilesCache\(atualizados\)/);
  });

  it("F) em erro da API o estado não é alterado", () => {
    const perfis = [criarPerfil(ALVO, "user")];
    const estadoAnterior = [...perfis];

    // Optimistic update seguido do rollback preservado no catch.
    const otimista = aplicarPapelNaListaPerfis(perfis, ALVO, "admin");
    assert.equal(otimista[0].role, "admin");

    const aposFalha = estadoAnterior;
    assert.deepEqual(aposFalha, perfis);
    assert.equal(aposFalha[0].role, "user");

    assert.match(hook, /const previousProfiles = \[\.\.\.profiles\]/);
    assert.match(hook, /\/\/ Rollback\s*\n\s*setProfiles\(previousProfiles\)/);

    const corpoCatch = hook.slice(hook.indexOf("❌ Erro fatal ao atualizar role"));
    assert.doesNotMatch(
      corpoCatch.slice(0, corpoCatch.indexOf("const handleDeleteUser")),
      /aplicarPapelNaListaPerfis/,
    );
  });

  it("G) nenhuma alteração foi feita no backend de role", () => {
    const controlador = ler("backend/src/controladores/administracao.controlador.ts");
    const rotas = ler("backend/src/rotas/administracao.rotas.ts");

    assert.match(controlador, /\.update\(\{\s*role:\s*newRole\s*\}\)/);
    assert.match(controlador, /papelEhAdmin\(requesterProfile\?\.role\)/);
    assert.match(rotas, /administracaoRotas\.post\("\/update-role",\s*atualizarPapelUsuario\)/);
    assert.match(hook, /requisicaoApi\(ROTAS_API\.ADMIN_ATUALIZAR_ROLE/);
  });
});
