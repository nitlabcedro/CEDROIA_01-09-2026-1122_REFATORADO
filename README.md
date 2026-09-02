# Cedro IA

Plataforma de governança, inventário, avaliação e acompanhamento institucional de Inteligência Artificial do Laboratório Cedro.

## Versão refatorada

**Versão:** `CEDROIA_01-09-2026-1122_REFATORADO`  
**Base:** `CEDROIA_V3_MODAL_APROVACAO_MOBILE(1).zip`  
**Data:** 01/09/2026

Esta versão realiza uma refatoração estrutural conservadora: reduz duplicação e centraliza regras/identificadores sem redesenhar telas ou executar uma migração destrutiva no Supabase.

O relatório técnico completo está em:

`documentacao/REFATORACAO_COMPLETA_01-09-2026.md`

## Estrutura

- `frontend/`: React + TypeScript + Vite.
- `backend/`: Express + TypeScript e regras server-side.
- `netlify/functions/`: adaptador serverless da mesma aplicação Express.
- `documentacao/`: arquitetura, segurança, Supabase, fluxos e histórico técnico.

### Pontos centrais após a refatoração

- `frontend/src/constantes/`: rotas, navegação, Supabase, armazenamento local, setores, identidade institucional e fluxo de aprovação.
- `frontend/src/servicos/`: acesso a API, Supabase, persistência e serviços de domínio do frontend.
- `frontend/src/utilitarios/`: permissões, pareceres e identificação de IA.
- `backend/src/configuracoes/`: ambiente, Supabase, schema físico e fluxo oficial.
- `backend/src/utilitarios/`: regras auxiliares sem dependência HTTP.

## Fluxo oficial de aprovação

1. Coordenador NIT
2. Gerente TI
3. Período de Teste
4. Presidência
5. Direção Financeira

## Histórico técnico

### 01/09/2026 — Otimização de requisições e sincronização

- Redução e controle do polling de pendências e interações da TI, com pausa quando a aba está em segundo plano.
- Prevenção de cargas HTTP concorrentes e de subscriptions duplicadas durante o ciclo do React StrictMode.
- Reaproveitamento do estado e do cache de perfis, registros e mensagens sempre que seguro.
- Preservação integral do Chat, das notificações, da abertura direta por “Ver Mensagem” e das cinco etapas do fluxo de aprovação.


## Desenvolvimento local

Na raiz do projeto:

```powershell
Copy-Item .env.example .env
npm install
npm.cmd run dev
```

O arquivo `.env` deve possuir as variáveis reais do ambiente e **não deve ser enviado ao GitHub**.

## Validação antes de commit/deploy

```powershell
npm.cmd run lint
npm.cmd run build
```

Depois, para desenvolvimento:

```powershell
npm.cmd run dev
```

## Versionamento

A branch `main` deve representar a versão estável/produção.

Novas versões devem usar:

`cedroia-DD-MM-YYYY-HHmm`

Exemplo:

`cedroia-01-09-2026-1122`

Somente depois da homologação a versão deve ser integrada à `main`.

## Supabase

Os identificadores físicos das tabelas foram centralizados para facilitar manutenção e uma futura tradução dos nomes do banco sem procurar strings em dezenas de arquivos.

Nesta versão, nenhuma migração em massa de tabela/coluna foi executada. A tabela de setores usa o nome físico existente `setores`.

## Etapa 2 - TI

A Etapa 2 permite perguntas manuais ao solicitante sem criar uma etapa adicional no fluxo.

Arquivo de preparação do banco:

`documentacao/SUPABASE_TI_INTERACOES.sql`

Documentação:

`documentacao/FLUXO_INTERACOES_TI.md`

## Cuidados antes de remover compatibilidades

Leia:

`documentacao/LEGADO_E_RISCOS.md`

Os fallbacks remanescentes foram preservados porque removê-los sem teste de integração pode alterar o comportamento do workflow ou de registros legados.
