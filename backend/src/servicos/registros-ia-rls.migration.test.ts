import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const POLICIES_ANTIGAS = [
  "Acesso público escrita",
  "Acesso público leitura",
  "Acesso total registros",
  "Allow All Access",
  "Delete apenas admin",
  "Insert para autenticados",
  "Leitura para autenticados",
  "Permitir atualização para todos",
  "Permitir exclusão para todos",
  "Permitir gestão total pública",
  "Permitir inserção para todos",
  "Permitir leitura para todos",
  "Update por dono ou admin",
] as const;

const POLICIES_LEGADO_DOC = [
  "Permitir leitura pública",
  "Permitir tudo público",
  "Visualização segura de registros de IA",
  "Inserção de novo registro de IA",
  "Atualização controlada de IA",
  "Exclusão restrita a administradores",
] as const;

const POLICY_SELECT = "Leitura de registros por autenticados";
const POLICY_INSERT = "Inserção de registros pelo dono autenticado";
const POLICY_UPDATE = "Atualização de registros por administradores";

const COLUNAS_INSERT_AUTHENTICATED = [
  "id",
  "data",
  "updated_at",
  "unidade_setor",
  "responsavel_preenchimento",
  "nome_ferramenta",
  "status_uso",
  "owner_id",
] as const;

const COLUNAS_UPDATE_AUTHENTICATED = [
  "data",
  "updated_at",
  "unidade_setor",
  "responsavel_preenchimento",
  "nome_ferramenta",
  "status_uso",
] as const;

const CAMINHO_MIGRATION = resolve(
  process.cwd(),
  "documentacao",
  "SUPABASE_REGISTROS_IA_RLS_CLIENTE.sql",
);

function ler(relativo: string): string {
  return readFileSync(resolve(process.cwd(), relativo), "utf8");
}

function lerMigration(): string {
  return readFileSync(CAMINHO_MIGRATION, "utf8");
}

function sqlOperacional(sql: string): string {
  return sql.replace(/--[^\n]*/g, " ");
}

function dropPolicy(sql: string, nome: string): boolean {
  const escapado = nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `drop\\s+policy\\s+if\\s+exists\\s+"${escapado}"\\s+on\\s+public\\.registros_ia`,
    "i",
  ).test(sql);
}

function blocoCreatePolicy(sql: string, nome: string): string {
  const escapado = nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = sql.match(
    new RegExp(`create\\s+policy\\s+"${escapado}"[\\s\\S]*?;`, "i"),
  );
  assert.ok(match, `CREATE POLICY "${nome}" ausente`);
  return match[0];
}

function blocoFuncao(sql: string, nome: string): string {
  const escapado = nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = sql.match(
    new RegExp(
      `create\\s+or\\s+replace\\s+function\\s+public\\.${escapado}\\s*\\([^)]*\\)[\\s\\S]*?\\$\\$[\\s\\S]*?\\$\\$`,
      "i",
    ),
  );
  assert.ok(match, `CREATE FUNCTION public.${nome} ausente`);
  return match[0];
}

function grantsTo(sql: string, papel: string): string[] {
  const regex = new RegExp(
    `grant\\s+([\\s\\S]*?)\\s+on\\s+table\\s+public\\.registros_ia\\s+to\\s+${papel}\\b`,
    "gi",
  );
  const encontrados: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(sql)) !== null) {
    encontrados.push(match[1].replace(/\s+/g, " ").trim().toLowerCase());
  }
  return encontrados;
}

function colunasGrantPrivilegioAuthenticated(
  sql: string,
  privilegio: "insert" | "update",
): string[] {
  const match = sql.match(
    new RegExp(
      `grant\\s+${privilegio}\\s*\\(([^)]+)\\)\\s+on\\s+table\\s+public\\.registros_ia\\s+to\\s+authenticated`,
      "i",
    ),
  );
  assert.ok(match, `GRANT ${privilegio.toUpperCase()} em colunas para authenticated ausente`);
  return match[1]
    .split(",")
    .map((coluna) => coluna.trim().toLowerCase())
    .filter(Boolean);
}

