import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const POLICIES_ANTIGAS = [
  "Apenas admins podem modificar setores",
  "Setores visíveis para todos",
] as const;

const POLICY_SELECT_ANON_LEGADO = "Leitura de setores por anonimos";
const POLICY_SELECT_ANON = "Leitura de setores ativos por anonimos";
const POLICY_SELECT_AUTH = "Leitura de setores por autenticados";
const POLICY_INSERT_ADMIN = "Inserção de setores por administradores";
const POLICY_UPDATE_ADMIN = "Atualização de setores por administradores";
const POLICY_DELETE_ADMIN = "Exclusão de setores por administradores";

const POLICIES_CONSOLIDADAS = [
  POLICY_SELECT_ANON,
  POLICY_SELECT_AUTH,
  POLICY_INSERT_ADMIN,
  POLICY_UPDATE_ADMIN,
  POLICY_DELETE_ADMIN,
] as const;

const CAMINHO_MIGRATION = resolve(
  process.cwd(),
  "documentacao",
  "SUPABASE_SECTORS_RLS_CLIENTE.sql",
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
    `drop\\s+policy\\s+if\\s+exists\\s+"${escapado}"\\s+on\\s+public\\.sectors`,
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

function grantsTo(sql: string, papel: string): string[] {
  const regex = new RegExp(
    `grant\\s+([\\s\\S]*?)\\s+on\\s+table\\s+public\\.sectors\\s+to\\s+${papel}\\b`,
    "gi",
  );
  const encontrados: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(sql)) !== null) {
    encontrados.push(match[1].replace(/\s+/g, " ").trim().toLowerCase());
  }
  return encontrados;
}

function condicaoAdmin(bloco: string): boolean {
  return /exists\s*\(\s*select\s+1\s+from\s+public\.perfis\s+where\s+id\s*=\s*auth\.uid\(\)\s+and\s+role\s*=\s*'admin'\s*\)/i
    .test(bloco);
}

