import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const perfil = readFileSync(
  resolve(process.cwd(), "frontend/src/paginas/autenticacao/PerfilUsuario.tsx"),
  "utf8",
);

const perfilChat = readFileSync(
  resolve(process.cwd(), "frontend/src/paginas/chat/PerfilChatModal.tsx"),
  "utf8",
);

const administracao = readFileSync(
  resolve(process.cwd(), "frontend/src/paginas/administracao/PainelAdministrativo.tsx"),
  "utf8",
);

describe("status visual de contas", () => {
  it("não exibe Pendente/Ativo a partir do campo legado profile.status", () => {
    assert.doesNotMatch(perfil, /obterRotuloStatusPerfil\(profile\?\.status\)/);
    assert.doesNotMatch(perfilChat, /profile\.status === "Autorizado"/);
  });

  it("explica corretamente que o indicador administrativo se refere às solicitações", () => {
    assert.match(administracao, />Sem solicitações em andamento<\/option>/);
    assert.match(administracao, />Com solicitações em andamento<\/option>/);
    assert.match(administracao, /"Com solicitações em andamento"\s*:\s*"Sem solicitações em andamento"/);
    assert.doesNotMatch(administracao, />Conformidade<\/option>/);
    assert.doesNotMatch(administracao, />Pendências<\/option>/);
  });
});
