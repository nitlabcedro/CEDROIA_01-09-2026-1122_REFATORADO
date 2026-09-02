# Arquitetura do Cedro IA

## Visão geral

```text
Frontend React/Vite
  -> páginas e componentes
  -> hooks e serviços de domínio
  -> cliente HTTP / cliente Supabase anônimo
  -> API Express
  -> controladores
  -> serviços de negócio
  -> cliente Supabase administrativo
```

A aplicação mantém frontend e backend no mesmo repositório, com a API Express reutilizada localmente e no adaptador serverless do Netlify.

## Frontend

### Composição

- `Aplicacao.tsx`: composição visual e escolha da página ativa.
- `hooks/useAplicacao.ts`: estado global da aplicação, sincronização, notificações e handlers de alto nível.
- `componentes/`: elementos reutilizáveis de layout e domínio.
- `paginas/`: telas agrupadas por domínio funcional.

### Constantes centralizadas

- `constantes/api.ts`: endpoints da API.
- `constantes/armazenamento-local.ts`: chaves de `localStorage` e eventos internos.
- `constantes/fluxo-aprovacao.ts`: cinco etapas oficiais.
- `constantes/institucional.ts`: valores institucionais reutilizados.
- `constantes/navegacao.ts`: abas e títulos.
- `constantes/setores.ts`: fallback de cargos por setor.
- `constantes/supabase.ts`: tabelas, buckets e relações PostgREST.

### Serviços

- `servicos/api.ts`: cliente HTTP autenticado.
- `servicos/supabase.ts`: cliente Supabase anônimo do navegador.
- `servicos/armazenamento.ts`: persistência e compatibilidade de registros/perfis/setores.
- `servicos/setores.ts`: resolução de cargos por setor.
- `servicos/interacoes-ti.ts`: comunicação do subfluxo de perguntas da TI.

### Utilitários

- `utilitarios/permissoes.ts`: normalização de papéis.
- `utilitarios/inteligencia-artificial.ts`: identificação de marcas de IA.
- `utilitarios/pareceres.ts`: tratamento de pareceres.

### Chat

O Chat continua usando Supabase Realtime, mas foi separado em responsabilidades menores:

- `paginas/chat/Chat.tsx`: orquestração da tela e conversa.
- `paginas/chat/ChatAvatar.tsx`: avatar e presença visual.
- `paginas/chat/PerfilChatModal.tsx`: perfil detalhado do contato.
- `paginas/chat/chat.utilitarios.ts`: funções puras de mensagens, datas e presença.

## Backend

- `aplicacao.ts`: composição Express e montagem das rotas.
- `servidor.ts`: servidor local/produção.
- `rotas/`: endpoints.
- `controladores/`: adaptação HTTP.
- `servicos/`: regras e persistência do workflow/integrações TI.
- `middlewares/`: autenticação, autorização e tratamento de erros.
- `configuracoes/ambiente.ts`: variáveis obrigatórias.
- `configuracoes/supabase.ts`: cliente administrativo.
- `configuracoes/schema-supabase.ts`: nomes físicos do banco.
- `configuracoes/fluxo-aprovacao.ts`: fluxo oficial do backend.
- `utilitarios/permissoes.ts`: normalização de papéis.

## Supabase e segurança de chaves

O frontend usa somente:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

A chave administrativa é exclusiva do backend:

- `SUPABASE_SERVICE_ROLE_KEY`

Ela é carregada por `backend/src/configuracoes/ambiente.ts` e nunca deve ser exposta no bundle do frontend.

## Fluxo de aprovação

O fluxo oficial contém cinco etapas:

1. Coordenador NIT
2. Gerente TI
3. Período de Teste
4. Presidência
5. Direção Financeira

O frontend e backend possuem suas representações centralizadas para evitar listas contraditórias espalhadas pela aplicação.

## Netlify

`netlify/functions/api.ts` adapta a mesma aplicação Express. Os redirects de `netlify.toml` preservam `/api/*` e o fallback SPA.

## Compatibilidade

Alguns fallbacks continuam ativos para suportar registros e ambientes legados. Consulte `LEGADO_E_RISCOS.md` antes de removê-los.
