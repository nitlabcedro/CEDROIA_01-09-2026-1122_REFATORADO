import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const perfil = readFileSync(
  resolve(process.cwd(), "frontend/src/paginas/autenticacao/PerfilUsuario.tsx"),
  "utf8",
);

describe("feedback do upload de avatar", () => {
  it("mostra processamento no avatar e desabilita a câmera", () => {
    assert.match(perfil, /perfil__avatar-upload-overlay/);
    assert.match(perfil, /Enviando\.\.\./);
    assert.match(perfil, /disabled=\{uploading\}/);
    assert.match(perfil, /if \(uploading\) return/);
  });

  it("encerra loading tanto no sucesso quanto no erro", () => {
    assert.match(perfil, /finally\s*\{[\s\S]*setUploading\(false\)/);
    assert.match(perfil, /Foto atualizada com sucesso\./);
    assert.match(perfil, /Não foi possível atualizar a foto\. Tente novamente\./);
  });

  it("restaura o avatar anterior quando o upload falha", () => {
    assert.match(perfil, /avatarAnterior/);
    assert.match(perfil, /setAvatarPreview\(avatarAnterior\.preview\)/);
    assert.match(perfil, /avatar_url:\s*avatarAnterior\.url/);
  });

  it("remove o banner amarelo antigo", () => {
    assert.doesNotMatch(perfil, /perfil__grupo-enviando-foto/);
    assert.doesNotMatch(perfil, /Aguarde alguns segundos até a imagem ser salva no perfil/);
  });
});
