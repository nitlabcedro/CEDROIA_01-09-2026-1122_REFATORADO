# Cedro IA — Refino profissional compacto 2026

## Objetivo
Corrigir a percepção de interface pesada da v5 sem alterar regras de negócio, Supabase, permissões ou fluxo de aprovação.

## Alterações principais
- redução de altura de campos, cards, KPIs e cabeçalhos;
- remoção de gradientes em superfícies de conteúdo, mantendo navegação institucional profunda;
- novo padrão compacto de botões primários, secundários e destrutivos;
- redução de sombras e raios para uma aparência corporativa mais limpa;
- ajustes de densidade em Dashboard, Inventário, Nova Solicitação, Aprovações, Mapa, Setores, Administração, Chat, Perfil e Relatório;
- revisão de grids para evitar desalinhamentos;
- dropdown `CustomDropdown` passou a renderizar o painel em portal no `document.body`, evitando clipping por `overflow` e problemas de z-index;
- painel do dropdown reposiciona em scroll/resize e abre acima quando não há espaço abaixo.

## Arquivos alterados
- `frontend/src/componentes/comuns/MenuSuspenso.tsx`
- `frontend/src/estilos/index.css`
- `frontend/src/estilos/tema/refino-profissional-compacto.css`

## Validação
- 26 arquivos CSS analisados sintaticamente com PostCSS;
- 46 arquivos TS/TSX analisados sintaticamente pelo compilador TypeScript;
- nenhum erro sintático encontrado.

## Direção visual
- superfícies internas majoritariamente sólidas e brancas;
- verde profundo reservado para navegação e ações primárias;
- laranja usado apenas como acento/estado;
- campos padrão de aproximadamente 38 px;
- botões principais de aproximadamente 36 px;
- cards com borda leve e sombra curta;
- menor volume de containers decorativos.
