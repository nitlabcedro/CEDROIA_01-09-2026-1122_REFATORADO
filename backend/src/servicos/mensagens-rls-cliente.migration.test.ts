import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "path";
import { describe, it } from "node:test";

const POLICIES_ANTIGAS = [
  "Leitura de mensagens permitidas",
  "Envio de mensagens próprio",
  "Permitir leitura pública",
  "Permitir inserção para autenticados",
  "Usuários autenticados podem inserir",
  "Usuários podem deletar próprias mensagens",
  "Delete próprias mensagens",
  "Acesso público leitura",
  "Acesso público escrita",
  "Allow All Access",
  "Permitir leitura para todos",
  "Permitir inserção para todos",
  "Permitir exclusão para todos",
] as const;

const POLICY_SELECT = "Leitura de mensagens pelos participantes";
const POLICY_INSERT = "Inserção de mensagens de suporte";
const POLICY_UPDATE = "Atualização de leitura pelo destinatário";
const POLICY_STORAGE_INSERT = "Upload de anexos no próprio namespace";
const POLICY_STORAGE_SELECT = "Leitura de anexos pelos participantes";
const POLICY_STORAGE_DELETE = "Exclusão de anexo órfão pelo remetente";

const COLUNAS_INSERT = [
  "content",
  "sender_id",
  "is_private",
  "recipient_id",
  "attachment_url",
  "attachment_name",
  "attachment_type",
  "attachment_size",
] as const;

const CAMINHO = resolve(process.cwd(), "documentacao", "SUPABASE_MENSAGENS_RLS_CLIENTE.sql");

function ler(relativo: string): string {
  return readFileSync(resolve(process.cwd(), relativo), "utf8");
}

function lerMigration(): string {
  return readFileSync(CAMINHO, "utf8");
}

function sqlOperacional(sql: string): string {
  return sql.replace(/--[^\n]*/g, " ");
}

function dropPolicy(sql: string, nome: string, tabela: string): boolean {
  const escapado = nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `drop\\s+policy\\s+if\\s+exists\\s+"${escapado}"\\s+on\\s+${tabela}`,
    "i",
  ).test(sql);
}

function blocoCreatePolicy(sql: string, nome: string): string {
  const escapado = nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = sql.match(new RegExp(`create\\s+policy\\s+"${escapado}"[\\s\\S]*?;`, "i"));
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
    `grant\\s+([\\s\\S]*?)\\s+on\\s+table\\s+public\\.mensagens\\s+to\\s+${papel}\\b`,
    "gi",
  );
  const encontrados: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(sql)) !== null) {
    encontrados.push(match[1].replace(/\s+/g, " ").trim().toLowerCase());
  }
  return encontrados;
}

function colunasGrant(sql: string, privilegio: "insert" | "update"): string[] {
  const match = sql.match(
    new RegExp(
      `grant\\s+${privilegio}\\s*\\(([^)]+)\\)\\s+on\\s+table\\s+public\\.mensagens\\s+to\\s+authenticated`,
      "i",
    ),
  );
  assert.ok(match, `GRANT ${privilegio.toUpperCase()} em colunas para authenticated ausente`);
  return match[1].split(",").map((coluna) => coluna.trim().toLowerCase()).filter(Boolean);
}

