import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { persistirCancelamentoCoerente } from "./cancelamento-solicitacao";

describe("persistirCancelamentoCoerente", () => {
  it("persiste workflow cancelado e registro antes de permitir sucesso", async () => {
    const chamadas: string[] = [];

    await persistirCancelamentoCoerente({
      persistirWorkflowCancelado: async () => { chamadas.push("workflow"); },
      persistirRegistroCancelado: async () => { chamadas.push("registro"); },
      restaurarWorkflow: async () => { chamadas.push("restauracao"); },
    });

    assert.deepEqual(chamadas, ["workflow", "registro"]);
  });

  it("não persiste o registro nem conclui quando o workflow falha", async () => {
    let registroFoiPersistido = false;

    await assert.rejects(
      persistirCancelamentoCoerente({
        persistirWorkflowCancelado: async () => {
          throw new Error("Falha no workflow");
        },
        persistirRegistroCancelado: async () => {
          registroFoiPersistido = true;
        },
        restaurarWorkflow: async () => {},
      }),
      /Falha no workflow/,
    );

    assert.equal(registroFoiPersistido, false);
  });

  it("restaura o workflow se o registro falhar", async () => {
    let workflowRestaurado = false;

    await assert.rejects(
      persistirCancelamentoCoerente({
        persistirWorkflowCancelado: async () => {},
        persistirRegistroCancelado: async () => {
          throw new Error("Falha no registro");
        },
        restaurarWorkflow: async () => {
          workflowRestaurado = true;
        },
      }),
      /Falha no registro/,
    );

    assert.equal(workflowRestaurado, true);
  });
});
