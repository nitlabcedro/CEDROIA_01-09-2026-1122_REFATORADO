# Guia de manutenção do frontend — Cedro IA

## 1. Objetivo da refatoração

O frontend passou a adotar nomes semânticos para componentes e páginas. A intenção é evitar JSX com dezenas de classes utilitárias, facilitar pesquisas no VS Code e impedir que o CSS global volte a crescer sem organização.

## 2. Padrão de busca

### Estrutura global

| Elemento | ID principal | Classe principal | CSS |
|---|---|---|---|
| Aplicação | `cedro-aplicacao` | `.aplicacao` | `estilos/estrutura/aplicacao.css` |
| Sidebar desktop | `cedro-barra-lateral` | `.barra-lateral` | `estilos/estrutura/barra-lateral.css` |
| Barra superior desktop | `cedro-barra-superior` | `.barra-superior` | `estilos/estrutura/barra-superior.css` |
| Cabeçalho/menu mobile | `cedro-menu-mobile` | `.menu-mobile` | `estilos/estrutura/menu-mobile.css` |
| Marca Cedro IA | `data-componente="marca-cedro-ia"` | `.marca-cedro` | `estilos/componentes/marca-cedro-ia.css` |

### Páginas

A aplicação cria automaticamente um ID de página com o padrão `pagina-<rota-interna>` e cada componente possui um identificador interno adicional.

| Página | Identificador interno | Classe raiz de conteúdo | CSS |
|---|---|---|---|
| Dashboard | `dashboard-conteudo` | `.pagina-dashboard` | `estilos/paginas/dashboard.css` |
| Inventário | `inventario-conteudo` | `.pagina-inventario` | `estilos/paginas/inventario.css` |
| Nova solicitação | `nova-solicitacao-conteudo` | `.pagina-nova-solicitacao` | `estilos/paginas/nova-solicitacao.css` |
| Aprovações | `aprovacoes-conteudo` | `.pagina-aprovacoes` | `estilos/paginas/aprovacoes.css` |
| Perfil | `perfil-conteudo` | `.pagina-perfil` | `estilos/paginas/perfil.css` |
| Chat | `chat-conteudo` | `.pagina-chat-conteudo` | `estilos/paginas/chat.css` |
| Administração | `administracao-conteudo` | `.pagina-administracao` | `estilos/paginas/administracao.css` |
| Mapa de IAs | `mapa-ias-conteudo` | `.pagina-mapa-ias` | `estilos/paginas/relatorios.css` |
| Relatório | `relatorio-conteudo` | `.pagina-relatorio` | `estilos/paginas/relatorios.css` |
| Login/cadastro | `pagina-autenticacao` | `.pagina-autenticacao` | `estilos/paginas/autenticacao.css` |
| Redefinir senha | `pagina-redefinir-senha` | `.pagina-autenticacao` | `estilos/paginas/autenticacao.css` |

## 3. Convenção de classes

Usar nomes em português e uma estrutura previsível:

```css
.barra-lateral {}
.barra-lateral__cabecalho {}
.barra-lateral__item {}
.barra-lateral__item--ativo {}
```

- bloco: `barra-lateral`
- elemento: `barra-lateral__item`
- estado/modificador: `barra-lateral__item--ativo`

## 4. Onde colocar CSS novo

```text
frontend/src/estilos/
├── base/
│   ├── variaveis.css
│   ├── globais.css
│   └── responsividade.css
├── estrutura/
│   ├── aplicacao.css
│   ├── barra-lateral.css
│   ├── barra-superior.css
│   └── menu-mobile.css
├── componentes/
│   ├── marca-cedro-ia.css
│   └── notificacoes.css
├── paginas/
│   ├── administracao.css
│   ├── aprovacoes.css
│   ├── autenticacao.css
│   ├── chat.css
│   ├── dashboard.css
│   ├── inventario.css
│   ├── nova-solicitacao.css
│   ├── paginas.css
│   ├── perfil.css
│   └── relatorios.css
└── legado/
    └── estilos-legados.css
```

## 5. CSS legado

`estilos/legado/estilos-legados.css` contém as regras anteriores ainda utilizadas pelas partes do projeto que não foram migradas integralmente.

Regras obrigatórias:

1. não adicionar estilos novos nesse arquivo;
2. quando um componente for mantido, mover suas regras para a pasta correspondente;
3. após confirmar que os seletores antigos não possuem mais uso, removê-los do legado;
4. evitar `!important` em novos estilos, salvo incompatibilidade comprovada com código legado.

## 6. Regra para JSX

Evitar:

```tsx
className="fixed inset-y-0 left-0 z-40 text-white flex flex-col shrink-0 overflow-visible relative select-none"
```

Preferir:

```tsx
className="barra-lateral"
```

Estados podem ser combinados:

```tsx
className={`barra-lateral__item ${ativo ? "barra-lateral__item--ativo" : ""}`}
```

## 7. IDs

IDs são reservados para elementos únicos, navegação, acessibilidade e automação de testes.

Não criar IDs baseados em aparência. Exemplos ruins:

- `caixaVerde`
- `botao2`
- `divPrincipal`

Exemplos corretos:

- `cedro-menu-mobile-abrir`
- `cedro-notificacoes-painel`
- `cedro-barra-lateral-recolher`
- `pagina-autenticacao`

## 8. Regras de segurança da refatoração

A organização visual não deve alterar:

- autenticação;
- Supabase;
- permissões;
- fluxo de aprovação;
- estados React;
- chamadas de API;
- regras de negócio;
- dados dos formulários.

Mudanças de manutenção devem ser pequenas, localizadas e verificadas com `npm run lint`.

## 9. Estado da arquitetura após a varredura de 2026

A interface ativa não depende mais de classes utilitárias de apresentação. O Vite não carrega plugin de utilitários e as dependências foram removidas do manifesto do projeto.

Para qualquer mudança visual nova:

1. localize a classe raiz do componente/página no JSX;
2. abra o CSS de mesma responsabilidade;
3. crie ou ajuste uma classe semântica;
4. use `--estado` para variações de seleção, erro, sucesso, alerta, recolhimento e similares;
5. use `base/variaveis.css` para mudanças de identidade global;
6. use `tema/tema-plataforma.css` para padrões compartilhados de acabamento.

Os nomes fixos das etapas do fluxo não devem voltar a ser inputs editáveis. Somente o responsável de cada etapa pode ser configurado pela interface.
