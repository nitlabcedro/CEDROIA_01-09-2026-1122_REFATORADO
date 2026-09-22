import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

function ler(relativo: string): string {
  return readFileSync(resolve(process.cwd(), relativo), "utf8");
}

function extrairInsertAddRecord(fonte: string): string {
  const inicio = fonte.indexOf("export const addRecord");
  assert.ok(inicio >= 0, "addRecord não encontrado");
  const fimProximaExport = fonte.indexOf("export const updateRecord", inicio);
  const corpo = fimProximaExport > 0 ? fonte.slice(inicio, fimProximaExport) : fonte.slice(inicio);
  const match = corpo.match(
    /\.from\(TABELAS_SUPABASE\.PERFIS\)\s*\.insert\(\{([\s\S]*?)\}\)/,
  );
  assert.ok(match, "INSERT de public.perfis em addRecord não encontrado");
  return match[1];
}

describe("addRecord não envia colunas privilegiadas ao INSERT de perfis", () => {
  const armazenamento = ler("frontend/src/servicos/armazenamento.ts");
  const payloadInsert = extrairInsertAddRecord(armazenamento);

  it("A) addRecord nunca envia role ao INSERT de perfis", () => {
    assert.doesNotMatch(payloadInsert, /\brole\b/);
  });

  it("B) addRecord nunca envia sector_locked", () => {
    assert.doesNotMatch(payloadInsert, /sector_locked/);
  });

  it("C) o payload continua contendo os campos necessários", () => {
    assert.match(payloadInsert, /\bid:\s*resolvedOwnerId/);
    assert.match(payloadInsert, /\bfull_name:\s*record\.responsavelPreenchimento/);
    assert.match(payloadInsert, /\bsetor:\s*record\.unidadeSetor/);
    assert.match(payloadInsert, /\bcargo:\s*record\.cargo/);
    assert.match(payloadInsert, /\bupdated_at:\s*new Date\(\)\.toISOString\(\)/);
  });

  it("D) persistirAtribuicoesPerfil continua sem role/sector_locked", () => {
    const persistencia = ler("frontend/src/servicos/persistencia-perfil.ts");
    assert.match(persistencia, /\.upsert\(campos,\s*\{\s*onConflict:\s*"id"\s*\}\)/);
    assert.doesNotMatch(persistencia, /\brole\b/);
    assert.doesNotMatch(persistencia, /sector_locked/);
  });

  it("E) Fazer Admin/Revogar Admin continuam exclusivamente no backend", () => {
    const hook = ler("frontend/src/hooks/useAplicacao.ts");
    const rotas = ler("backend/src/rotas/administracao.rotas.ts");
    const painel = ler("frontend/src/paginas/administracao/PainelAdministrativo.tsx");

    assert.match(painel, /Fazer Admin/);
    assert.match(painel, /Revogar Admin/);
    assert.match(rotas, /administracaoRotas\.post\("\/update-role",\s*atualizarPapelUsuario\)/);

    const corpoRole = hook.slice(hook.indexOf("const handleUpdateUserRole"));
    const fimFuncao = corpoRole.search(/\n  const handleDeleteUser/);
    const handle = fimFuncao > 0 ? corpoRole.slice(0, fimFuncao) : corpoRole;
    assert.match(handle, /ROTAS_API\.ADMIN_ATUALIZAR_ROLE/);
    assert.doesNotMatch(handle, /TABELAS_SUPABASE\.PERFIS[\s\S]*\.update\(/);
  });

  it("F) edição administrativa de atribuições continua intacta", () => {
    const hook = ler("frontend/src/hooks/useAplicacao.ts");
    const rotas = ler("backend/src/rotas/administracao.rotas.ts");

    assert.match(rotas, /administracaoRotas\.post\("\/update-assignments",\s*atualizarAtribuicoesUsuario\)/);
    assert.match(hook, /ROTAS_API\.ADMIN_ATUALIZAR_ATRIBUICOES/);
    assert.match(hook, /setor:\s*result\.profile\.setor/);
    assert.match(hook, /cargo:\s*result\.profile\.cargo/);
  });

  it("nenhum INSERT/UPSERT frontend em public.perfis envia role ou sector_locked", () => {
    const arquivos = [
      "frontend/src/servicos/armazenamento.ts",
      "frontend/src/servicos/persistencia-perfil.ts",
      "frontend/src/paginas/autenticacao/PerfilUsuario.tsx",
      "frontend/src/paginas/autenticacao/Autenticacao.tsx",
      "frontend/src/contextos/ContextoAutenticacao.tsx",
      "frontend/src/hooks/useAplicacao.ts",
    ];

    for (const arquivo of arquivos) {
      const fonte = ler(arquivo);
      const escritas = [
        ...fonte.matchAll(
          /\.from\(TABELAS_SUPABASE\.PERFIS\)\s*\.(insert|upsert)\(([\s\S]*?)\)\s*(?:\.select|\.single|;)/g,
        ),
      ];
      for (const escrita of escritas) {
        assert.doesNotMatch(
          escrita[2],
          /\brole\s*:/,
          `${arquivo} envia role em ${escrita[1]} de perfis`,
        );
        assert.doesNotMatch(
          escrita[2],
          /sector_locked/,
          `${arquivo} envia sector_locked em ${escrita[1]} de perfis`,
        );
      }
    }
  });
});
