import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const COLUNAS_ESCRITA_AUTHENTICATED = [
  "id",
  "full_name",
  "setor",
  "cargo",
  "contato",
  "avatar_url",
  "updated_at",
  "last_seen",
] as const;

const COLUNAS_UPDATE_AUTHENTICATED = COLUNAS_ESCRITA_AUTHENTICATED;
const COLUNAS_INSERT_AUTHENTICATED = COLUNAS_ESCRITA_AUTHENTICATED;
const COLUNAS_ESCRITA_BLOQUEADAS = ["role", "sector_locked"] as const;
const COLUNAS_UPDATE_BLOQUEADAS = COLUNAS_ESCRITA_BLOQUEADAS;

const POLICIES_INSERT_ANTIGAS = [
  "Insert próprio perfil",
  "Inserção automática de perfil",
  "Inserção automática de perfil via trigger ou manual",
] as const;

const POLICIES_SELECT_ANTIGAS = [
  "Perfis são visíveis para todos",
  "Perfis são visíveis para todos os usuários autenticados",
  "Perfis visíveis",
] as const;

const POLICIES_UPDATE_ANTIGAS = [
  "Update próprio perfil",
  "Usuários podem atualizar o próprio perfil",
  "Usuários podem atualizar seus próprios perfis",
] as const;

const POLICY_SELECT = "Leitura de perfis por autenticados";
const POLICY_INSERT = "Inserção do próprio perfil por autenticados";
const POLICY_UPDATE = "Atualização do próprio perfil por autenticados";

const CAMINHO_MIGRATION = resolve(
  process.cwd(),
  "documentacao",
  "SUPABASE_PERFIS_RLS_CLIENTE.sql",
);

const CAMINHO_CADASTRO = resolve(
  process.cwd(),
  "documentacao",
  "SUPABASE_CORRECAO_CADASTRO_USUARIO.sql",
);

function ler(relativoOuAbsoluto: string): string {
  return readFileSync(
    relativoOuAbsoluto.includes("/") || relativoOuAbsoluto.includes("\\")
      ? resolve(process.cwd(), relativoOuAbsoluto)
      : relativoOuAbsoluto,
    "utf8",
  );
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
    `drop\\s+policy\\s+if\\s+exists\\s+"${escapado}"\\s+on\\s+public\\.perfis`,
    "i",
  ).test(sql);
}

function blocoCreatePolicy(sql: string, nome: string): string {
  const escapado = nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = sql.match(
    new RegExp(
      `create\\s+policy\\s+"${escapado}"[\\s\\S]*?;`,
      "i",
    ),
  );
  assert.ok(match, `CREATE POLICY "${nome}" ausente`);
  return match[0];
}

function colunasGrantPrivilegioAuthenticated(
  sql: string,
  privilegio: "insert" | "update",
): string[] {
  const match = sql.match(
    new RegExp(
      `grant\\s+${privilegio}\\s*\\(([^)]+)\\)\\s+on\\s+table\\s+public\\.perfis\\s+to\\s+authenticated`,
      "i",
    ),
  );
  assert.ok(match, `GRANT ${privilegio.toUpperCase()} em colunas para authenticated ausente`);
  return match[1]
    .split(",")
    .map((coluna) => coluna.trim().toLowerCase())
    .filter(Boolean);
}

function colunasGrantUpdateAuthenticated(sql: string): string[] {
  return colunasGrantPrivilegioAuthenticated(sql, "update");
}

function colunasGrantInsertAuthenticated(sql: string): string[] {
  return colunasGrantPrivilegioAuthenticated(sql, "insert");
}

function grantsTo(sql: string, papel: string): string[] {
  const regex = new RegExp(
    `grant\\s+([\\s\\S]*?)\\s+on\\s+table\\s+public\\.perfis\\s+to\\s+${papel}\\b`,
    "gi",
  );
  const encontrados: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(sql)) !== null) {
    encontrados.push(match[1].replace(/\s+/g, " ").trim().toLowerCase());
  }
  return encontrados;
}

