import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const fonte = readFileSync(new URL("./ContextoAutenticacao.tsx", import.meta.url), "utf8");

describe("ContextoAutenticacao e ciclo de refresh", () => {
  it("TOKEN_REFRESHED atualiza session/user sem redirecionar para login", () => {
    const inicioListener = fonte.indexOf("supabase.auth.onAuthStateChange");
    const fimListener = fonte.indexOf("return () => subscription.unsubscribe()", inicioListener);
    const listener = fonte.slice(inicioListener, fimListener);

    assert.match(listener, /event === "SIGNED_IN" \|\| event === "TOKEN_REFRESHED"/);
    assert.match(listener, /setSession\(session\)/);
    assert.match(listener, /setUser\(session\?\.user \?\? null\)/);
    assert.doesNotMatch(listener, /signOut\(/);
    assert.doesNotMatch(listener, /["'`]\/login["'`]/);
  });

  it("mantém um único listener e limpa a subscription no unmount", () => {
    assert.equal(fonte.match(/supabase\.auth\.onAuthStateChange\(/g)?.length, 1);
    assert.match(fonte, /return \(\) => subscription\.unsubscribe\(\)/);
  });

  it("erro transitório de getSession não apaga tokens nem chama signOut", () => {
    const inicio = fonte.indexOf("supabase.auth.getSession().then");
    const fimErroSincrono = fonte.indexOf("const session =", inicio);
    const inicioRejeicao = fonte.indexOf("}).catch((err) => {", fimErroSincrono);
    const fimRejeicao = fonte.indexOf("// Listen for changes", inicioRejeicao);
    const tratamentoErro =
      fonte.slice(inicio, fimErroSincrono)
      + fonte.slice(inicioRejeicao, fimRejeicao);

    assert.doesNotMatch(tratamentoErro, /localStorage\.removeItem/);
    assert.doesNotMatch(tratamentoErro, /auth\.signOut/);
    assert.match(tratamentoErro, /setLoading\(false\);\s*return;/);
  });

  it("logout manual continua chamando signOut e limpando estado local", () => {
    const inicio = fonte.indexOf("const signOut = async");
    const fim = fonte.indexOf("const finalizarRecuperacaoSenha", inicio);
    const logout = fonte.slice(inicio, fim);

    assert.match(logout, /await supabase\.auth\.signOut/);
    assert.match(logout, /limparTokensSupabaseLocais\(\)/);
    assert.match(logout, /limparEstadoAutenticacao\(\)/);
  });

  it("sessão realmente inexistente continua produzindo user/session nulos", () => {
    assert.match(fonte, /const session = data\?\.session \?\? null/);
    assert.match(fonte, /setSession\(session\)/);
    assert.match(fonte, /setUser\(session\?\.user \?\? null\)/);
  });
});
