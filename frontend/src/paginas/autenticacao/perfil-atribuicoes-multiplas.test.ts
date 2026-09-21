import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const perfil = readFileSync(new URL("./PerfilUsuario.tsx", import.meta.url), "utf8");
const contexto = readFileSync(new URL("../../contextos/ContextoAutenticacao.tsx", import.meta.url), "utf8");

describe("leitura de múltiplas atribuições no perfil", () => {
  it("carrega pares a partir de perfis com fallback de metadata", () => {
    assert.match(perfil, /resolverAtribuicoesPerfil\(profile,\s*metadata\)/);
    assert.match(perfil, /user\?\.user_metadata/);
    assert.match(perfil, /serializarAtribuicoesPerfil\(atribuicoes\)/);
  });

  it("exibe e contabiliza todos os pares sem reduzir a combos\[0\]", () => {
    assert.match(perfil, /atribuicoesExibidas\.map/);
    assert.match(perfil, /data-contagem-pares=\{contagemAtribuicoes\.pares\}/);
    assert.match(perfil, /data-contagem-setores=\{contagemAtribuicoes\.setores\}/);
    assert.match(perfil, /data-contagem-cargos=\{contagemAtribuicoes\.cargos\}/);
    assert.doesNotMatch(perfil, /combos\[0\]/);
    assert.match(perfil, /perfil__elemento-2--principal/);
    assert.match(perfil, /perfil__elemento-2--adicional/);
  });

  it("não apaga pares adicionais ao salvar nome ou foto", () => {
    assert.match(perfil, /serializarAtribuicoesPerfil\(editCombos\)/);
    assert.match(perfil, /serializarAtribuicoesPerfil\(atribuicoesCarregadas\)/);
    assert.match(perfil, /refreshProfile\(\{ avatar_url: finalAvatarUrl \}\)/);
    assert.match(contexto, /setProfile\(\(prev\) => mesclarAtualizacaoPerfil\(prev,\s*updatedFields\)\)/);
    assert.match(contexto, /sincronizarAtribuicoesPerfilPendentes\(userId\)/);
    assert.doesNotMatch(contexto, /preferirAtribuicoesMaisCompletas/);
  });
});
