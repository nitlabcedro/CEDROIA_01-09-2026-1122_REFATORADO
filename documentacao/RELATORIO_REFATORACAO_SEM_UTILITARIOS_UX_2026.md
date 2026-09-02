# Cedro IA — Refatoração integral de estilos e redesign UX/UI 2026

## Escopo executado

Foi realizada uma varredura do frontend ativo do Cedro IA para separar apresentação de JSX, retirar a dependência da camada de utilitários visuais, consolidar CSS por responsabilidade e elevar a identidade do produto para uma linguagem institucional de tecnologia em saúde.

### Arquitetura

- removido o plugin de utilitários do Vite;
- removidas as dependências correspondentes de `package.json` e `package-lock.json`;
- removidas diretivas de utilitários do CSS;
- estilos do JSX migrados para arquivos em `frontend/src/estilos`;
- componentes compartilhados reescritos com classes semânticas;
- `index.css` permanece como ponto único de entrada, com ordem explícita de camadas;
- seletores repetidos da migração foram consolidados, reduzindo aproximadamente pela metade o volume de CSS gerado sem mudar o comportamento.

### Sistema visual

- sidebar e navbar redesenhadas em verde Cedro profundo, com gradiente institucional escuro;
- laranja mantido como acento de marca, não como cor dominante;
- páginas deixam de parecer grandes caixas brancas isoladas e passam a usar fundo neutro esverdeado com hierarquia de superfícies;
- cabeçalhos de páginas receberam assinatura visual própria;
- cards, KPIs, filtros, tabelas e listas ganharam bordas, raios, sombras e estados consistentes;
- abas foram unificadas como controles segmentados;
- inputs, selects e textareas receberam estados de hover/foco consistentes;
- botões primários, secundários, destrutivos e de ação foram padronizados;
- modais e popups receberam overlay sólido, cabeçalho, rodapé e profundidade próprios;
- status e riscos passaram a usar variantes semânticas;
- chat, perfil, inventário, mapa, relatórios, administração, aprovações e nova solicitação receberam acabamento específico;
- filtros de imagem e desfoques de fundo foram retirados das áreas persistentes para reduzir custo de composição.

## Correção funcional associada

Na configuração do fluxo de aprovação, os nomes das cinco etapas foram protegidos e não são mais campos editáveis:

1. NIT
2. TI
3. PERÍODO DE TESTE
4. PRESIDÊNCIA
5. FINANCEIRO

O administrador continua podendo selecionar o usuário responsável por cada etapa. Antes de salvar, o código reaplica os nomes fixos para impedir alteração acidental por outro trecho da interface.

## Padrão de manutenção

A busca deve partir da classe raiz da página/componente e do respectivo arquivo CSS. Exemplos:

- `.barra-lateral` → `estilos/estrutura/barra-lateral.css`;
- `.barra-superior` → `estilos/estrutura/barra-superior.css`;
- `.pagina-inventario` → `estilos/paginas/inventario.css`;
- `.pagina-aprovacoes` → `estilos/paginas/aprovacoes.css`;
- `.pagina-administracao` → `estilos/paginas/administracao.css`;
- `.cedro-modal-*`, `.cedro-abas`, padrões comuns → `estilos/tema/tema-plataforma.css` e `estilos/componentes/componentes-comuns.css`.

## Exceção intencional

O código de exportação/impressão do relatório mantém estilos inline próprios para gerar o documento final. Esses estilos pertencem ao artefato exportado e não à interface web.

## Validação

- TypeScript frontend: validado com `tsc --noEmit`;
- TypeScript backend: validado com `tsc --noEmit`;
- CSS: todos os arquivos de estilo ativos analisados sintaticamente;
- varredura de JSX: nenhuma sequência visual de utilitários permanece em `className` ativo;
- build Vite no ambiente de validação Linux: bloqueado apenas porque o `node_modules` fornecido foi instalado no Windows e não contém o binário opcional Linux do Rollup. No Windows, executar `npm.cmd install` antes do build/dev recompõe as dependências para o sistema local.
