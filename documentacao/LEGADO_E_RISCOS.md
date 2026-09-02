# Compatibilidade legada e riscos preservados

Este documento registra comportamentos mantidos propositalmente na versão refatorada. Eles não devem ser removidos sem teste funcional e validação de dados.

## Automigração no GET de configuração

- Local: `backend/src/servicos/aprovacao.servico.ts`
- Operação: `obterConfiguracaoWorkflow`
- Comportamento: detecta configurações legadas divergentes do fluxo oficial de cinco etapas e pode executar ajustes de configuração.
- Risco: uma leitura de configuração pode gerar escrita usando o cliente administrativo.
- Recomendação: mover essa compatibilidade para uma migração administrativa explícita após validar os bancos existentes.

## Fallbacks críticos no frontend

- Local principal: `frontend/src/hooks/useAplicacao.ts`
- Comportamento: em indisponibilidade de determinados endpoints do workflow, existem caminhos de compatibilidade que consultam ou atualizam o Supabase diretamente.
- Risco: regras equivalentes existem em mais de uma camada e podem divergir ao longo do tempo.
- Recomendação: remover somente depois de estabilizar a API como fonte única de regra de negócio.

## Modelo oficial de cinco etapas

O fluxo operacional consolidado é:

1. Coordenador NIT
2. Gerente TI
3. Período de Teste
4. Presidência
5. Direção Financeira

As definições foram centralizadas no frontend e backend. Registros históricos devem ser tratados sem reintroduzir etapas retiradas do fluxo operacional.

## Permissões

Existem regras históricas específicas no workflow, inclusive possibilidade de decisão administrativa e atribuição automática em cenários de configuração incompleta. Essas regras foram preservadas nesta refatoração.

Antes de endurecer permissões, confirmar a matriz oficial de autorização do processo.

## Chat e anexos

O Chat mantém a arquitetura atual de Supabase Realtime e o comportamento de anexos existente. O bucket de anexos ainda pressupõe URL pública.

Recomendação futura: bucket privado com URLs assinadas e política explícita de retenção.

## Schema e compatibilidade local

Permanecem fallbacks para colunas ausentes, registros locais, setores locais e limpeza de sessões inválidas. Eles estão concentrados principalmente em:

- `frontend/src/servicos/armazenamento.ts`
- `frontend/src/servicos/setores.ts`
- `frontend/src/contextos/ContextoAutenticacao.tsx`
- `frontend/src/paginas/chat/Chat.tsx`
- `backend/src/servicos/aprovacao.servico.ts`

Os nomes físicos das tabelas foram centralizados, mas não foram renomeados em massa nesta versão.

## Arquivos legados removidos nesta versão

Arquivos sem consumidores internos, confirmados pela análise do grafo de imports, foram removidos da entrega refatorada. A relação completa está em `REFATORACAO_COMPLETA_01-09-2026.md`.
