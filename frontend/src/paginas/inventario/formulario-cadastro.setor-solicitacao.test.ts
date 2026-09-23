import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const formulario = readFileSync(new URL("./FormularioCadastro.tsx", import.meta.url), "utf8");
const inventario = readFileSync(new URL("./Inventario.tsx", import.meta.url), "utf8");
const armazenamento = readFileSync(
  new URL("../../servicos/armazenamento.ts", import.meta.url),
  "utf8",
);
const aplicacao = readFileSync(
  new URL("../../hooks/useAplicacao.ts", import.meta.url),
  "utf8",
);

describe("setor da Nova Solicitação", () => {
  it("mostra dropdown somente com todos os setores vinculados ao perfil", () => {
    assert.match(formulario, /label="Setor da solicitação"/);
    assert.match(formulario, /options=\{opcoesSetorSolicitacao\}/);
    assert.match(formulario, /obterSetoresVinculadosPerfil\(profile\?\.setor\)/);
    assert.match(formulario, /edicaoAdministrativa: isEdicaoAdministrativa/);
    assert.doesNotMatch(formulario, /getSectors\(\)/);
  });

  it("seleciona automaticamente um setor e exige escolha quando há vários", () => {
    assert.match(formulario, /definirSetorInicialSolicitacao\(setoresVinculados/);
    assert.match(formulario, /selecionarSetorSolicitacao/);
    assert.match(formulario, /Selecione o setor responsável pela solicitação\./);
  });

  it("espelha o setor escolhido na coluna e no JSON do registro", () => {
    assert.match(formulario, /unidadeSetor: cleanSector/);
    assert.match(armazenamento, /data: recordWithStatus/);
    assert.match(armazenamento, /unidade_setor: record\.unidadeSetor \|\| ''/);
  });
});

describe("setor na edição administrativa", () => {
  it("B. inicializa o campo com o setor do registro e nunca com o do admin", () => {
    assert.match(formulario, /if \(initialData\) \{\s*setFormData\(initialData\)/);
    assert.match(
      formulario,
      /const isEdicaoAdministrativa = Boolean\(initialData && isAdmin\)/,
    );
    assert.match(
      formulario,
      /const setorOriginalRegistro = \(initialData\?\.unidadeSetor \|\| ""\)\.trim\(\)/,
    );
    // A inicialização por perfil só roda fora do modo edição.
    assert.match(formulario, /if \(initialData \|\| !profile \|\| !isInitialized\) return;/);
  });

  it("C/H. nenhuma rotina assíncrona reescreve o setor de um registro em edição", () => {
    assert.match(formulario, /edicaoEmAndamentoRef\.current = Boolean\(initialData\)/);
    const guardas = formulario.match(/if \(edicaoEmAndamentoRef\.current\) return;/g) || [];
    assert.equal(guardas.length, 3);
    // O cargo do solicitante original também não é reconstruído pelo perfil do admin.
    assert.match(formulario, /isEdicaoAdministrativa \?\s*\n?\s*prev\.cargo/);
    assert.match(formulario, /isEdicaoAdministrativa \?\s*\n?\s*formData\.cargo \|\| "" :/);
  });

  it("D. oferece os setores ativos de public.sectors sem limitar ao perfil do admin", () => {
    assert.match(formulario, /import \{ obterSetoresAtivos \} from "@\/servicos\/setores"/);
    assert.match(formulario, /if \(!isEdicaoAdministrativa\) return;\s*\n\s*let ativo = true;/);
    assert.match(formulario, /setSetoresAtivos\(setores\.map\(\(setor\) => setor\.name\)\)/);
    assert.match(formulario, /setorOriginal: setorOriginalRegistro/);
  });

  it("E/F. somente administradores abrem e salvam a edição administrativa", () => {
    assert.match(inventario, /\{isAdmin && \([\s\S]{0,200}onEdit\(record\)[\s\S]{0,120}Editar cadastro/);
    assert.match(aplicacao, /const handleEdit = \(record: IARecord\) => \{\s*\n\s*if \(!isCurrentUserAdmin\) return;/);
    assert.match(aplicacao, /if \(!isAdmin\) \{\s*\n\s*throw new Error\("Somente administradores podem editar cadastros\."\);/);
    assert.match(armazenamento, /export const updateRecord[\s\S]{0,160}Somente administradores podem editar cadastros\./);
    // Moderador não é admin: a edição continua restrita ao papel admin.
    assert.doesNotMatch(aplicacao, /handleEdit[\s\S]{0,120}isCurrentUserPrivileged/);
  });

  it("G. o owner_id original é preservado na atualização", () => {
    assert.match(armazenamento, /modo === "criar"[\s\S]{0,400}select\("owner_id"\)/);
    assert.match(armazenamento, /if \(modo === "criar"\) payload\.owner_id = resolvedOwnerId;/);
  });
});

describe("completude de perfil na edição administrativa", () => {
  it("não usa o perfil do admin como requisito quando initialData e isAdmin", () => {
    assert.match(formulario, /perfilImpedeEtapaSolicitacao\(\{\s*\n\s*edicaoAdministrativa: isEdicaoAdministrativa,/);
    assert.match(formulario, /const isEdicaoAdministrativa = Boolean\(initialData && isAdmin\)/);
    assert.doesNotMatch(
      formulario,
      /const isProfileIncompleteForStep1 = \(\(\) => \{\s*\n\s*if \(!profile/,
    );
  });

  it("E/F. moderator e user continuam sem edição administrativa", () => {
    assert.match(inventario, /\{isAdmin && \([\s\S]{0,200}onEdit\(record\)[\s\S]{0,120}Editar cadastro/);
    assert.match(aplicacao, /if \(!isCurrentUserAdmin\) return;/);
    assert.doesNotMatch(aplicacao, /handleEdit[\s\S]{0,120}isCurrentUserPrivileged/);
    assert.match(aplicacao, /Somente administradores podem editar cadastros\./);
  });
});
