# Refatoração estrutural completa - 01/09/2026

## Versão

`CEDROIA_01-09-2026-1122_REFATORADO`

Base utilizada: ZIP `CEDROIA_V3_MODAL_APROVACAO_MOBILE(1).zip` enviado em 01/09/2026.

## Objetivo

Reduzir duplicação, concentrar regras e identificadores sensíveis em pontos únicos e melhorar a manutenção do Cedro IA sem redesenhar páginas, alterar o fluxo operacional ou executar migrações destrutivas no Supabase.

## Alterações realizadas

### 1. Supabase centralizado

Foram criados arquivos de schema lógico para impedir nomes de tabelas e buckets espalhados pelo código:

- `frontend/src/constantes/supabase.ts`
- `backend/src/configuracoes/schema-supabase.ts`

Também foram centralizadas relações usadas em selects PostgREST.

O código continua utilizando os nomes físicos atuais do banco para não exigir uma migração simultânea. A tabela de setores foi alinhada ao nome físico já existente no projeto Supabase: `setores`.

### 2. Fluxo de aprovação centralizado

O fluxo oficial permanece com cinco etapas:

1. Coordenador NIT
2. Gerente TI
3. Período de Teste
4. Presidência
5. Direção Financeira

Definições centralizadas em:

- `frontend/src/constantes/fluxo-aprovacao.ts`
- `backend/src/configuracoes/fluxo-aprovacao.ts`

Fallbacks do relatório passaram a derivar dessas definições em vez de duplicar os nomes das etapas.

### 3. Navegação tipada

Foi criada uma fonte única para abas e títulos:

- `frontend/src/constantes/navegacao.ts`

Isso reduz strings soltas e casts de navegação em `Aplicacao.tsx`, sidebar, navbar e menu mobile.

### 4. Rotas da API centralizadas

Endpoints e builders dinâmicos foram reunidos em:

- `frontend/src/constantes/api.ts`

As páginas e serviços deixam de depender de URLs de API repetidas.

### 5. Permissões centralizadas

Frontend:

- `frontend/src/utilitarios/permissoes.ts`

Backend:

- `backend/src/utilitarios/permissoes.ts`

A normalização de `admin`, `moderator` e papéis usados pelo fluxo deixa de ser repetida em vários pontos.

### 6. Persistência local centralizada

Chaves de `localStorage` e eventos internos foram reunidos em:

- `frontend/src/constantes/armazenamento-local.ts`

Inclui navegação, registro selecionado, leitura do Chat, e-mail lembrado, detalhes de setores, controles locais e rascunho de Nova Solicitação.

### 7. Setores e cargos

Fallbacks de cargos foram centralizados em:

- `frontend/src/constantes/setores.ts`

A estratégia de carregamento de cargos (Supabase -> cache local -> fallback institucional) foi extraída para:

- `frontend/src/servicos/setores.ts`

Isso remove a mesma lógica duplicada de Cadastro, Perfil e Nova Solicitação.

### 8. Chat modularizado

Foram extraídos do arquivo principal:

- `frontend/src/paginas/chat/ChatAvatar.tsx`
- `frontend/src/paginas/chat/PerfilChatModal.tsx`
- `frontend/src/paginas/chat/chat.utilitarios.ts`

Os utilitários agora concentram:

- ordenação de mensagens;
- reconciliação de mensagem otimista com Realtime;
- remoção de duplicidades;
- iniciais;
- presença online;
- contato exibido;
- datas e horários amigáveis.

O fallback que inventava um endereço de e-mail foi removido. Quando não há um e-mail conhecido, a interface informa `E-mail não informado`.

Também foi incorporada a correção de navegação das notificações do Chat: o botão `Ver Mensagem` agora transporta o identificador do remetente, abre a conversa correta e devolve o foco ao campo de composição.

### 9. Aprovações modularizadas

Foram criados:

- `frontend/src/paginas/aprovacoes/aprovacoes.tipos.ts`
- `frontend/src/paginas/aprovacoes/aprovacoes.utilitarios.ts`

Tipos da página e interpretação de pareceres/observações foram retirados do componente principal.

### 10. Administração modularizada

O menu contextual dos registros foi extraído para:

