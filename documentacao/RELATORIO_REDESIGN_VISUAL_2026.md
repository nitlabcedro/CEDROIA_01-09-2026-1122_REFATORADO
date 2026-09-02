# Cedro IA — Redesign Visual 2026

## Objetivo

Atualizar a aparência da plataforma sem alterar regras de negócio, integrações, autenticação, permissões, Supabase ou fluxos de aprovação.

## Direção visual

- identidade Cedro mantida em verde institucional e laranja de apoio;
- superfícies menos brancas e mais integradas ao fundo da aplicação;
- cards com bordas suaves, profundidade discreta e raios consistentes;
- barra superior com gradiente horizontal verde;
- abas padronizadas como controles segmentados;
- popups e modais com uma linguagem única;
- tabelas com cabeçalhos suaves e melhor leitura;
- campos e dropdowns com foco padronizado;
- dashboard, inventário, solicitação, aprovações, administração, mapa, relatórios, perfil e chat harmonizados;
- remoção de `backdrop-filter` dos overlays padronizados para reduzir custo de composição.

## Nova camada de estilos

A camada final do tema está em:

`frontend/src/estilos/tema/tema-plataforma.css`

Ela é importada por último em `frontend/src/estilos/index.css`. Dessa forma, o tema visual fica centralizado e não exige alterações no CSS legado para ajustes futuros.

## Classes semânticas adicionadas

### Abas

- `.cedro-abas`
- `.cedro-aba`
- `.cedro-aba--ativa`

Aplicadas inicialmente em Aprovações, Administração e Visualização de Relatório.

### Modais

- `.cedro-modal-overlay`
- `.cedro-modal-painel`
- `.cedro-modal-painel--compacto`
- `.cedro-modal-cabecalho`
- `.cedro-modal-rodape`

Aplicadas nos principais popups de Inventário, Cadastro, Aprovações, Chat, Perfil, Administração, Setores, Mapa e Interações da TI.

### Dropdown

- `.menu-suspenso`
- `.menu-suspenso__rotulo`
- `.menu-suspenso__gatilho`
- `.menu-suspenso__painel`
- `.menu-suspenso__opcao`
- `.menu-suspenso__opcao--ativa`

### Cards

- `.cartao-acao`
- `.cartao-alerta`
- `.cartao-tabela`

### Indicadores

- `.indicador-status`
- `.indicador-risco`

## Logo

A imagem original `LOGOCEDRO.png` foi preservada. Foi criada uma versão otimizada para interface:

`frontend/public/LOGOCEDRO-interface.png`

A versão de interface tem 520 × 173 px e aproximadamente 90 KB, reduzindo o custo da primeira renderização sem aplicar `filter` à imagem.

## Validação

- `npm run lint`: aprovado para frontend e backend.
- CSS novo validado sintaticamente com PostCSS.
- O build Vite não pôde ser concluído no ambiente Linux da análise porque o `node_modules` enviado foi instalado no Windows e não contém o pacote opcional `@rollup/rollup-linux-x64-gnu`.

## Regra de manutenção

A partir desta etapa, mudanças globais de identidade visual devem ser feitas preferencialmente em `tema-plataforma.css` ou nas variáveis de `base/variaveis.css`. Não adicionar novos estilos ao arquivo `legado/estilos-legados.css`.