describe("Etapa 3B.2 — RLS final de public.registros_ia", () => {
  it("é transacional, habilita RLS e não altera schema nem outras tabelas", () => {
    const sql = lerMigration();
    const operacional = sqlOperacional(sql);

    assert.match(sql, /^\s*begin;/im);
    assert.match(sql, /\bcommit;\s*$/im);
    assert.match(
      operacional,
      /alter\s+table\s+public\.registros_ia\s+enable\s+row\s+level\s+security/i,
    );
    assert.doesNotMatch(operacional, /\badd\s+column\b/i);
    assert.doesNotMatch(operacional, /\bdrop\s+column\b/i);
    assert.doesNotMatch(operacional, /\bcreate\s+table\b/i);
    assert.doesNotMatch(operacional, /\bhandle_new_user\b/i);
    assert.doesNotMatch(operacional, /alter\s+table\s+public\.perfis/i);
    assert.doesNotMatch(operacional, /create\s+policy[\s\S]*on\s+public\.perfis/i);
    assert.doesNotMatch(operacional, /create\s+policy[\s\S]*on\s+public\.sectors/i);
    assert.doesNotMatch(operacional, /\bfluxos_aprovacao\b/i);
    assert.doesNotMatch(operacional, /\betapas_aprovacao\b/i);
    assert.doesNotMatch(sql, /\bcreate\s+policy[\s\S]*\bfor\s+delete\b/i);
  });

  it("remove as policies conhecidas e quaisquer restantes da tabela", () => {
    const sql = lerMigration();

    for (const nome of [
      ...POLICIES_ANTIGAS,
      ...POLICIES_LEGADO_DOC,
      POLICY_SELECT,
      POLICY_INSERT,
      POLICY_UPDATE,
    ]) {
      assert.equal(dropPolicy(sql, nome), true, `DROP POLICY ausente: ${nome}`);
    }

    assert.match(sql, /from\s+pg_catalog\.pg_policies/i);
    assert.match(sql, /tablename\s*=\s*'registros_ia'/i);
    assert.match(sql, /drop policy if exists %I on public\.registros_ia/i);
  });

  it("A) nenhuma policy USING true pública permanece", () => {
    const sql = lerMigration();
    const creates = [...sql.matchAll(/create\s+policy\s+"([^"]+)"/gi)]
      .map((item) => item[1]);

    assert.deepEqual(creates, [POLICY_SELECT, POLICY_INSERT, POLICY_UPDATE]);

    for (const nome of creates) {
      const bloco = blocoCreatePolicy(sql, nome);
      assert.match(bloco, /\bto\s+authenticated\b/i);
      assert.doesNotMatch(bloco, /\bto\s+public\b/i);
      assert.doesNotMatch(bloco, /\bto\s+anon\b/i);
      assert.doesNotMatch(bloco, /\busing\s*\(\s*true\s*\)/i);
      assert.doesNotMatch(bloco, /\bwith\s+check\s*\(\s*true\s*\)/i);
    }
  });

  it("B) anon sem grants de tabela", () => {
    const operacional = sqlOperacional(lerMigration());
    assert.match(operacional, /revoke\s+all\s+on\s+table\s+public\.registros_ia\s+from\s+anon/i);
    assert.match(operacional, /revoke\s+all\s+on\s+table\s+public\.registros_ia\s+from\s+public/i);
    assert.equal(grantsTo(operacional, "anon").length, 0);
    assert.doesNotMatch(operacional, /grant\s+[^\n;]*\bon\s+table\s+public\.registros_ia\s+to\s+anon\b/i);
    assert.doesNotMatch(operacional, /grant\s+[^\n;]*\bon\s+table\s+public\.registros_ia\s+to\s+public\b/i);
  });

  it("C/D/P) authenticated mantém SELECT e INSERT por coluna; não recebe DELETE/TRUNCATE/REFERENCES/TRIGGER", () => {
    const operacional = sqlOperacional(lerMigration());
    assert.match(operacional, /revoke\s+all\s+on\s+table\s+public\.registros_ia\s+from\s+authenticated/i);
    assert.match(
      operacional,
      /grant\s+select\s+on\s+table\s+public\.registros_ia\s+to\s+authenticated/i,
    );
    assert.doesNotMatch(
      operacional,
      /grant\s+insert\s+on\s+table\s+public\.registros_ia\s+to\s+authenticated/i,
    );
    assert.match(
      operacional,
      /grant\s+insert\s*\(/i,
    );

    const tabela = grantsTo(operacional, "authenticated").join(" | ");
    assert.match(tabela, /\bselect\b/);
    assert.match(tabela, /\binsert\b/);
    assert.doesNotMatch(tabela, /\bdelete\b/);
    assert.doesNotMatch(tabela, /\btruncate\b/);
    assert.doesNotMatch(tabela, /\breferences\b/);
    assert.doesNotMatch(tabela, /\btrigger\b/);
    assert.doesNotMatch(
      operacional,
      /grant\s+(all|delete|truncate|references|trigger)\b[\s\S]{0,80}public\.registros_ia/i,
    );
  });

  it("E/F) INSERT exige owner_id = auth.uid() e setor do perfil", () => {
    const bloco = blocoCreatePolicy(lerMigration(), POLICY_INSERT);
    assert.match(bloco, /\bfor\s+insert\b/i);
    assert.match(bloco, /\bowner_id\s*=\s*auth\.uid\(\)/i);
    assert.match(bloco, /usuario_pertence_setor_registro\s*\(\s*unidade_setor\s*\)/i);
    assert.doesNotMatch(bloco, /usuario_role_atual\s*\(\s*\)\s*=\s*'admin'/i);
    assert.doesNotMatch(bloco, /\busing\s*\(/i);
  });

  it("G/H/I/J/K) SELECT: dono, mesmo setor, moderator e admin; outro setor só via helpers", () => {
    const bloco = blocoCreatePolicy(lerMigration(), POLICY_SELECT);
    assert.match(bloco, /\bfor\s+select\b/i);
    assert.match(bloco, /\bowner_id\s*=\s*auth\.uid\(\)/i);
    assert.match(bloco, /usuario_pertence_setor_registro\s*\(\s*unidade_setor\s*\)/i);
    assert.match(
      bloco,
      /usuario_role_atual\s*\(\s*\)\s+in\s*\(\s*'admin'\s*,\s*'moderator'\s*\)/i,
    );
    assert.doesNotMatch(bloco, /\bilike\b/i);
    assert.doesNotMatch(bloco, /\blike\b/i);
  });

  it("L/M/N) UPDATE somente admin; user e moderator não têm policy de escrita", () => {
    const bloco = blocoCreatePolicy(lerMigration(), POLICY_UPDATE);
    assert.match(bloco, /\bfor\s+update\b/i);
    assert.match(bloco, /\busing\s*\(\s*public\.usuario_role_atual\s*\(\s*\)\s*=\s*'admin'\s*\)/i);
    assert.match(bloco, /\bwith\s+check\s*\(\s*public\.usuario_role_atual\s*\(\s*\)\s*=\s*'admin'\s*\)/i);
    assert.doesNotMatch(bloco, /role\s*=\s*'moderator'/i);
    assert.doesNotMatch(bloco, /owner_id\s*=\s*auth\.uid\(\)/i);
  });

  it("O) INSERT/UPDATE por coluna: id e owner_id imutáveis no UPDATE; criação envia id", () => {
    const sql = lerMigration();
    const insertConcedido = colunasGrantPrivilegioAuthenticated(sql, "insert");
    const updateConcedido = colunasGrantPrivilegioAuthenticated(sql, "update");

    assert.deepEqual(insertConcedido, [...COLUNAS_INSERT_AUTHENTICATED]);
    assert.deepEqual(updateConcedido, [...COLUNAS_UPDATE_AUTHENTICATED]);
    assert.equal((updateConcedido as string[]).includes("id"), false);
    assert.equal((updateConcedido as string[]).includes("owner_id"), false);
    assert.equal((insertConcedido as string[]).includes("created_at"), false);

    const persistir = ler("frontend/src/servicos/armazenamento.ts");
    const funcao = persistir.slice(
      persistir.indexOf("async function persistirRegistroIa"),
      persistir.indexOf("export const updateRecord"),
    );
    const payload = funcao.match(
      /const payload: Record<string, unknown> = \{([\s\S]*?)\n    \};/,
    )?.[1] || "";
    assert.doesNotMatch(payload, /\bid:/);
    assert.doesNotMatch(payload, /owner_id/);
    assert.match(payload, /\bdata:/);
    assert.match(payload, /\bupdated_at:/);
    assert.match(payload, /\bunidade_setor:/);
    assert.match(payload, /\bresponsavel_preenchimento:/);
    assert.match(payload, /\bnome_ferramenta:/);
    assert.match(payload, /\bstatus_uso:/);
    assert.match(
      funcao,
      /if \(modo === "criar"\) \{[\s\S]*payload\.id = record\.id;[\s\S]*payload\.owner_id = resolvedOwnerId;/,
    );
    assert.match(funcao, /await tabela\.insert\(currentPayload\)/);
    assert.match(funcao, /await tabela\.update\(currentPayload\)\.eq\("id", record\.id\)/);
    assert.match(funcao, /\.eq\("id", record\.id\)/);
  });

  it("Q) service_role não teve grants reduzidos", () => {
    const sql = lerMigration();
    assert.doesNotMatch(sql, /revoke\s+[^\n]*\bfrom\s+service_role\b/i);
    assert.doesNotMatch(sql, /grant\s+[^\n]*\bto\s+service_role\b/i);
  });

  it("R/S/T/U) helper de setor: split, trim, igualdade, search_path e sem wildcard", () => {
    const sql = lerMigration();
    const operacional = sqlOperacional(sql);
    const setor = blocoFuncao(sql, "usuario_pertence_setor_registro");
    const role = blocoFuncao(sql, "usuario_role_atual");

    assert.match(setor, /security\s+definer/i);
    assert.match(setor, /set\s+search_path\s*=\s*pg_catalog/i);
    assert.match(setor, /\blanguage\s+sql\b/i);
    assert.match(setor, /\bstable\b/i);
    assert.match(setor, /auth\.uid\(\)/i);
    assert.match(setor, /public\.perfis/i);
    assert.match(setor, /string_to_array\s*\(\s*coalesce\s*\(\s*p\.setor\s*,\s*''\s*\)\s*,\s*';'\s*\)/i);
    assert.match(setor, /lower\s*\(\s*btrim\s*\(\s*setor_bruto\s*\)\s*\)/i);
    assert.match(setor, /=\s*lower\s*\(\s*btrim\s*\(\s*coalesce\s*\(\s*setor_registro/i);
    assert.doesNotMatch(setor, /\bilike\b/i);
    assert.doesNotMatch(setor, /\blike\b/i);
    assert.doesNotMatch(setor, /'%'\s*\|\||\|\|\s*'%'|like\s+'/i);

    assert.match(role, /security\s+definer/i);
    assert.match(role, /set\s+search_path\s*=\s*pg_catalog/i);
    assert.match(role, /\bstable\b/i);
    assert.match(role, /auth\.uid\(\)/i);
    assert.match(role, /lower\s*\(\s*btrim\s*\(\s*coalesce\s*\(\s*p\.role/i);

    assert.match(
      operacional,
      /revoke\s+all\s+on\s+function\s+public\.usuario_pertence_setor_registro\s*\(\s*text\s*\)\s+from\s+anon/i,
    );
    assert.match(
      operacional,
      /revoke\s+all\s+on\s+function\s+public\.usuario_pertence_setor_registro\s*\(\s*text\s*\)\s+from\s+public/i,
    );
    assert.match(
      operacional,
      /grant\s+execute\s+on\s+function\s+public\.usuario_pertence_setor_registro\s*\(\s*text\s*\)\s+to\s+authenticated/i,
    );
    assert.match(
      operacional,
      /grant\s+execute\s+on\s+function\s+public\.usuario_role_atual\s*\(\s*\)\s+to\s+authenticated/i,
    );
  });
});
