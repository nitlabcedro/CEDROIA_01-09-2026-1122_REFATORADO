import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

function ler(caminho: string) {
  return readFileSync(resolve(process.cwd(), caminho), "utf8");
}

const rotas = ler("backend/src/rotas/administracao.rotas.ts");
const controlador = ler("backend/src/controladores/administracao.controlador.ts");
const middleware = ler("backend/src/middlewares/autorizacao.middleware.ts");
const painel = ler("frontend/src/paginas/administracao/PainelAdministrativo.tsx");
const modal = ler("frontend/src/paginas/administracao/ModalEditarAtribuicoesUsuario.tsx");
const hook = ler("frontend/src/hooks/useAplicacao.ts");

describe("integração administrativa de setor/cargo", () => {
  it("8. endpoint exige JWT e role admin, retornando 403 ao papel não autorizado", () => {
    assert.match(rotas, /administracaoRotas\.use\(autenticar,\s*autorizarPapeis\("admin"\)\)/);
    assert.match(rotas, /administracaoRotas\.post\("\/update-assignments",\s*atualizarAtribuicoesUsuario\)/);
    assert.match(middleware, /res\.status\(403\)/);
  });

  it("backend usa service_role e atualiza somente setor, cargo e updated_at", () => {
    const inicio = controlador.indexOf("export async function atualizarAtribuicoesUsuario");
    const fim = controlador.indexOf("export async function atualizarPapelUsuario");
    const corpo = controlador.slice(inicio, fim);

    assert.match(corpo, /const supabaseAdmin = obterClienteSupabase\(\)/);
    assert.match(
      corpo,
      /\.update\(\{\s*setor:\s*serializadas\.setor,\s*cargo:\s*serializadas\.cargo,\s*updated_at:\s*new Date\(\)\.toISOString\(\),?\s*\}\)/,
    );
    assert.doesNotMatch(corpo, /\.update\(\{[\s\S]*\b(role|sector_locked|email|full_name|avatar_url|id)\s*:/);
    assert.match(corpo, /\.select\("id,setor,cargo"\)/);
  });

  it("12. resposta mescla setor/cargo em profiles sem remover a role existente", () => {
    assert.match(hook, /perfilAtual\.id === userId/);
    assert.match(hook, /\.\.\.perfilAtual,\s*setor:\s*result\.profile\.setor,\s*cargo:\s*result\.profile\.cargo/);
    assert.match(hook, /setProfiles\(\(atuais\) =>/);
    assert.match(hook, /setProfilesCatalog\(\(atuais\) => atuais\.map\(mesclarAtribuicoes\)\)/);
    assert.doesNotMatch(
      hook.slice(
        hook.indexOf("const handleUpdateUserAssignments"),
        hook.indexOf("const handleUpdateUserRole"),
      ),
      /role:/,
    );
  });

  it("13. Fazer Admin e Revogar Admin permanecem em handler e endpoint independentes", () => {
    assert.match(painel, /Fazer Admin/);
    assert.match(painel, /Revogar Admin/);
    assert.match(hook, /ROTAS_API\.ADMIN_ATUALIZAR_ROLE/);
    assert.match(hook, /ROTAS_API\.ADMIN_ATUALIZAR_ATRIBUICOES/);
    assert.match(rotas, /post\("\/update-role",\s*atualizarPapelUsuario\)/);
  });

  it("14. tabela e cartões responsivos exibem Editar setor/cargo", () => {
    assert.equal((painel.match(/Editar setor\/cargo/g) || []).length, 2);
    assert.equal((painel.match(/setEditingAssignmentsUser\(userProfile\)/g) || []).length, 2);
    assert.equal(
      (painel.match(/isCurrentUserAdmin && onUpdateUserAssignments/g) || []).length,
      2,
    );
    assert.match(painel, /ModalEditarAtribuicoesUsuario/);
  });

  it("modal separa pares, filtra cargos pelo setor e controla salvamento/erro", () => {
    assert.match(modal, /obterAtribuicoesPerfil\(usuario\.setor,\s*usuario\.cargo\)/);
    assert.match(modal, /setorAtual\?\.cargos \|\| \[\]/);
    assert.match(modal, /validarAtribuicoesCadastro\(atribuicoes,\s*setores\)/);
    assert.match(modal, /Adicionar vínculo/);
    assert.match(modal, /Remover vínculo/);
    assert.match(modal, /Salvar alterações/);
    assert.match(modal, /salvando \? "Salvando\.\.\."/);
    assert.match(modal, /setErro\(error instanceof Error/);
    assert.doesNotMatch(modal, /\brole\s*:|sector_locked/);
  });
});
