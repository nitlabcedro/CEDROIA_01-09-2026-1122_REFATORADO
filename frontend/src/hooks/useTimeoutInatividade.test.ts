import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ler = (relativo: string) => readFileSync(
  fileURLToPath(new URL(relativo, import.meta.url)),
  "utf8",
);

describe("integração do timeout de inatividade", () => {
  const hook = ler("./useTimeoutInatividade.ts");
  const aplicacao = ler("../Aplicacao.tsx");
  const util = ler("../utilitarios/timeout-inatividade.ts");
  const contexto = ler("../contextos/ContextoAutenticacao.tsx");

  it("Aplicacao liga o controle só com usuário autenticado e logout local", () => {
    assert.match(aplicacao, /useTimeoutInatividade\(\{/);
    assert.match(aplicacao, /ativo: Boolean\(user\)/);
    assert.match(aplicacao, /signOut\(\{ somenteLocal: true \}\)/);
  });

  it("hook não chama refreshSession nem limpa tokens sb-* manualmente", () => {
    assert.doesNotMatch(hook, /refreshSession/);
    assert.doesNotMatch(hook, /sb-/);
    assert.doesNotMatch(hook, /supabase\.auth/);
    assert.match(hook, /CHAVES_ARMAZENAMENTO_LOCAL\.ULTIMA_ATIVIDADE/);
  });

  it("utilitário mede só atividade humana e logout duplicado é barrado", () => {
    assert.match(util, /encerrando = true/);
    assert.doesNotMatch(util, /refreshSession/);
    assert.doesNotMatch(util, /supabase/);
    assert.match(util, /pointerdown/);
    assert.doesNotMatch(util, /mousemove/);
  });

  it("logout manual do contexto permanece inalterado", () => {
    assert.match(contexto, /scope: opcoes\.somenteLocal \? "local" : "global"/);
  });
});
