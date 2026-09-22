import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const COLUNAS_UPDATE_AUTHENTICATED = [
  "full_name",
  "setor",
  "cargo",
  "contato",
  "avatar_url",
  "updated_at",
  "last_seen",
] as const;

function ler(relativo: string): string {
  return readFileSync(resolve(process.cwd(), relativo), "utf8");
}

describe("compatibilidade dos fluxos oficiais com UPDATE column-level em perfis", () => {
  it("E) o fluxo oficial de Administração continua usando backend + service_role", () => {
    const rotas = ler("backend/src/rotas/administracao.rotas.ts");
    const controlador = ler("backend/src/controladores/administracao.controlador.ts");
    const cliente = ler("backend/src/configuracoes/supabase.ts");
    const hook = ler("frontend/src/hooks/useAplicacao.ts");
    const api = ler("frontend/src/constantes/api.ts");

    assert.match(rotas, /administracaoRotas\.post\("\/update-role",\s*atualizarPapelUsuario\)/);
    assert.match(controlador, /\.update\(\{\s*role:\s*newRole\s*\}\)/);
    assert.match(controlador, /obterClienteSupabase\(\)/);
    assert.match(cliente, /ambiente\.supabaseServiceRoleKey/);
    assert.match(cliente, /A Service Role permanece restrita ao processo de backend/);
    assert.match(api, /ADMIN_ATUALIZAR_ROLE:\s*"\/api\/admin\/update-role"/);
    assert.match(hook, /requisicaoApi\(ROTAS_API\.ADMIN_ATUALIZAR_ROLE/);
  });

  it('F) "Fazer Admin" e "Revogar Admin" não dependem de UPDATE direto do frontend', () => {
    const painel = ler("frontend/src/paginas/administracao/PainelAdministrativo.tsx");
    const hook = ler("frontend/src/hooks/useAplicacao.ts");
    const aplicacao = ler("frontend/src/Aplicacao.tsx");

    assert.match(painel, /Fazer Admin/);
    assert.match(painel, /Revogar Admin/);
    assert.match(painel, /await onUpdateUserRole\(userProfile\.id, newRole\)/);
    assert.match(aplicacao, /onUpdateUserRole=\{handleUpdateUserRole\}/);

    const corpoRole = hook.slice(hook.indexOf("const handleUpdateUserRole"));
    const fimFuncao = corpoRole.search(/\n  const handleDeleteUser/);
    const handle = fimFuncao > 0 ? corpoRole.slice(0, fimFuncao) : corpoRole;

    assert.match(handle, /ROTAS_API\.ADMIN_ATUALIZAR_ROLE/);
    assert.doesNotMatch(handle, /TABELAS_SUPABASE\.PERFIS[\s\S]*\.update\(/);
    assert.doesNotMatch(handle, /\.from\([^\)]*perfis[^\)]*\)[\s\S]*\.update\(/);
  });

  it("G) persistencia-perfil.ts continua compatível com as colunas permitidas", () => {
    const persistencia = ler("frontend/src/servicos/persistencia-perfil.ts");

    assert.match(persistencia, /\.upsert\(campos,\s*\{\s*onConflict:\s*"id"\s*\}\)/);
    assert.match(persistencia, /id:\s*userId/);
    assert.match(persistencia, /setor:\s*normalizadas\.setor/);
    assert.match(persistencia, /cargo:\s*normalizadas\.cargo/);
    assert.match(persistencia, /updated_at:\s*new Date\(\)\.toISOString\(\)/);
    assert.match(persistencia, /campos\.full_name/);
    assert.match(persistencia, /campos\.contato/);
    assert.match(persistencia, /campos\.avatar_url/);
    assert.doesNotMatch(persistencia, /\brole\b/);
    assert.doesNotMatch(persistencia, /sector_locked/);

    const camposUpdate = ["setor", "cargo", "updated_at", "full_name", "contato", "avatar_url"];
    for (const coluna of camposUpdate) {
      assert.ok(
        (COLUNAS_UPDATE_AUTHENTICATED as readonly string[]).includes(coluna),
        `${coluna} do persistencia-perfil não está na lista de UPDATE permitido`,
      );
    }
  });

  it("H) heartbeat last_seen continua compatível", () => {
    const hook = ler("frontend/src/hooks/useAplicacao.ts");
    const armazenamento = ler("frontend/src/servicos/armazenamento.ts");

    assert.match(hook, /updateUserProfile\(user\.id,\s*\{\s*last_seen:\s*new Date\(\)\.toISOString\(\)\s*\}\)/);
    assert.match(armazenamento, /export const updateUserProfile/);
    assert.match(armazenamento, /TABELAS_SUPABASE\.PERFIS/);
    assert.match(armazenamento, /\.update\(sanitizedUpdates\)/);
    assert.ok((COLUNAS_UPDATE_AUTHENTICATED as readonly string[]).includes("last_seen"));
  });

  it("I) atualização de avatar continua compatível", () => {
    const perfil = ler("frontend/src/paginas/autenticacao/PerfilUsuario.tsx");
    const controlador = ler("backend/src/controladores/usuarios.controlador.ts");
    const persistencia = ler("frontend/src/servicos/persistencia-perfil.ts");

    assert.match(perfil, /ROTAS_API\.AVATAR_UPLOAD/);
    assert.match(controlador, /obterClienteSupabase\(\)/);
    assert.match(
      controlador,
      /\.update\(\{\s*avatar_url:\s*publicUrl,\s*updated_at:\s*new Date\(\)\.toISOString\(\)\s*\}\)/,
    );
    assert.match(persistencia, /if \(complementares\.avatar_url != null\)/);
    assert.ok((COLUNAS_UPDATE_AUTHENTICATED as readonly string[]).includes("avatar_url"));
    assert.ok((COLUNAS_UPDATE_AUTHENTICATED as readonly string[]).includes("updated_at"));
  });
});
