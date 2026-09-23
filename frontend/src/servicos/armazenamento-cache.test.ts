import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { UserProfile } from "@/tipos";
import {
  getProfiles,
  seedProfilesCache,
} from "./armazenamento";

describe("armazenamento cache", () => {
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

});
