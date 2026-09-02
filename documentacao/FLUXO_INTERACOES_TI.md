# Etapa 2 — TI: perguntas ao solicitante

O fluxo oficial continua com cinco etapas:

1. NIT
2. TI
3. Período de Teste
4. Presidência
5. Financeiro

As perguntas ao solicitante são um subfluxo da Etapa 2 e **não criam uma nova etapa**.

## Comportamento

- O responsável da TI pode criar perguntas manuais para a solicitação.
- Enquanto uma rodada estiver `aguardando_resposta`, a IA continua com `current_step = 2`.
- O solicitante recebe uma notificação persistente no canto inferior da aplicação.
- A notificação não possui botão de fechar e só desaparece depois do envio de todas as respostas.
- O modal de resposta pode ser fechado; as respostas são salvas como rascunho e a notificação permanece.
- Depois do envio, a rodada muda para `respondida` e as respostas ficam disponíveis na tela da TI.
- A TI pode criar uma nova rodada, caso precise de novos esclarecimentos.
- Aprovar ou negar a Etapa 2 fica bloqueado enquanto existir uma rodada aguardando resposta.

## Banco de dados

Antes de usar a funcionalidade, execute no SQL Editor do Supabase:

`documentacao/SUPABASE_TI_INTERACOES.sql`

As tabelas criadas são:

- `ti_information_requests`: uma linha por rodada de perguntas.
- `ti_information_questions`: perguntas e respostas da rodada.

As duas tabelas usam RLS e não ficam abertas diretamente ao frontend. A comunicação ocorre pelas rotas autenticadas do backend.