describe("Etapa 4 — RLS de public.mensagens e anexos de chat", () => {
  it("é transacional, habilita RLS e não mistura mensagens_ti", () => {
    const sql = lerMigration();
    const operacional = sqlOperacional(sql);

    assert.match(sql, /^\s*begin;/im);
    assert.match(sql, /\bcommit;\s*$/im);
    assert.match(operacional, /alter\s+table\s+public\.mensagens\s+enable\s+row\s+level\s+security/i);
    assert.doesNotMatch(operacional, /\bmensagens_ti\b/i);
    assert.doesNotMatch(operacional, /\badd\s+column\b/i);
    assert.doesNotMatch(operacional, /\bdrop\s+column\b/i);
    assert.doesNotMatch(operacional, /\bcreate\s+table\b/i);
    assert.doesNotMatch(sql, /create\s+policy\s+"[^"]+"\s+on\s+public\.mensagens\s+for\s+delete/i);
  });

  it("remove policies antigas e quaisquer restantes de public.mensagens", () => {
    const sql = lerMigration();
    for (const nome of [...POLICIES_ANTIGAS, POLICY_SELECT, POLICY_INSERT, POLICY_UPDATE]) {
      assert.equal(dropPolicy(sql, nome, "public.mensagens"), true, `DROP POLICY ausente: ${nome}`);
    }
    assert.match(sql, /tablename\s*=\s*'mensagens'/i);
    assert.match(sql, /drop policy if exists %I on public\.mensagens/i);
  });

  it("A) anon sem acesso a mensagens", () => {
    const operacional = sqlOperacional(lerMigration());
    assert.match(operacional, /revoke\s+all\s+on\s+table\s+public\.mensagens\s+from\s+anon/i);
    assert.match(operacional, /revoke\s+all\s+on\s+table\s+public\.mensagens\s+from\s+public/i);
    assert.equal(grantsTo(operacional, "anon").length, 0);
    assert.doesNotMatch(operacional, /grant\s+[^\n;]*\bon\s+table\s+public\.mensagens\s+to\s+anon\b/i);

    for (const nome of [POLICY_SELECT, POLICY_INSERT, POLICY_UPDATE]) {
      const bloco = blocoCreatePolicy(lerMigration(), nome);
      assert.doesNotMatch(bloco, /\bto\s+anon\b/i);
      assert.doesNotMatch(bloco, /\bto\s+public\b/i);
    }
  });

  it("B/C) SELECT somente participantes; sem leitura global por is_private=false", () => {
    const bloco = blocoCreatePolicy(lerMigration(), POLICY_SELECT);
    assert.match(bloco, /\bfor\s+select\b/i);
    assert.match(bloco, /\bto\s+authenticated\b/i);
    assert.match(bloco, /auth\.uid\(\)\s*=\s*sender_id/i);
    assert.match(bloco, /auth\.uid\(\)\s*=\s*recipient_id/i);
    assert.doesNotMatch(bloco, /not\s+is_private/i);
    assert.doesNotMatch(bloco, /is_private\s*=\s*false/i);
    assert.doesNotMatch(bloco, /usuario_role_atual\s*\(\s*\)\s*=\s*'admin'/i);
  });

  it("D/E/F/G/H/I/J) INSERT valida combinação de papéis via helper", () => {
    const helper = blocoFuncao(lerMigration(), "usuario_pode_conversar_com");
    const insert = blocoCreatePolicy(lerMigration(), POLICY_INSERT);

    assert.match(helper, /\bstable\b/i);
    assert.match(helper, /security\s+definer/i);
    assert.match(helper, /set\s+search_path\s*=\s*pg_catalog/i);
    assert.match(helper, /public\.usuario_role_atual\s*\(\s*\)\s*=\s*'admin'/i);
    assert.match(helper, /destino\.role[\s\S]*=\s*'admin'/i);
    assert.match(helper, /destinatario\s*<>\s*auth\.uid\(\)/i);

    assert.match(insert, /\bfor\s+insert\b/i);
    assert.match(insert, /usuario_pode_conversar_com\s*\(\s*recipient_id\s*\)/i);
    assert.doesNotMatch(insert, /\busing\s*\(/i);
  });

  it("K/L/M) INSERT exige sender=auth.uid, recipient NOT NULL, sender<>recipient e is_private=true", () => {
    const insert = blocoCreatePolicy(lerMigration(), POLICY_INSERT);
    assert.match(insert, /sender_id\s*=\s*auth\.uid\(\)/i);
    assert.match(insert, /recipient_id\s+is\s+not\s+null/i);
    assert.match(insert, /sender_id\s*<>\s*recipient_id/i);
    assert.match(insert, /\bis_private\s*=\s*true\b/i);
    assert.match(insert, /usuario_pode_conversar_com\s*\(\s*recipient_id\s*\)/i);
    assert.doesNotMatch(insert, /coalesce\s*\(\s*is_private/i);
    assert.match(insert, /attachment_url\s+is\s+null/i);
    assert.match(
      insert,
      /split_part\s*\(\s*btrim\s*\(\s*attachment_url\s*\)\s*,\s*'\/'\s*,\s*1\s*\)\s*=\s*auth\.uid\(\)::text/i,
    );
  });

  it("N/O) UPDATE somente read_at e somente pelo destinatário", () => {
    const sql = lerMigration();
    const update = blocoCreatePolicy(sql, POLICY_UPDATE);
    assert.match(update, /\bfor\s+update\b/i);
    assert.match(update, /recipient_id\s*=\s*auth\.uid\(\)/i);
    assert.match(update, /\bwith\s+check\s*\(\s*recipient_id\s*=\s*auth\.uid\(\)\s*\)/i);

    const colunas = colunasGrant(sql, "update");
    assert.deepEqual(colunas, ["read_at"]);
    for (const bloqueada of ["sender_id", "recipient_id", "content", "attachment_url", "attachment_name", "attachment_type", "attachment_size"]) {
      assert.equal(colunas.includes(bloqueada), false);
    }
    assert.equal(colunasGrant(sql, "insert").includes("read_at"), false);
  });

  it("P) authenticated sem DELETE", () => {
    const operacional = sqlOperacional(lerMigration());
    const tabela = grantsTo(operacional, "authenticated").join(" | ");
    assert.match(tabela, /\bselect\b/);
    assert.match(tabela, /\binsert\b/);
    assert.match(tabela, /\bupdate\b/);
    assert.doesNotMatch(tabela, /\bdelete\b/);
    assert.doesNotMatch(tabela, /\btruncate\b/);
    assert.doesNotMatch(
      operacional,
      /grant\s+(all|delete|truncate|references|trigger)\b[\s\S]{0,80}public\.mensagens/i,
    );
  });

  it("Q) service_role preservado", () => {
    const sql = lerMigration();
    assert.doesNotMatch(sql, /revoke\s+[^\n]*\bfrom\s+service_role\b/i);
    assert.doesNotMatch(sql, /grant\s+[^\n]*\bto\s+service_role\b/i);
  });

  it("U) anexos: bucket privado, INSERT no próprio namespace, SELECT sem bucket inteiro", () => {
    const sql = lerMigration();
    const operacional = sqlOperacional(sql);
    assert.match(operacional, /update\s+storage\.buckets[\s\S]*public\s*=\s*false[\s\S]*chat-attachments/i);

    const insert = blocoCreatePolicy(sql, POLICY_STORAGE_INSERT);
    assert.match(insert, /bucket_id\s*=\s*'chat-attachments'/i);
    assert.match(insert, /storage\.foldername\s*\(\s*name\s*\)/i);
    assert.match(insert, /auth\.uid\(\)::text/i);

    const select = blocoCreatePolicy(sql, POLICY_STORAGE_SELECT);
    assert.match(select, /usuario_pode_acessar_anexo_chat\s*\(\s*name\s*\)/i);
    assert.doesNotMatch(select, /\busing\s*\(\s*true\s*\)/i);
    assert.doesNotMatch(select, /bucket_id\s*=\s*'chat-attachments'\s*\)\s*;/i);

    const helper = blocoFuncao(sql, "usuario_pode_acessar_anexo_chat");
    assert.match(helper, /split_part\s*\(\s*btrim\s*\(\s*caminho\s*\)\s*,\s*'\/'\s*,\s*1\s*\)\s*=\s*auth\.uid\(\)::text/i);
    assert.match(helper, /m\.sender_id\s*=\s*auth\.uid\(\)/i);
    assert.match(helper, /m\.recipient_id\s*=\s*auth\.uid\(\)/i);
    assert.doesNotMatch(helper, /\bilike\b/i);
  });

  it("V/W) policies finais autenticadas, sem USING true público", () => {
    const sql = lerMigration();
    const creates = [...sql.matchAll(/create\s+policy\s+"([^"]+)"/gi)].map((item) => item[1]);
    assert.deepEqual(creates, [
      POLICY_SELECT,
      POLICY_INSERT,
      POLICY_UPDATE,
      POLICY_STORAGE_INSERT,
      POLICY_STORAGE_SELECT,
      POLICY_STORAGE_DELETE,
    ]);

    for (const nome of creates) {
      const bloco = blocoCreatePolicy(sql, nome);
      assert.match(bloco, /\bto\s+authenticated\b/i);
      assert.doesNotMatch(bloco, /\bto\s+public\b/i);
      assert.doesNotMatch(bloco, /\busing\s*\(\s*true\s*\)/i);
      assert.doesNotMatch(bloco, /\bwith\s+check\s*\(\s*true\s*\)/i);
    }

    assert.deepEqual(colunasGrant(sql, "insert"), [...COLUNAS_INSERT]);
  });

  it("não concede EXECUTE das funções novas para anon", () => {
    const operacional = sqlOperacional(lerMigration());
    assert.match(operacional, /revoke\s+all\s+on\s+function\s+public\.usuario_pode_conversar_com\s*\(\s*uuid\s*\)\s+from\s+anon/i);
    assert.match(operacional, /revoke\s+all\s+on\s+function\s+public\.usuario_pode_acessar_anexo_chat\s*\(\s*text\s*\)\s+from\s+anon/i);
    assert.match(operacional, /revoke\s+all\s+on\s+function\s+public\.usuario_pode_excluir_anexo_orfao_chat\s*\(\s*text\s*\)\s+from\s+anon/i);
    assert.match(operacional, /grant\s+execute\s+on\s+function\s+public\.usuario_pode_conversar_com\s*\(\s*uuid\s*\)\s+to\s+authenticated/i);
    assert.match(operacional, /grant\s+execute\s+on\s+function\s+public\.usuario_pode_acessar_anexo_chat\s*\(\s*text\s*\)\s+to\s+authenticated/i);
    assert.match(operacional, /grant\s+execute\s+on\s+function\s+public\.usuario_pode_excluir_anexo_orfao_chat\s*\(\s*text\s*\)\s+to\s+authenticated/i);
    assert.doesNotMatch(operacional, /grant\s+execute[\s\S]{0,80}to\s+anon/i);
  });

  it("não DROP/redefine usuario_role_atual e não usa CASCADE", () => {
    const sql = lerMigration();
    const operacional = sqlOperacional(sql);
    assert.doesNotMatch(operacional, /drop\s+function[\s\S]*usuario_role_atual/i);
    assert.doesNotMatch(operacional, /create\s+or\s+replace\s+function\s+public\.usuario_role_atual\s*\(/i);
    assert.doesNotMatch(operacional, /revoke\s+all\s+on\s+function\s+public\.usuario_role_atual/i);
    assert.doesNotMatch(operacional, /grant\s+execute\s+on\s+function\s+public\.usuario_role_atual/i);
    assert.doesNotMatch(sql, /\bcascade\b/i);
  });

  it("helper da 3B.2 permanece compatível e é reutilizado", () => {
    const etapa3 = ler("documentacao/SUPABASE_REGISTROS_IA_RLS_CLIENTE.sql");
    const etapa4 = lerMigration();
    const helper3b = blocoFuncao(etapa3, "usuario_role_atual");

    assert.match(helper3b, /returns\s+text/i);
    assert.match(helper3b, /from\s+public\.perfis/i);
    assert.match(helper3b, /p\.id\s*=\s*auth\.uid\(\)/i);
    assert.match(helper3b, /set\s+search_path\s*=\s*pg_catalog/i);
    assert.match(etapa4, /public\.usuario_role_atual\s*\(\s*\)/);
    assert.doesNotMatch(etapa4, /create\s+or\s+replace\s+function\s+public\.usuario_role_atual/i);
  });

  it("remove só as policies reais do chat e não toca avatars", () => {
    const sql = lerMigration();
    assert.equal(
      dropPolicy(sql, "Usuários autenticados podem enviar anexos do chat", "storage.objects"),
      true,
    );
    assert.equal(
      dropPolicy(sql, "Usuários autenticados podem visualizar anexos do chat", "storage.objects"),
      true,
    );
    assert.equal(dropPolicy(sql, POLICY_STORAGE_INSERT, "storage.objects"), true);
    assert.equal(dropPolicy(sql, POLICY_STORAGE_SELECT, "storage.objects"), true);
    assert.equal(dropPolicy(sql, POLICY_STORAGE_DELETE, "storage.objects"), true);

    const dropsStorage = [...sql.matchAll(/drop\s+policy\s+if\s+exists\s+"([^"]+)"\s+on\s+storage\.objects/gi)]
      .map((item) => item[1]);
    assert.deepEqual(dropsStorage, [
      "Usuários autenticados podem enviar anexos do chat",
      "Usuários autenticados podem visualizar anexos do chat",
      POLICY_STORAGE_INSERT,
      POLICY_STORAGE_SELECT,
      POLICY_STORAGE_DELETE,
    ]);

    assert.doesNotMatch(sqlOperacional(sql), /\bavatars\b/i);
    assert.doesNotMatch(sql, /Avatar Upload|Avatar View|Avatar Update/i);
    assert.doesNotMatch(sql, /tablename\s*=\s*'objects'/i);
  });

  it("bucket chat-attachments fica public=false, 5 MB e MIME permitidos", () => {
    const sql = lerMigration();
    const operacional = sqlOperacional(sql);
    assert.match(operacional, /update\s+storage\.buckets/i);
    assert.match(operacional, /public\s*=\s*false/i);
    assert.match(operacional, /file_size_limit\s*=\s*5242880/i);
    assert.match(operacional, /allowed_mime_types\s*=\s*ARRAY\[/i);
    assert.match(operacional, /'application\/pdf'/i);
    assert.match(operacional, /'image\/jpeg'/i);
    assert.match(operacional, /'image\/png'/i);
    assert.match(operacional, /'image\/webp'/i);
    assert.match(operacional, /where\s+id\s*=\s*'chat-attachments'/i);
    assert.doesNotMatch(operacional, /update\s+storage\.buckets[\s\S]*avatars/i);
  });

  it("SELECT de anexo: remetente pelo namespace; destinatário só com vínculo; terceiro negado", () => {
    const helper = blocoFuncao(lerMigration(), "usuario_pode_acessar_anexo_chat");
    const insert = blocoCreatePolicy(lerMigration(), POLICY_STORAGE_INSERT);
    const select = blocoCreatePolicy(lerMigration(), POLICY_STORAGE_SELECT);

    assert.match(
      insert,
      /\(storage\.foldername\s*\(\s*name\s*\)\)\[1\]\s*=\s*auth\.uid\(\)::text/i,
    );
    assert.match(
      helper,
      /split_part\s*\(\s*btrim\s*\(\s*caminho\s*\)\s*,\s*'\/'\s*,\s*1\s*\)\s*=\s*auth\.uid\(\)::text/i,
    );
    assert.match(helper, /from\s+public\.mensagens\s+as\s+m/i);
    assert.match(helper, /btrim\s*\(\s*m\.attachment_url\s*\)\s*=\s*btrim\s*\(\s*caminho\s*\)/i);
    assert.match(helper, /m\.sender_id\s*=\s*auth\.uid\(\)[\s\S]*m\.recipient_id\s*=\s*auth\.uid\(\)/i);

    const orMensagem = helper.search(/or exists/i);
    const splitParte = helper.search(/split_part/i);
    assert.ok(splitParte >= 0 && orMensagem > splitParte, "namespace do remetente deve vir antes do vínculo da mensagem");

    assert.match(select, /bucket_id\s*=\s*'chat-attachments'/i);
    assert.match(select, /usuario_pode_acessar_anexo_chat\s*\(\s*name\s*\)/i);
    assert.doesNotMatch(select, /\busing\s*\(\s*true\s*\)/i);
    assert.doesNotMatch(helper, /or\s+true/i);
  });

  it("1/2/3) INSERT permite sem anexo ou path do próprio namespace; recusa path de terceiro", () => {
    const insert = blocoCreatePolicy(lerMigration(), POLICY_INSERT);
    assert.match(insert, /attachment_url\s+is\s+null/i);
    assert.match(
      insert,
      /split_part\s*\(\s*btrim\s*\(\s*attachment_url\s*\)\s*,\s*'\/'\s*,\s*1\s*\)\s*=\s*auth\.uid\(\)::text/i,
    );
    assert.doesNotMatch(insert, /recipient_id::text/i);
    assert.doesNotMatch(insert, /usuario_pode_acessar_anexo_chat/i);
  });

  it("4/5/6/8) DELETE de órfão próprio permitido; terceiro e anexo vinculado negados", () => {
    const helper = blocoFuncao(lerMigration(), "usuario_pode_excluir_anexo_orfao_chat");
    const del = blocoCreatePolicy(lerMigration(), POLICY_STORAGE_DELETE);

    assert.match(helper, /\bstable\b/i);
    assert.match(helper, /security\s+definer/i);
    assert.match(helper, /set\s+search_path\s*=\s*pg_catalog/i);
    assert.match(
      helper,
      /split_part\s*\(\s*btrim\s*\(\s*caminho\s*\)\s*,\s*'\/'\s*,\s*1\s*\)\s*=\s*auth\.uid\(\)::text/i,
    );
    assert.match(helper, /not exists/i);
    assert.match(helper, /from\s+public\.mensagens\s+as\s+m/i);
    assert.match(helper, /btrim\s*\(\s*m\.attachment_url\s*\)\s*=\s*btrim\s*\(\s*caminho\s*\)/i);
    assert.doesNotMatch(helper, /m\.sender_id\s*=\s*auth\.uid\(\)/i);
    assert.doesNotMatch(helper, /or exists/i);

    assert.match(del, /\bfor\s+delete\b/i);
    assert.match(del, /\bto\s+authenticated\b/i);
    assert.match(del, /bucket_id\s*=\s*'chat-attachments'/i);
    assert.match(del, /\(storage\.foldername\s*\(\s*name\s*\)\)\[1\]\s*=\s*auth\.uid\(\)::text/i);
    assert.match(del, /usuario_pode_excluir_anexo_orfao_chat\s*\(\s*name\s*\)/i);
    assert.doesNotMatch(del, /\busing\s*\(\s*true\s*\)/i);
    assert.doesNotMatch(del, /or\s+true/i);
  });
});

describe("Etapa 4 — backend não precisa de API de chat", () => {
  it("chat de suporte não tem rotas; exclusão de conta permanece service_role", () => {
    const app = ler("backend/src/aplicacao.ts");
    const admin = ler("backend/src/controladores/administracao.controlador.ts");
    assert.doesNotMatch(app, /\/chat/i);
    assert.doesNotMatch(app, /mensagensRotas|chatRotas/);
    assert.match(admin, /from\(TABELAS_SUPABASE\.MENSAGENS\)\.delete\(\)/);
  });
});
