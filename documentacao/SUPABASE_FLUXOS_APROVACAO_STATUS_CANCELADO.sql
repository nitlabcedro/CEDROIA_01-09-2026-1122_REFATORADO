-- Amplia approval_workflows_final_status_check para aceitar 'cancelado'.
-- Idempotente. Não migra registros. Não altera outras tabelas.
-- NÃO APLICAR automaticamente.

begin;

alter table public.fluxos_aprovacao
drop constraint if exists approval_workflows_final_status_check;

alter table public.fluxos_aprovacao
add constraint approval_workflows_final_status_check
check (
  final_status in (
    'pendente',
    'aprovado',
    'negado',
    'cancelado'
  )
);

commit;
