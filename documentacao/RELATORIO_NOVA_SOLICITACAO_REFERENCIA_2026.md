# Cedro IA — Nova Solicitação alinhada à referência visual

## Escopo

A página **Nova Solicitação** foi redesenhada sem alterar sidebar, navbar, Supabase ou o fluxo funcional principal.

## Fluxo preservado

A solicitação continua com exatamente três fases:

1. Solicitante
2. Solução
3. Objetivo

Não foram adicionadas fases 4 ou 5.

## Ajustes visuais

- cabeçalho editorial com Governança de IA, título, status e protocolo;
- stepper horizontal de três etapas;
- formulário em card branco com bordas e sombras discretas;
- resumo lateral na fase Solicitante;
- seleção de soluções em cards na fase Solução;
- campos de objetivo e benefícios com contadores;
- chips de objetivos mais leves e legíveis;
- rodapé com hierarquia clara de ações;
- responsividade para desktop, tablet e mobile.

## Rascunho

O botão **Salvar rascunho** salva localmente no navegador e o formulário restaura o rascunho ao retornar à Nova Solicitação com a mesma conta. O rascunho é removido ao salvar definitivamente ou cancelar o registro.

## Arquivos alterados

- `frontend/src/paginas/inventario/FormularioCadastro.tsx`
- `frontend/src/estilos/paginas/nova-solicitacao.css`
- `frontend/src/estilos/index.css`
