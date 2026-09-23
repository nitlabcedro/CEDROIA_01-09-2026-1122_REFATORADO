import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { filtrarContatosChat, podeConversarNoChat } from "../utilitarios/chat-suporte";
import {
  extrairCaminhoAnexoChat,
  LIMITE_BYTES_ANEXO_CHAT,
  limparAnexoChatAposFalhaDeMensagem,
  montarCaminhoAnexoChat,
  sanitizarNomeArquivoAnexo,
  validarAnexoChat,
} from "./chat-anexos-caminho";
import type { UserProfile } from "../tipos";

function ler(relativo: string): string {
  return readFileSync(resolve(process.cwd(), relativo), "utf8");
}

function perfil(id: string, role: UserProfile["role"]): UserProfile {
  return {
    id,
    full_name: id,
    setor: "NIT",
    cargo: role,
    contato: "",
    role,
    avatar_url: "",
    status: "Autorizado",
  };
}

describe("Etapa 4 — chat de suporte", () => {
  const user = perfil("user-1", "user");
  const user2 = perfil("user-2", "user");
  const moderator = perfil("mod-1", "moderator");
  const moderator2 = perfil("mod-2", "moderator");
  const admin = perfil("admin-1", "admin");
  const admin2 = perfil("admin-2", "admin");

  it("R) user lista somente admins", () => {
    const lista = filtrarContatosChat(user, [user, user2, moderator, admin, admin2]);
    assert.deepEqual(lista.map((item) => item.id), ["admin-1", "admin-2"]);
  });

  it("S) admin lista users e moderators (e outros admins)", () => {
    const lista = filtrarContatosChat(admin, [user, user2, moderator, admin, admin2]);
    assert.deepEqual(lista.map((item) => item.id), ["user-1", "user-2", "mod-1", "admin-2"]);
  });

  it("D/E/F/G/H/I/J) matriz de envio no cliente", () => {
    assert.equal(podeConversarNoChat(user, admin), true);
    assert.equal(podeConversarNoChat(user, user2), false);
    assert.equal(podeConversarNoChat(user, moderator), false);
    assert.equal(podeConversarNoChat(moderator, admin), true);
    assert.equal(podeConversarNoChat(moderator, user), false);
    assert.equal(podeConversarNoChat(moderator, moderator2), false);
    assert.equal(podeConversarNoChat(admin, user), true);
    assert.equal(podeConversarNoChat(admin, moderator), true);
    assert.equal(podeConversarNoChat(admin, admin2), true);
    assert.equal(podeConversarNoChat(admin, admin), false);
  });

  it("moderator não aparece como contato de user", () => {
    assert.equal(filtrarContatosChat(user, [moderator]).length, 0);
    assert.equal(filtrarContatosChat(moderator, [user, moderator2, admin]).map((item) => item.id).join(), "admin-1");
  });
});

