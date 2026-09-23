import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const servico = readFileSync(
  fileURLToPath(new URL("./registros-exclusao.servico.ts", import.meta.url)),
  "utf8",
);
const rotas = readFileSync(
  fileURLToPath(new URL("../rotas/registros.rotas.ts", import.meta.url)),
  "utf8",
);
const autorizacao = readFileSync(
  fileURLToPath(new URL("../middlewares/autorizacao.middleware.ts", import.meta.url)),
  "utf8",
);

describe("DELETE /api/registros/:id", () => {
  it("K/L/M — exige JWT e aceita exclusivamente o papel admin", () => {
    assert.match(rotas, /registrosRotas\.use\(autenticar\)/);
    assert.match(
      rotas,
      /registrosRotas\.delete\("\/:id", autorizarPapeis\("admin"\), excluirRegistroIa\)/,
    );
    assert.doesNotMatch(rotas, /autorizarPapeis\([^)]*(?:moderator|user)/);
    assert.match(autorizacao, /papeisNormalizados\.includes\(papel\)/);
    assert.match(autorizacao, /res\.status\(403\)/);
  });

  it("retorna 404 antes de excluir quando o registro não existe", () => {
    assert.match(servico, /\.from\(TABELAS_SUPABASE\.REGISTROS_IA\)[\s\S]*\.maybeSingle\(\)/);
    assert.match(servico, /if \(!registro\)[\s\S]*res\.status\(404\)/);
  });

  it("N — remove etapas, fluxos e depois o registro usando service_role", () => {
    assert.match(servico, /obterClienteSupabase\(\)/);

    const indiceEtapas = servico.indexOf("TABELAS_SUPABASE.ETAPAS_APROVACAO");
    const indiceFluxosDelete = servico.indexOf(
      "TABELAS_SUPABASE.FLUXOS_APROVACAO",
      servico.indexOf("const resultadoFluxos"),
    );
    const indiceRegistroDelete = servico.indexOf(
      "TABELAS_SUPABASE.REGISTROS_IA",
      servico.indexOf("const resultadoRegistro"),
    );

    assert.ok(indiceEtapas > 0);
    assert.ok(indiceFluxosDelete > indiceEtapas);
    assert.ok(indiceRegistroDelete > indiceFluxosDelete);
    assert.match(servico, /\.delete\(\)[\s\S]*\.in\("workflow_id", idsFluxos\)/);
    assert.match(servico, /\.delete\(\)[\s\S]*\.in\("id", idsFluxos\)/);
    assert.match(servico, /\.delete\(\)[\s\S]*\.eq\("id", id\)/);
  });
});
