# Refatoração semântica do Chat

- Classes renomeadas: 216
- Escopo: Chat.tsx + estilos que referenciam as classes do Chat.
- Lógica de mensagens, Supabase, realtime, anexos e notificações: não alterada.
- IDs estáveis adicionados: `chat-conteudo`, `chat-conversas`, `chat-lista-conversas`, `chat-conversa`, `chat-area-mensagens`, `chat-composer`.

## Padrões principais

- `chat__contato*`: lista de conversas.
- `chat__mensagem*`: mensagens e balões.
- `chat__composer*`: campo de envio.
- `chat__conversa*`: cabeçalho e ações da conversa ativa.
- `chat-perfil-modal__*`: modal de perfil.
- `chat-nova-conversa__*`: modal de nova conversa.

Não há mais classes numéricas como `chat__grupo-54`, `chat__texto-29` ou `chat__elemento-4` no componente.