- `frontend/src/paginas/administracao/AdminDropdownPortal.tsx`

O componente de Administração mantém a mesma lógica funcional, mas deixa de concentrar esse bloco de portal e posicionamento.

### 11. Identificação de marcas de IA

A identificação de ChatGPT, Gemini, Copilot, Claude, Grok e Outro foi centralizada em:

- `frontend/src/utilitarios/inteligencia-artificial.ts`

### 12. Configuração institucional

O domínio institucional foi centralizado em:

- `frontend/src/constantes/institucional.ts`

Cadastro continua aceitando somente `@labcedro.com.br` conforme regra existente.

### 13. Limpeza de arquivos legados sem consumidores internos

Após análise do grafo de imports, foram removidos da versão refatorada:

- `frontend/src/componentes/comuns/ConteinerNotificacoes.tsx`
- `frontend/src/componentes/fundo/AnimacaoLiquidaLaboratorio.tsx`
- `frontend/src/constantes/comuns/MenuSuspenso.tsx`
- `frontend/src/constantes/status.ts`
- `frontend/src/dados/status.ts`
- `frontend/src/servicos/armazenamento.compatibilidade.ts`
- `frontend/src/servicos/supabase.compatibilidade.ts`
- `frontend/src/utilitarios/alertas.compatibilidade.ts`

Nenhum import interno ativo apontava para esses arquivos.

### 14. Scripts e metadados

- pacote renomeado para `cedro-ia`;
- versão de pacote atualizada para `2026.9.1`;
- `npm run clean` passou a usar Node e funciona tanto no Windows quanto em ambientes Unix;
- `package-lock.json` foi mantido consistente com `package.json`.

## O que NÃO foi alterado

Para evitar regressões, esta refatoração não modifica intencionalmente:

- conteúdo e layout visual das páginas;
- CSS aprovado das telas;
- estrutura dos dados de negócio;
- dados existentes no Supabase;
- ordem das cinco etapas;
- perguntas da TI;
- decisões e pareceres já gravados;
- regra especial da Direção Financeira;
- geração visual atual do PDF;
- RLS/policies do banco;
- formato dos registros existentes.

## Riscos preservados para uma etapa posterior

Algumas mudanças seriam arquiteturalmente desejáveis, porém misturá-las nesta refatoração aumentaria muito o risco funcional:

1. `GET /api/workflow/config` ainda possui comportamento de compatibilidade capaz de ajustar configuração legada.
2. Existem fallbacks do frontend que operam diretamente no Supabase quando a API de workflow fica indisponível.
3. O Chat ainda usa URL pública para anexos; uma futura etapa pode migrar para bucket privado + signed URLs.
4. `PaginaAprovacao.tsx`, `PainelAdministrativo.tsx` e parte do CSS ainda são grandes; a decomposição visual deve ser feita página a página com teste de regressão visual.
5. Renomear todas as tabelas/colunas do banco para português exige migração coordenada de banco + código e não foi executado nesta versão.

## Validação executada neste ambiente

- 79 arquivos TypeScript/TSX analisados pelo parser TypeScript: **sem erro sintático**.
- 35 arquivos CSS analisados pelo parser PostCSS: **sem erro sintático**.
- 308 imports/exports internos verificados quanto à resolução de arquivo: **sem caminho quebrado**.
- busca por referências diretas de tabelas Supabase: chamadas `.from(...)` foram centralizadas nos identificadores de schema.
- `.env` não foi incluído na versão de entrega.

### Limitação da validação

A instalação limpa de dependências (`npm ci`) não pôde ser concluída no ambiente de geração por indisponibilidade temporária de acesso ao registro npm (`EAI_AGAIN`). Por isso o build real com Vite/TypeScript deve ser confirmado no computador de desenvolvimento após `npm install`.

Comandos recomendados após extrair:

```powershell
npm install
npm.cmd run lint
npm.cmd run build
npm.cmd run dev
```

## Estratégia de versionamento

A `main` deve permanecer como versão estável. Novas alterações devem usar branches no padrão definido para o Cedro IA:

`cedroia-DD-MM-YYYY-HHmm`

Exemplo:

`cedroia-01-09-2026-1122`
