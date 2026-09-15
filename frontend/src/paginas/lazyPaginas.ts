import { lazy, type ComponentType } from "react";

function lazyNamed<T extends ComponentType<unknown>>(
  loader: () => Promise<Record<string, T>>,
  exportName: string
) {
  return lazy(() =>
    loader().then((modulo) => {
      const componente = modulo[exportName];
      if (!componente) {
        throw new Error(`Export "${exportName}" não encontrado no módulo lazy.`);
      }
      return { default: componente };
    })
  );
}

export const Painel = lazy(() => import("@/paginas/painel/Painel"));
export const Inventario = lazy(() => import("@/paginas/inventario/Inventario"));
export const MapaSetores = lazy(() => import("@/paginas/relatorios/MapaSetores"));
export const PainelAdministrativo = lazy(() => import("@/paginas/administracao/PainelAdministrativo"));
export const GerenciadorSetores = lazy(() => import("@/paginas/administracao/GerenciadorSetores"));
export const FormularioCadastro = lazy(() => import("@/paginas/inventario/FormularioCadastro"));
export const VisualizacaoRelatorio = lazy(() => import("@/paginas/relatorios/VisualizacaoRelatorio"));
export const PaginaAprovacao = lazy(() => import("@/paginas/aprovacoes/PaginaAprovacao"));
export const RedefinirSenha = lazy(() => import("@/paginas/autenticacao/RedefinirSenha"));

export const Autenticacao = lazyNamed(
  () => import("@/paginas/autenticacao/Autenticacao"),
  "Auth"
);
export const PerfilUsuario = lazyNamed(
  () => import("@/paginas/autenticacao/PerfilUsuario"),
  "UserProfileView"
);
export const Chat = lazyNamed(() => import("@/paginas/chat/Chat"), "Chat");
