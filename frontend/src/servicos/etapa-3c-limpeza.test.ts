import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

function ler(relativo: string): string {
  return readFileSync(resolve(process.cwd(), relativo), "utf8");
}

describe("Etapa 3C — limpeza técnica", () => {
  const armazenamento = ler("frontend/src/servicos/armazenamento.ts");
  const persistir = armazenamento.slice(
    armazenamento.indexOf("async function persistirRegistroIa"),
    armazenamento.indexOf("export const updateRecord"),
  );
  const hook = ler("frontend/src/hooks/useAplicacao.ts");
  const inventario = ler("frontend/src/paginas/inventario/Inventario.tsx");
  const aplicacao = ler("frontend/src/Aplicacao.tsx");
  const sw = ler("frontend/public/sw.js");
  const principal = ler("frontend/src/principal.tsx");

  it("não reintroduz SELECT global nem escrita em massa", () => {
    assert.doesNotMatch(armazenamento, /getGlobalRecords|seedGlobalRecordsCache/);
    assert.doesNotMatch(armazenamento, /saveRecordsToSupabase|addOrUpdateRecord/);
    assert.doesNotMatch(armazenamento, /Buscando todos os registros públicos/);
    assert.doesNotMatch(hook, /handleSync|saveRecordsToSupabase/);
  });

  it("criação/edição não gravam inventário legado no localStorage", () => {
    assert.doesNotMatch(persistir, /localStorage\.setItem\(STORAGE_KEY/);
    assert.doesNotMatch(persistir, /Local fallback/);
    assert.match(armazenamento, /localStorage\.removeItem\(STORAGE_KEY\)/);
  });

  it("DEFAULT_SECTORS hardcoded foi removido; setores oficiais continuam em public.sectors", () => {
    assert.doesNotMatch(armazenamento, /export const DEFAULT_SECTORS/);
    assert.match(armazenamento, /carregarSetoresGestaoDoSupabase/);
  });

  it("inventário não expõe exclusão direta; exclusão permanece no painel admin", () => {
    assert.doesNotMatch(inventario, /onDelete/);
    assert.doesNotMatch(aplicacao, /Inventario[\s\S]{0,400}onDelete=\{handleDelete\}/);
    assert.match(aplicacao, /onDeleteRecord=\{handleDelete\}/);
  });

  it("METADATA-SECTORS permanece só como filtro defensivo de leitura", () => {
    const ocorrencias = armazenamento.match(/METADATA-SECTORS/g) || [];
    assert.equal(ocorrencias.length, 1);
    assert.match(armazenamento, /filter\(item => item\.id !== 'METADATA-SECTORS'\)/);
  });

  it("service worker usa network-first para HTML e cache versionado para /assets/", () => {
    assert.match(sw, /cedro-ia-cache-v2/);
    assert.doesNotMatch(sw, /cedro-ia-cache-v1/);
    assert.match(sw, /buscarRedePrimeiro/);
    assert.match(sw, /ehNavegacao/);
    assert.match(sw, /pathname\.startsWith\("\/assets\/"\)/);
    assert.match(sw, /chaves\.filter\(\(chave\) => chave !== CACHE_NAME\)/);
    assert.match(sw, /skipWaiting/);
    assert.match(sw, /clients\.claim/);
    assert.doesNotMatch(sw, /ASSETS_BASICOS = \['\/'/);
    assert.match(principal, /updateViaCache:\s*"none"/);
  });
});