describe("Etapa 2 — RLS de cliente em public.sectors", () => {
  it("é transacional, idempotente e não altera schema nem outras tabelas", () => {
    const sql = lerMigration();
    const operacional = sqlOperacional(sql);

    assert.match(sql, /^\s*begin;/im);
    assert.match(sql, /\bcommit;\s*$/im);
    assert.doesNotMatch(operacional, /\balter\s+table\b/i);
    assert.doesNotMatch(operacional, /\badd\s+column\b/i);
    assert.doesNotMatch(operacional, /\bdrop\s+column\b/i);
    assert.doesNotMatch(operacional, /\bcreate\s+or\s+replace\s+function\b/i);
    assert.doesNotMatch(operacional, /\bget_auth_role\b/i);
    assert.doesNotMatch(operacional, /\bregistros_ia\b/i);
    assert.doesNotMatch(operacional, /\bmensagens\b/i);
    assert.doesNotMatch(operacional, /\bfluxos_aprovacao\b/i);
    assert.doesNotMatch(operacional, /\betapas_aprovacao\b/i);
    assert.doesNotMatch(operacional, /\bconfiguracao_aprovacao\b/i);
    assert.doesNotMatch(operacional, /\bhandle_new_user\b/i);
    assert.doesNotMatch(operacional, /\bon_auth_user_created\b/i);
    assert.doesNotMatch(operacional, /\badd\s+column\s+ativo\b/i);
    assert.match(sql, /from\s+public\.perfis/i);
    assert.doesNotMatch(operacional, /alter\s+table\s+public\.perfis/i);
    assert.doesNotMatch(operacional, /create\s+policy[\s\S]*on\s+public\.perfis/i);
    assert.doesNotMatch(operacional, /grant[\s\S]*on\s+table\s+public\.perfis/i);
    assert.doesNotMatch(operacional, /revoke[\s\S]*on\s+table\s+public\.perfis/i);
  });

  it("remove as policies conhecidas e os nomes consolidados desta etapa", () => {
    const sql = lerMigration();

    for (const nome of [
      ...POLICIES_ANTIGAS,
      POLICY_SELECT_ANON_LEGADO,
      ...POLICIES_CONSOLIDADAS,
    ]) {
      assert.equal(dropPolicy(sql, nome), true, `DROP POLICY ausente: ${nome}`);
    }

    const drops = [...sql.matchAll(/drop\s+policy\s+if\s+exists\s+"([^"]+)"/gi)]
      .map((item) => item[1]);
    assert.equal(drops.length, 8);
  });

  it("L) não cria policy FOR ALL nem USING true de escrita", () => {
    const sql = lerMigration();
    const creates = [...sql.matchAll(/create\s+policy[\s\S]*?;/gi)].join("\n");

    assert.doesNotMatch(creates, /\bfor\s+all\b/i);
    assert.doesNotMatch(
      sqlOperacional(creates),
      /for\s+(insert|update|delete)[\s\S]*using\s*\(\s*true\s*\)/i,
    );
  });

  it("cria exatamente cinco policies finais, sem escrita para anon", () => {
    const sql = lerMigration();
    const creates = [...sql.matchAll(/create\s+policy\s+"([^"]+)"/gi)]
      .map((item) => item[1]);

    assert.deepEqual(creates, [...POLICIES_CONSOLIDADAS]);

    const insert = blocoCreatePolicy(sql, POLICY_INSERT_ADMIN);
    const update = blocoCreatePolicy(sql, POLICY_UPDATE_ADMIN);
    const del = blocoCreatePolicy(sql, POLICY_DELETE_ADMIN);

    for (const bloco of [insert, update, del]) {
      assert.match(bloco, /\bto\s+authenticated\b/i);
      assert.doesNotMatch(bloco, /\bto\s+anon\b/i);
      assert.doesNotMatch(bloco, /\bto\s+public\b/i);
    }

    const leituraAnon = blocoCreatePolicy(sql, POLICY_SELECT_ANON);
    assert.match(leituraAnon, /\bto\s+anon\b/i);
    assert.match(leituraAnon, /\bfor\s+select\b/i);
    assert.doesNotMatch(leituraAnon, /\bfor\s+(insert|update|delete|all)\b/i);
  });

  it("anon só enxerga status = 'Ativo' e authenticated mantém leitura completa", () => {
    const sql = lerMigration();
    const anon = blocoCreatePolicy(sql, POLICY_SELECT_ANON);
    const auth = blocoCreatePolicy(sql, POLICY_SELECT_AUTH);

    assert.match(anon, /\bfor\s+select\b/i);
    assert.match(anon, /\bto\s+anon\b/i);
    assert.match(anon, /\busing\s*\(\s*status\s*=\s*'Ativo'\s*\)/i);
    assert.doesNotMatch(anon, /\busing\s*\(\s*true\s*\)/i);
    assert.doesNotMatch(anon, /\bauth\.uid\(\)/i);

    assert.match(auth, /\bfor\s+select\b/i);
    assert.match(auth, /\bto\s+authenticated\b/i);
    assert.match(auth, /\busing\s*\(\s*true\s*\)/i);
    assert.doesNotMatch(auth, /\bstatus\s*=\s*'Ativo'/i);
    assert.doesNotMatch(auth, /\bauth\.uid\(\)/i);
  });

  it("I) INSERT exige admin em WITH CHECK e não usa USING", () => {
    const bloco = blocoCreatePolicy(lerMigration(), POLICY_INSERT_ADMIN);
    assert.match(bloco, /\bfor\s+insert\b/i);
    assert.equal(condicaoAdmin(bloco), true);
    assert.match(bloco, /with\s+check\s*\(/i);
    assert.doesNotMatch(bloco, /\busing\s*\(/i);
  });

  it("J) UPDATE exige admin em USING e WITH CHECK", () => {
    const bloco = blocoCreatePolicy(lerMigration(), POLICY_UPDATE_ADMIN);
    assert.match(bloco, /\bfor\s+update\b/i);
    assert.equal(condicaoAdmin(bloco), true);
    assert.match(bloco, /\busing\s*\(/i);
    assert.match(bloco, /\bwith\s+check\s*\(/i);

    const usingMatch = bloco.match(/\busing\s*\(([\s\S]*?)\)\s*with\s+check/i);
    const checkMatch = bloco.match(/\bwith\s+check\s*\(([\s\S]*?)\)\s*;/i);
    assert.ok(usingMatch);
    assert.ok(checkMatch);
    assert.match(usingMatch[1], /id\s*=\s*auth\.uid\(\)/i);
    assert.match(usingMatch[1], /role\s*=\s*'admin'/i);
    assert.match(checkMatch[1], /id\s*=\s*auth\.uid\(\)/i);
    assert.match(checkMatch[1], /role\s*=\s*'admin'/i);
  });

  it("K) DELETE exige admin em USING", () => {
    const bloco = blocoCreatePolicy(lerMigration(), POLICY_DELETE_ADMIN);
    assert.match(bloco, /\bfor\s+delete\b/i);
    assert.equal(condicaoAdmin(bloco), true);
    assert.match(bloco, /\busing\s*\(/i);
    assert.doesNotMatch(bloco, /\bwith\s+check\s*\(/i);
  });

  it("A/B/C/D/E) anon possui SELECT e não possui escrita nem privilégios administrativos", () => {
    const operacional = sqlOperacional(lerMigration());
    assert.match(operacional, /revoke\s+all\s+on\s+table\s+public\.sectors\s+from\s+anon/i);
    assert.match(operacional, /revoke\s+all\s+on\s+table\s+public\.sectors\s+from\s+public/i);

    const concedidos = grantsTo(operacional, "anon");
    assert.deepEqual(concedidos, ["select"]);
    assert.doesNotMatch(concedidos.join(" | "), /\binsert\b|\bupdate\b|\bdelete\b|\btruncate\b|\breferences\b|\btrigger\b/);
    assert.doesNotMatch(operacional, /grant\s+[^\n;]*\bto\s+public\b/i);
  });

  it("F/G/H) authenticated possui SELECT/INSERT/UPDATE/DELETE e não possui TRUNCATE/REFERENCES/TRIGGER", () => {
    const operacional = sqlOperacional(lerMigration());
    assert.match(
      operacional,
      /revoke\s+all\s+on\s+table\s+public\.sectors\s+from\s+authenticated/i,
    );

    const concedidos = grantsTo(operacional, "authenticated");
    assert.equal(concedidos.length, 1);
    assert.match(concedidos[0], /\bselect\b/);
    assert.match(concedidos[0], /\binsert\b/);
    assert.match(concedidos[0], /\bupdate\b/);
    assert.match(concedidos[0], /\bdelete\b/);
    assert.doesNotMatch(concedidos[0], /\btruncate\b/);
    assert.doesNotMatch(concedidos[0], /\breferences\b/);
    assert.doesNotMatch(concedidos[0], /\btrigger\b/);
    assert.doesNotMatch(operacional, /grant\s+(all|truncate|references|trigger)\b/i);
  });

  it("N) service_role não foi alterado", () => {
    const sql = lerMigration();
    assert.doesNotMatch(sql, /revoke\s+[^\n]*\bfrom\s+service_role\b/i);
    assert.doesNotMatch(sql, /grant\s+[^\n]*\bto\s+service_role\b/i);
  });

  it("M) cadastro anônimo continua lendo public.sectors sem auth.uid()", () => {
    const cadastro = ler("frontend/src/servicos/setores.ts");
    const autenticacao = ler("frontend/src/paginas/autenticacao/Autenticacao.tsx");
    const perfil = ler("frontend/src/paginas/autenticacao/PerfilUsuario.tsx");

    assert.match(cadastro, /TABELA_SETORES_CADASTRO\s*=\s*"sectors"/);
    assert.match(cadastro, /\.from\(TABELA_SETORES_CADASTRO\)/);
    assert.match(cadastro, /\.select\("name,cargos,status"\)/);
    assert.match(cadastro, /\.eq\("status",\s*"Ativo"\)/);
    assert.doesNotMatch(cadastro, /auth\.uid|getSession|getUser/);

    assert.match(autenticacao, /obterSetoresAtivos\(\)/);
    assert.match(perfil, /obterSetoresAtivos\(\)/);
  });

  it("administração persiste em public.sectors com INSERT/UPDATE/DELETE autenticados", () => {
    const gestao = ler("frontend/src/servicos/setores-gestao.ts");
    const armazenamento = ler("frontend/src/servicos/armazenamento.ts");

    assert.match(gestao, /"sectors"/);
    assert.match(gestao, /TABELAS_SUPABASE\.SETORES/);
    assert.match(gestao, /\.update\(payload\)/);
    assert.match(gestao, /\.insert\(payload\)/);
    assert.match(gestao, /\.delete\(\)\.in\("name"/);
    assert.match(gestao, /name,status,cargos,responsible/);
    assert.match(armazenamento, /persistirSetoresGestaoNoSupabase/);
    assert.match(armazenamento, /carregarSetoresGestaoDoSupabase/);
  });
});