describe("Etapa 1 — RLS de cliente em public.perfis", () => {
  it("é transacional, idempotente e não altera schema nem outras tabelas", () => {
    const sql = lerMigration();
    const operacional = sqlOperacional(sql);

    assert.match(sql, /^\s*begin;/im);
    assert.match(sql, /\bcommit;\s*$/im);
    assert.doesNotMatch(operacional, /\bpg_policies\b/i);
    assert.doesNotMatch(operacional, /\balter\s+table\b/i);
    assert.doesNotMatch(operacional, /\badd\s+column\b/i);
    assert.doesNotMatch(operacional, /\bdrop\s+column\b/i);
    assert.doesNotMatch(operacional, /\bhandle_new_user\b/i);
    assert.doesNotMatch(operacional, /\bon_auth_user_created\b/i);
    assert.doesNotMatch(operacional, /\bcreate\s+or\s+replace\s+function\b/i);
    assert.doesNotMatch(operacional, /\bregistros_ia\b/i);
    assert.doesNotMatch(operacional, /\bsectors\b/i);
    assert.doesNotMatch(operacional, /\bmensagens\b/i);
    assert.doesNotMatch(operacional, /\bfluxos_aprovacao\b/i);
    assert.doesNotMatch(operacional, /\betapas_aprovacao\b/i);
    assert.doesNotMatch(operacional, /\bconfiguracao_aprovacao\b/i);
    assert.doesNotMatch(sql, /\bcreate\s+policy[\s\S]*\bfor\s+delete\b/i);
  });

  it("remove somente as policies duplicadas conhecidas, pelo nome", () => {
    const sql = lerMigration();

    for (const nome of [
      ...POLICIES_INSERT_ANTIGAS,
      ...POLICIES_SELECT_ANTIGAS,
      ...POLICIES_UPDATE_ANTIGAS,
      POLICY_SELECT,
      POLICY_INSERT,
      POLICY_UPDATE,
    ]) {
      assert.equal(dropPolicy(sql, nome), true, `DROP POLICY ausente: ${nome}`);
    }

    const drops = [...sql.matchAll(/drop\s+policy\s+if\s+exists\s+"([^"]+)"/gi)]
      .map((item) => item[1]);
    assert.equal(drops.length, 12);
  });

  it("J) cria exatamente três policies finais TO authenticated", () => {
    const sql = lerMigration();
    const creates = [...sql.matchAll(/create\s+policy\s+"([^"]+)"/gi)]
      .map((item) => item[1]);

    assert.deepEqual(creates, [POLICY_SELECT, POLICY_INSERT, POLICY_UPDATE]);

    for (const nome of creates) {
      const bloco = blocoCreatePolicy(sql, nome);
      assert.match(bloco, /\bto\s+authenticated\b/i);
      assert.doesNotMatch(bloco, /\bto\s+public\b/i);
      assert.doesNotMatch(bloco, /\bto\s+anon\b/i);
    }
  });

  it("M) SELECT autenticado continua permitindo o catálogo de perfis", () => {
    const bloco = blocoCreatePolicy(lerMigration(), POLICY_SELECT);
    assert.match(bloco, /\bfor\s+select\b/i);
    assert.match(bloco, /\busing\s*\(\s*true\s*\)/i);
  });

  it("L) INSERT próprio exige auth.uid() = id, role = user e sector_locked = false", () => {
    const bloco = blocoCreatePolicy(lerMigration(), POLICY_INSERT);
    assert.match(bloco, /\bfor\s+insert\b/i);
    assert.match(bloco, /\bauth\.uid\(\)\s*=\s*id\b/i);
    assert.match(bloco, /\brole\s*=\s*'user'/i);
    assert.match(bloco, /\bsector_locked\s*=\s*false\b/i);
    assert.match(
      bloco,
      /with\s+check\s*\(\s*auth\.uid\(\)\s*=\s*id\s+and\s+role\s*=\s*'user'\s+and\s+sector_locked\s*=\s*false\s*\)/i,
    );
    assert.doesNotMatch(bloco, /\busing\s*\(/i);
  });

  it("K) UPDATE possui USING e WITH CHECK auth.uid() = id", () => {
    const bloco = blocoCreatePolicy(lerMigration(), POLICY_UPDATE);
    assert.match(bloco, /\bfor\s+update\b/i);
    assert.match(bloco, /\busing\s*\(\s*auth\.uid\(\)\s*=\s*id\s*\)/i);
    assert.match(bloco, /\bwith\s+check\s*\(\s*auth\.uid\(\)\s*=\s*id\s*\)/i);
  });

  it("A/B/C) anon não recebe SELECT, INSERT, UPDATE nem DELETE", () => {
    const sql = lerMigration();
    const operacional = sqlOperacional(sql);
    assert.match(operacional, /revoke\s+all\s+on\s+table\s+public\.perfis\s+from\s+anon/i);
    assert.match(operacional, /revoke\s+all\s+on\s+table\s+public\.perfis\s+from\s+public/i);
    assert.equal(grantsTo(operacional, "anon").length, 0);
    assert.doesNotMatch(operacional, /grant\s+[^\n;]*\bto\s+anon\b/i);
    assert.doesNotMatch(operacional, /grant\s+[^\n;]*\bto\s+public\b/i);
  });

  it("D/E) authenticated possui SELECT de tabela e INSERT somente nas colunas autorizadas", () => {
    const sql = lerMigration();
    const operacional = sqlOperacional(sql);
    const tabela = grantsTo(operacional, "authenticated").join(" | ");

    assert.match(tabela, /\bselect\b/);
    assert.match(
      operacional,
      /grant\s+select\s+on\s+table\s+public\.perfis\s+to\s+authenticated/i,
    );
    assert.doesNotMatch(
      operacional,
      /grant\s+select\s*,\s*insert\s+on\s+table\s+public\.perfis\s+to\s+authenticated/i,
    );
    assert.doesNotMatch(
      operacional,
      /grant\s+insert\s+on\s+table\s+public\.perfis\s+to\s+authenticated/i,
    );

    const concedidas = colunasGrantInsertAuthenticated(sql);
    assert.deepEqual(concedidas, [...COLUNAS_INSERT_AUTHENTICATED]);
  });

  it("authenticated não possui INSERT em role", () => {
    const concedidas = colunasGrantInsertAuthenticated(lerMigration());
    assert.equal(concedidas.includes("role"), false);
  });

  it("authenticated não possui INSERT em sector_locked", () => {
    const concedidas = colunasGrantInsertAuthenticated(lerMigration());
    assert.equal(concedidas.includes("sector_locked"), false);
    for (const coluna of COLUNAS_ESCRITA_BLOQUEADAS) {
      assert.equal(concedidas.includes(coluna), false, coluna);
    }
  });

  it("F) authenticated possui UPDATE somente nas colunas autorizadas", () => {
    const concedidas = colunasGrantUpdateAuthenticated(lerMigration());
    assert.deepEqual(concedidas, [...COLUNAS_UPDATE_AUTHENTICATED]);
  });

  it("G) authenticated não possui UPDATE de role", () => {
    const concedidas = colunasGrantUpdateAuthenticated(lerMigration());
    assert.equal(concedidas.includes("role"), false);
  });

  it("H) authenticated não possui UPDATE de sector_locked", () => {
    const concedidas = colunasGrantUpdateAuthenticated(lerMigration());
    assert.equal(concedidas.includes("sector_locked"), false);
    for (const coluna of COLUNAS_UPDATE_BLOQUEADAS) {
      assert.equal(concedidas.includes(coluna), false, coluna);
    }
  });

  it("I) authenticated não possui DELETE, TRUNCATE, REFERENCES nem TRIGGER", () => {
    const operacional = sqlOperacional(lerMigration());
    assert.match(operacional, /revoke\s+all\s+on\s+table\s+public\.perfis\s+from\s+authenticated/i);
    const tabela = grantsTo(operacional, "authenticated").join(" | ");
    assert.doesNotMatch(tabela, /\bdelete\b/);
    assert.doesNotMatch(tabela, /\btruncate\b/);
    assert.doesNotMatch(tabela, /\breferences\b/);
    assert.doesNotMatch(tabela, /\btrigger\b/);
    assert.doesNotMatch(operacional, /grant\s+(all|delete|truncate|references|trigger)\b/i);
  });

  it("N) service_role não teve grants reduzidos", () => {
    const sql = lerMigration();
    assert.doesNotMatch(sql, /revoke\s+[^\n]*\bfrom\s+service_role\b/i);
    assert.doesNotMatch(sql, /grant\s+[^\n]*\bto\s+service_role\b/i);
  });

  it("O) handle_new_user não foi alterado", () => {
    const operacional = sqlOperacional(lerMigration());
    const cadastro = readFileSync(CAMINHO_CADASTRO, "utf8");

    assert.doesNotMatch(operacional, /\bhandle_new_user\b/i);
    assert.doesNotMatch(operacional, /\bcreate\s+or\s+replace\s+function\b/i);
    assert.doesNotMatch(operacional, /\bon_auth_user_created\b/i);
    assert.match(cadastro, /create\s+or\s+replace\s+function\s+public\.handle_new_user\(\)/i);
    assert.match(cadastro, /security\s+definer/i);
    assert.match(
      cadastro,
      /insert\s+into\s+public\.perfis\s*\(\s*id\s*,\s*full_name\s*,\s*setor\s*,\s*cargo\s*\)/i,
    );
  });

  it("UPSERT do frontend permanece compatível com SELECT/INSERT/UPDATE próprios", () => {
    const persistencia = ler("frontend/src/servicos/persistencia-perfil.ts");
    const contexto = ler("frontend/src/contextos/ContextoAutenticacao.tsx");
    const armazenamento = ler("frontend/src/servicos/armazenamento.ts");
    const chat = ler("frontend/src/paginas/chat/Chat.tsx");
    const hook = ler("frontend/src/hooks/useAplicacao.ts");

    assert.match(persistencia, /\.upsert\(campos,\s*\{\s*onConflict:\s*"id"\s*\}\)/);
    assert.match(persistencia, /id:\s*userId/);
    assert.match(persistencia, /\.select\("id,setor,cargo"\)/);
    assert.doesNotMatch(persistencia, /\brole\b/);
    assert.doesNotMatch(persistencia, /sector_locked/);

    const colunasUpsert = ["id", "setor", "cargo", "updated_at", "full_name", "contato", "avatar_url"];
    for (const coluna of colunasUpsert) {
      assert.ok(
        (COLUNAS_INSERT_AUTHENTICATED as readonly string[]).includes(coluna),
        `${coluna} do upsert não está no GRANT INSERT`,
      );
      assert.ok(
        (COLUNAS_UPDATE_AUTHENTICATED as readonly string[]).includes(coluna),
        `${coluna} do upsert não está no GRANT UPDATE`,
      );
    }

    assert.match(contexto, /from\(TABELAS_SUPABASE\.PERFIS\)/);
    assert.match(contexto, /select\(\s*["']\*["']\s*\)/);
    assert.match(armazenamento, /select\(\s*["']\*["']\s*\)/);
    assert.match(armazenamento, /getProfiles/);
    assert.match(chat, /postgres_changes/);
    assert.match(chat, /TABELAS_SUPABASE\.PERFIS/);
    assert.match(hook, /ROTAS_API\.ADMIN_ATUALIZAR_ROLE/);
    assert.match(hook, /ROTAS_API\.ADMIN_ATUALIZAR_ATRIBUICOES/);
  });
});