describe("Etapa 4 — anexos de chat", () => {
  it("monta path no namespace do remetente", () => {
    const caminho = montarCaminhoAnexoChat("abc-uuid", "relatorio.pdf", "id-1");
    assert.equal(caminho.startsWith("abc-uuid/"), true);
    assert.match(caminho, /\/id-1\//);
    assert.equal(caminho.endsWith("relatorio.pdf"), true);
  });

  it("sanitiza nome e extrai path de URL pública legada", () => {
    assert.equal(sanitizarNomeArquivoAnexo("../a b.pdf"), "a-b.pdf");
    const extraido = extrairCaminhoAnexoChat(
      "https://xyz.supabase.co/storage/v1/object/public/chat-attachments/abc/id/arquivo.pdf",
    );
    assert.equal(extraido, "abc/id/arquivo.pdf");
    assert.equal(extrairCaminhoAnexoChat("abc/id/arquivo.pdf"), "abc/id/arquivo.pdf");
  });

  it("A) arquivo > 5 MB recusado no frontend", () => {
    const erro = validarAnexoChat({ size: LIMITE_BYTES_ANEXO_CHAT + 1, type: "application/pdf" });
    assert.equal(erro, "Arquivo muito grande. O limite é 5 MB.");
    assert.equal(validarAnexoChat({ size: LIMITE_BYTES_ANEXO_CHAT, type: "application/pdf" }), null);
  });

  it("B/C/D/E) PDF, JPEG, PNG e WEBP permitidos", () => {
    assert.equal(validarAnexoChat({ size: 10, type: "application/pdf" }), null);
    assert.equal(validarAnexoChat({ size: 10, type: "image/jpeg" }), null);
    assert.equal(validarAnexoChat({ size: 10, type: "image/png" }), null);
    assert.equal(validarAnexoChat({ size: 10, type: "image/webp" }), null);
  });

  it("F/G) ZIP e SVG recusados", () => {
    assert.equal(validarAnexoChat({ size: 10, type: "application/zip" }), "Formato não permitido. Envie PDF, JPG, PNG ou WEBP.");
    assert.equal(validarAnexoChat({ size: 10, type: "image/svg+xml" }), "Formato não permitido. Envie PDF, JPG, PNG ou WEBP.");
    assert.equal(validarAnexoChat({ size: 10, type: "" }), "Formato não permitido. Envie PDF, JPG, PNG ou WEBP.");
  });

  it("7) INSERT falho tenta remover órfão e preserva o erro original", async () => {
    const original = { message: "rls insert" };
    const avisos: unknown[] = [];
    let removido = "";

    const devolvido = await limparAnexoChatAposFalhaDeMensagem({
      caminho: "user-1/id/arquivo.pdf",
      erroOriginal: original,
      remover: async (caminho) => {
        removido = caminho;
        return { error: null };
      },
    });

    assert.equal(removido, "user-1/id/arquivo.pdf");
    assert.equal(devolvido, original);

    const devolvidoComFalha = await limparAnexoChatAposFalhaDeMensagem({
      caminho: "user-1/id/arquivo.pdf",
      erroOriginal: original,
      remover: async () => {
        throw new Error("storage remove");
      },
      avisar: (_mensagem, erro) => avisos.push(erro),
    });

    assert.equal(devolvidoComFalha, original);
    assert.equal(avisos.length, 1);
  });
});

describe("Etapa 4 — frontend Chat / realtime / perfil", () => {
  const chat = ler("frontend/src/paginas/chat/Chat.tsx");
  const hook = ler("frontend/src/hooks/useAplicacao.ts");
  const modal = ler("frontend/src/paginas/chat/PerfilChatModal.tsx");
  const anexo = ler("frontend/src/servicos/chat-anexos.ts");

  it("interface de suporte e lista filtrada", () => {
    assert.match(chat, /Suporte Cedro IA/);
    assert.match(chat, /Fale com a equipe administrativa/);
    assert.match(chat, /filtrarContatosChat\(profile/);
    assert.match(chat, /podeConversarNoChat\(profile, destinatario\)/);
    assert.match(chat, /montarCaminhoAnexoChat/);
    assert.match(chat, /ChatAnexoDownload/);
    assert.match(chat, /validarAnexoChat/);
    assert.match(chat, /limparAnexoChatAposFalhaDeMensagem/);
    assert.match(chat, /removerObjetoAnexoChat/);
    assert.doesNotMatch(chat, /type="file"[\s\S]{0,200}multiple/);
    assert.match(chat, /accept="application\/pdf,image\/jpeg,image\/png,image\/webp/);
    assert.doesNotMatch(chat, /10 \* 1024 \* 1024/);
    assert.doesNotMatch(chat, /"doc", "docx"/);
    assert.doesNotMatch(chat, /getPublicUrl/);
    assert.doesNotMatch(chat, /\.from\(TABELAS_SUPABASE\.MENSAGENS\)[\s\S]{0,80}\.delete\(/);
    assert.doesNotMatch(chat, /Excluir mensagem/);
    assert.doesNotMatch(chat, /attachment_urls|attachments:\s*\[/);
  });

  it("T) realtime filtra sender/recipient; não assina mensagens globais", () => {
    assert.match(chat, /filter:\s*`recipient_id=eq\.\$\{user\.id\}`/);
    assert.match(chat, /filter:\s*`sender_id=eq\.\$\{user\.id\}`/);
    assert.doesNotMatch(
      chat,
      /table:\s*TABELAS_SUPABASE\.MENSAGENS,\s*\n\s*\}/,
    );
    assert.match(hook, /filter:\s*`recipient_id=eq\.\$\{user\.id\}`/);
    assert.doesNotMatch(hook, /table:\s*TABELAS_SUPABASE\.MENSAGENS\s*\}/);
    assert.doesNotMatch(hook, /!msg\.is_private/);
  });

  it("U) download usa URL assinada; PerfilChatModal conta por owner_id", () => {
    assert.match(anexo, /createSignedUrl/);
    assert.doesNotMatch(anexo, /getPublicUrl/);
    assert.match(modal, /eq\("owner_id", profile\.id\)/);
    assert.doesNotMatch(modal, /responsavel_preenchimento/);
  });

  it("7) cleanup chama remove após falha do INSERT; 8) não apaga anexo enviado normalmente", () => {
    assert.match(anexo, /removerObjetoAnexoChat/);
    assert.match(anexo, /\.remove\(\[caminho\]\)/);
    assert.match(chat, /limparAnexoChatAposFalhaDeMensagem/);
    assert.match(chat, /removerObjetoAnexoChat/);
    assert.doesNotMatch(chat, /\.storage[\s\S]{0,120}\.remove\(/);
    assert.match(chat, /if \(insertError\)[\s\S]{0,400}limparAnexoChatAposFalhaDeMensagem/);
    assert.doesNotMatch(chat, /if \(!insertError\)[\s\S]{0,400}limparAnexoChatAposFalhaDeMensagem/);
    assert.doesNotMatch(chat, /if \(insertData\)[\s\S]{0,400}limparAnexoChatAposFalhaDeMensagem/);
    assert.doesNotMatch(chat, /removerObjetoAnexoChat\(msg\.attachment_url/);
  });
});
