# Relatório da refatoração de estilos e seletores

## Escopo executado

A refatoração foi iniciada pela camada estrutural do frontend, preservando regras de negócio e integrações.

### Componentes estruturais migrados

- `Aplicacao.tsx`
- `BarraLateral.tsx`
- `BarraSuperior.tsx`
- `MenuMobile.tsx`
- `MarcaCedroIA.tsx`

Esses componentes deixaram de depender de grandes sequências de utilitários Tailwind nos elementos estruturais e passaram a utilizar classes semânticas em português.

### Páginas com raiz padronizada

- Dashboard
- Inventário
- Nova Solicitação
- Aprovações
- Perfil
- Chat
- Administração
- Mapa de IAs
- Relatório
- Autenticação
- Redefinição de senha

### Blocos adicionais migrados

- campos principais de autenticação;
- botão principal de autenticação;
- campo de parecer da aprovação;
- rodapé e botões de decisão da aprovação.

## Nova estrutura CSS

O antigo `index.css` foi transformado em um ponto de entrada pequeno. As novas regras estão distribuídas entre:

- `estilos/base`
- `estilos/estrutura`
- `estilos/componentes`
- `estilos/paginas`
- `estilos/legado`

O CSS anterior foi preservado em `estilos/legado/estilos-legados.css` para evitar regressões durante a migração gradual.

## Logo

A logo PNG original possui aproximadamente 7730 x 7666 px e era usada em aproximadamente 32 x 32 px na interface.

Foi criada `frontend/public/novalogo-interface.png`, limitada a 256 px e otimizada para UI. A logo original foi preservada.

O HTML também passou a fazer preload da versão otimizada e a usar o arquivo local como favicon.

## Convenções adotadas

Exemplo de componente:

```text
.barra-lateral
.barra-lateral__cabecalho
.barra-lateral__item
.barra-lateral__item--ativo
```

Exemplo de IDs:

```text
cedro-barra-lateral
cedro-barra-superior
cedro-menu-mobile
cedro-conteudo-principal-desktop
pagina-dashboard
```

## Validação

Executado com sucesso:

```text
npm run lint
```

Isso valida TypeScript do frontend e backend.

Os arquivos CSS também foram analisados sintaticamente com PostCSS sem erros.

O build Vite não pôde ser concluído no ambiente de validação porque o `node_modules` incluído no projeto foi instalado para Windows e não possui o pacote nativo Linux opcional do Rollup. Isso é uma limitação do ambiente de validação, não um erro TypeScript detectado na refatoração.

## Próxima fase recomendada

Migrar gradualmente os blocos internos das páginas mais extensas, principalmente:

1. `PaginaAprovacao.tsx`
2. `PainelAdministrativo.tsx`
3. `Chat.tsx`
4. `VisualizacaoRelatorio.tsx`
5. `FormularioCadastro.tsx`

Cada migração deve remover os utilitários antigos somente depois que o seletor semântico correspondente estiver funcionando.
