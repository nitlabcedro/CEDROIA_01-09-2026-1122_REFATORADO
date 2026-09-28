import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  mesclarPerfilBuscado,
  obterAtribuicoesPerfil,
  obterCargoPrincipal,
  obterSetorPrincipal,
  resolverAtribuicoesPerfil,
} from "./perfil-usuario";

const raizFrontend = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("renderização segura com múltiplas atribuições", () => {
  it("A) usuário com 1 par reconstrói atribuições sem quebrar", () => {
    const atribuicoes = obterAtribuicoesPerfil("NIT", "Gerente");
    assert.equal(atribuicoes.length, 1);
    assert.equal(obterSetorPrincipal("NIT"), "NIT");
    assert.equal(obterCargoPrincipal("Gerente"), "Gerente");
  });

  it("B) usuário com 2 pares reconstrói atribuições sem quebrar", () => {
    const atribuicoes = obterAtribuicoesPerfil(
      "Núcleo de Inovação e Tecnologia;Tecnologia da Informação",
      "Moderação;Analista",
    );
    assert.equal(atribuicoes.length, 2);
    assert.equal(
      obterSetorPrincipal("Núcleo de Inovação e Tecnologia;Tecnologia da Informação"),
      "Núcleo de Inovação e Tecnologia",
    );
    assert.equal(obterCargoPrincipal("Moderação;Analista"), "Moderação");
  });

  it("C) usuário com 3 pares reconstrói atribuições sem quebrar", () => {
    assert.equal(
      obterAtribuicoesPerfil("NIT; TI; RH", "Gerente; Analista; Coordenador").length,
      3,
    );
  });

  it("D) setor/cargo null não quebram helpers centrais", () => {
    assert.deepEqual(obterAtribuicoesPerfil(null, null), []);
    assert.equal(obterSetorPrincipal(null), "");
    assert.equal(obterCargoPrincipal(undefined), "");
    assert.deepEqual(resolverAtribuicoesPerfil(null, null), []);
  });

  it("E) listas com quantidades diferentes usam fallback seguro por índice", () => {
    assert.deepEqual(obterAtribuicoesPerfil("NIT; TI", "Gerente"), [
      { setor: "NIT", cargo: "Gerente" },
      { setor: "TI", cargo: "" },
    ]);
  });

  it("mescla perfil buscado sem acessar avatar de sessão inexistente", () => {
    const dados = {
      id: "user-1",
      full_name: "Usuário Teste",
      setor: "NIT; TI",
      cargo: "Moderação; Analista",
      status: "Autorizado" as const,
    };

    assert.deepEqual(mesclarPerfilBuscado(null, dados), dados);

    const mesclado = mesclarPerfilBuscado(
      { ...dados, avatar_url: "blob:preview-local" },
      { ...dados, avatar_url: "https://cdn/perfil.png" },
    );
    assert.equal(mesclado.avatar_url, "blob:preview-local");
    assert.equal(mesclado.setor, dados.setor);
    assert.equal(mesclado.cargo, dados.cargo);
  });

  it("header e sidebar usam par principal nos resumos", () => {
    const barraSuperior = readFileSync(
      join(raizFrontend, "componentes/layout/BarraSuperior.tsx"),
      "utf8",
    );
    const barraLateral = readFileSync(
      join(raizFrontend, "componentes/layout/BarraLateral.tsx"),
      "utf8",
    );
    const contexto = readFileSync(
      join(raizFrontend, "contextos/ContextoAutenticacao.tsx"),
      "utf8",
    );

    assert.match(barraSuperior, /obterCargoPrincipal\(profile\?\.cargo\)/);
    assert.match(barraSuperior, /obterSetorPrincipal\(profile\?\.setor\)/);
    assert.match(barraLateral, /obterCargoPrincipal\(profile\?\.cargo\)/);
    assert.match(contexto, /mesclarPerfilBuscado\(prev, data as UserProfile\)/);
  });
});
