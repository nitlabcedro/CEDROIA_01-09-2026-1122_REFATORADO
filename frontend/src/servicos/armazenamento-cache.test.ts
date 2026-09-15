import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IARecord, UserProfile } from "@/tipos";
import {
  getGlobalRecords,
  getProfiles,
  seedGlobalRecordsCache,
  seedProfilesCache,
} from "./armazenamento";

describe("armazenamento cache", () => {
  it("reutiliza registros em cache após seedGlobalRecordsCache sem nova consulta obrigatória", async () => {
    const mock: IARecord[] = [
      {
        id: "IA-CEDRO-0099",
        nomeFerramenta: "Mock",
        unidadeSetor: "TI",
      } as IARecord,
    ];

    seedGlobalRecordsCache(mock);
    const fromCache = await getGlobalRecords();

    assert.equal(fromCache.length, 1);
    assert.equal(fromCache[0].id, "IA-CEDRO-0099");
  });

  it("reutiliza perfis em cache após seedProfilesCache", async () => {
    const mock: UserProfile[] = [
      {
        id: "user-1",
        full_name: "Usuário Teste",
        setor: "TI",
      } as UserProfile,
    ];

    seedProfilesCache(mock);
    const fromCache = await getProfiles();

    assert.equal(fromCache.length, 1);
    assert.equal(fromCache[0].full_name, "Usuário Teste");
  });

  it("deduplica chamadas simultâneas idênticas a getGlobalRecords", async () => {
    const mock: IARecord[] = [
      { id: "IA-CEDRO-0001", nomeFerramenta: "A", unidadeSetor: "TI" } as IARecord,
    ];
    seedGlobalRecordsCache(mock);

    const [a, b] = await Promise.all([getGlobalRecords(), getGlobalRecords()]);
    assert.equal(a.length, b.length);
    assert.equal(a[0].id, b[0].id);
  });
});
