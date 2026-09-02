# Cedro IA — Ajustes estruturais UX/UI 2026

## Objetivo
Corrigir colisões, overflow horizontal e perda de hierarquia visual identificados após a migração do frontend para CSS semântico sem Tailwind.

## Causa raiz encontrada
A conversão anterior deixou declarações CSS inválidas geradas a partir de utilitários Tailwind. Exemplos encontrados:

- `font-size: #075618;` onde a intenção era `color: #075618;`
- `border-width: #E3E8E1;` onde a intenção era `border-color: #E3E8E1;`
- `font-size: var(--text-muted);` onde a intenção era `color: var(--text-muted);`
- `border-width: var(--border-lab);` onde a intenção era `border-color: var(--border-lab);`
- `rgba(..., NaN)` e `calc(100vw-2rem)` inválidos

Foram corrigidas 450 declarações inválidas/ambíguas na camada de estilos migrada, além dos dois valores `NaN` e do `calc()` inválido.

## Ajustes de layout

### Global
- `box-sizing: border-box` normalizado.
- overflow horizontal global removido.
- `min-width: 0` aplicado nos contêineres estruturais necessários.
- rolagem horizontal preservada somente em tabelas/abas que realmente precisam dela.

### Dashboard
- KPIs mais compactos.
- gráficos com altura reduzida.
- ritmo vertical mais equilibrado.

### Inventário
- cabeçalho ganhou título, subtítulo e descrição.
- ações foram reposicionadas no cabeçalho.
- cards-resumo ficaram mais compactos.
- tabela passou a conter sua própria rolagem quando necessária.

### Nova Solicitação
- stepper lateral suavizado.
- bordas pesadas removidas.
- campos ganharam espaçamento real entre si.
- rodapé de ações ficou mais leve e coerente.

### Aprovações
- correção prioritária do layout fila/detalhes.
- coluna esquerda e painel direito agora usam `minmax(..., 0)` e não esmagam o conteúdo.
- stepper de 5 etapas virou grid responsivo.
- cartões de responsáveis ganharam grid responsivo.
- lista da fila tem rolagem própria.

### Mapa de IAs
- cards usam `auto-fit/minmax` e não deixam metade da tela visualmente quebrada.
- filtros e busca respeitam a largura disponível.

### Setores
- resumo lateral e grade de setores foram reorganizados.
- cards ficaram menores e mais consistentes.

### Administração
- toolbar passou a aceitar quebra de linha sem colisão.
- filtros não pressionam mais a busca para fora do viewport.

### Relatório
- seções principais ficaram mais leves.
- grade das etapas responde a 5/3/1 colunas conforme a largura.
- overflow horizontal eliminado.

### Chat
- coluna de conversas ajustada para 320–360px.
- cards de conversa perderam o efeito de "caixote".
- separadores e estados ativos ficaram mais leves.

### Perfil
- composição abaixo do hero agora usa duas colunas proporcionais.
- títulos internos perderam as caixas/bordas excessivas.
- inputs ganharam espaçamento e largura segura.

## Validações
- `npm run lint`: aprovado (frontend + backend).
- 25 arquivos CSS analisados pelo parser PostCSS sem erro sintático.
- declarações inválidas `font-size: #...` e `border-width: #...`: 0 restantes.
- build Vite não foi concluído no ambiente Linux por ausência do pacote opcional `@rollup/rollup-linux-x64-gnu` no `node_modules` originado de outro ambiente; não é erro do código alterado.
