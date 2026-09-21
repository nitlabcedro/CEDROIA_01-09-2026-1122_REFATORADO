import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const formulario = readFileSync(new URL("./FormularioCadastro.tsx", import.meta.url), "utf8");
const armazenamento = readFileSync(
  new URL("../../servicos/armazenamento.ts", import.meta.url),
  "utf8",
);

describe("setor da Nova Solicitação", () => {
  it("mostra dropdown somente com todos os setores vinculados ao perfil", () => {
    assert.match(formulario, /label="Setor da solicitação"/);
    assert.match(formulario, /options=\{setoresVinculados\}/);
    assert.match(formulario, /obterSetoresVinculadosPerfil\(profile\?\.setor\)/);
    assert.doesNotMatch(formulario, /getSectors\(\)/);
  });

  it("seleciona automaticamente um setor e exige escolha quando há vários", () => {
    assert.match(formulario, /definirSetorInicialSolicitacao\(setoresVinculados/);
    assert.match(formulario, /selecionarSetorSolicitacao/);
    assert.match(formulario, /Selecione o setor responsável pela solicitação\./);
  });

  it("carrega o setor salvo na edição e limita alterações aos vínculos atuais", () => {
    assert.match(formulario, /if \(initialData\) \{\s*setFormData\(initialData\)/);
    assert.match(formulario, /!setoresVinculados\.includes\(formData\.unidadeSetor\.trim\(\)\)/);
    assert.match(formulario, /obterCargoVinculadoAoSetor\(setor/);
  });

  it("espelha o setor escolhido na coluna e no JSON do registro", () => {
    assert.match(formulario, /unidadeSetor: cleanSector/);
    assert.match(armazenamento, /data: recordWithStatus/);
    assert.match(armazenamento, /unidade_setor: record\.unidadeSetor \|\| ''/);
  });
});
