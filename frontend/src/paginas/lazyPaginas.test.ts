import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lazy } from "react";

import {
  Autenticacao,
  Chat,
  FormularioCadastro,
  GerenciadorSetores,
  Inventario,
  MapaSetores,
  PaginaAprovacao,
  Painel,
  PainelAdministrativo,
  PerfilUsuario,
  RedefinirSenha,
  VisualizacaoRelatorio,
} from "./lazyPaginas";

function assertLazyComponent(componente: unknown, nome: string) {
  assert.equal(
    (componente as { $$typeof?: symbol }).$$typeof,
    lazy(() => Promise.resolve({ default: () => null })).$$typeof,
    `${nome} deve ser um componente React.lazy`
  );
}

describe("lazyPaginas", () => {
  it("exporta todas as páginas como React.lazy", () => {
    assertLazyComponent(Painel, "Painel");
    assertLazyComponent(Inventario, "Inventario");
    assertLazyComponent(FormularioCadastro, "FormularioCadastro");
    assertLazyComponent(MapaSetores, "MapaSetores");
    assertLazyComponent(PainelAdministrativo, "PainelAdministrativo");
    assertLazyComponent(GerenciadorSetores, "GerenciadorSetores");
    assertLazyComponent(VisualizacaoRelatorio, "VisualizacaoRelatorio");
    assertLazyComponent(PaginaAprovacao, "PaginaAprovacao");
    assertLazyComponent(RedefinirSenha, "RedefinirSenha");
    assertLazyComponent(Autenticacao, "Autenticacao");
    assertLazyComponent(PerfilUsuario, "PerfilUsuario");
    assertLazyComponent(Chat, "Chat");
  });
});
