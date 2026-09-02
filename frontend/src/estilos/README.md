# Arquitetura de estilos — Cedro IA

## Objetivo

O frontend usa CSS próprio, separado do JSX, com nomes pesquisáveis por componente e página. A camada de utilitários visuais foi removida da aplicação: o JSX descreve estrutura, estado e comportamento; a apresentação fica em `frontend/src/estilos`.

## Convenção de nomes

Usar português e o padrão `bloco__elemento--estado`:

```css
.barra-lateral {}
.barra-lateral__item {}
.barra-lateral__item--ativo {}
```

Estados podem ser compostos no JSX, mas não devem carregar propriedades visuais em sequências de classes:

```tsx
className={`barra-lateral__item ${ativo ? "barra-lateral__item--ativo" : ""}`}
```

## Organização

- `base/`: tokens de cor, tipografia, reset e responsividade global;
- `estrutura/`: aplicação, sidebar, navbar e menu mobile;
- `componentes/`: componentes compartilhados e padrões reutilizáveis;
- `paginas/`: regras específicas das telas;
- `tema/`: acabamento visual transversal do produto;
- `legado/`: somente compatibilidade de regras antigas ainda necessárias. Não adicionar código novo aqui.

## Identidade visual

Os tokens institucionais ficam em `base/variaveis.css`. Sidebar e navbar usam verdes profundos próprios (`--cedro-sidebar-*` e `--cedro-navbar-*`). O laranja Cedro é acento e deve ser usado com parcimônia em indicadores, linhas de ênfase e alertas.

A camada de acabamento geral está em `tema/tema-plataforma.css` e é importada por último em `index.css`. Ela padroniza superfícies, cabeçalhos, abas, tabelas, formulários, modais, estados e botões sem misturar estilos no JSX.

## Regras obrigatórias

1. Não inserir propriedades de aparência em `className`.
2. Não criar nomes de classe baseados em cor ou posição, como `.verde`, `.caixa2` ou `.texto-grande`.
3. Colocar estilos de um componente no arquivo correspondente.
4. Usar IDs apenas para estruturas únicas, acessibilidade, navegação e testes.
5. Não adicionar novos estilos em `legado/estilos-legados.css`.
6. Evitar `filter` e `backdrop-filter` em elementos persistentes de navegação ou sobre a logo.
7. Antes de alterar regra de negócio, separar a mudança visual da mudança funcional.
