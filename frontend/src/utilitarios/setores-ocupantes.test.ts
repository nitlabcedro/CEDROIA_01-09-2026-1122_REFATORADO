import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  agruparOcupantesPorCargo,
  perfilPertenceAoSetor,
  setorCorrespondeBusca,
  textoMinusculoSeguro,
} from "./setores-ocupantes";

describe("ocupantes de cargo no mesmo setor", () => {
  const nit = "Núcleo de Inovação e Tecnologia";

  it("permite vários usuários no mesmo cargo do mesmo setor", () => {
    const grupos = agruparOcupantesPorCargo(
      nit,
      ["Analista de Dados", "Analista de Desenvolvimento de Sistemas", "Auxiliar Administrativo"],
      [
        { full_name: "Usuário A", setor: nit, cargo: "Analista de Dados" },
        { full_name: "Usuário B", setor: nit, cargo: "Analista de Dados" },
        { full_name: "Usuário C", setor: nit, cargo: "Analista de Dados" },
        { full_name: "Usuário D", setor: nit, cargo: "Analista de Desenvolvimento de Sistemas" },
        { full_name: "Usuário E", setor: nit, cargo: "Auxiliar Administrativo" },
        { full_name: "Outro setor", setor: "TI", cargo: "Analista de Dados" },
      ],
    );

    const analistas = grupos.find((item) => item.cargo === "Analista de Dados");
    assert.deepEqual(analistas?.usuarios, ["Usuário A", "Usuário B", "Usuário C"]);
    assert.equal(grupos.find((item) => item.cargo === "Analista de Desenvolvimento de Sistemas")?.usuarios.length, 1);
    assert.equal(grupos.find((item) => item.cargo === "Auxiliar Administrativo")?.usuarios.length, 1);
  });

  it("reconhece vínculo mesmo quando o perfil serializa vários pares com '; '", () => {
    assert.equal(
      perfilPertenceAoSetor(
        { setor: "NIT; TI", cargo: "Analista; Dev" },
        "TI",
      ),
      true,
    );
    assert.equal(
      perfilPertenceAoSetor(
        { setor: "NIT; TI", cargo: "Analista; Dev" },
        "Financeiro",
      ),
      false,
    );
  });

  it("não quebra busca quando name ou responsible estão ausentes", () => {
    assert.equal(textoMinusculoSeguro(undefined), "");
    assert.equal(textoMinusculoSeguro(null), "");
    assert.equal(
      setorCorrespondeBusca("inovação", [undefined, null, "Núcleo de Inovação"]),
      true,
    );
    assert.equal(
      setorCorrespondeBusca("maria", ["TI", undefined, "João"]),
      false,
    );
  });
});
