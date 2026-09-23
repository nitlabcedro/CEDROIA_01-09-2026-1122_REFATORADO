-- ETAPA 5B — fecha o acesso PostgREST direto às tabelas do workflow.
-- O backend usa service_role e não é alterado por esta migration.
-- NÃO executar sem revisão e aprovação operacional.

begin;

alter table public.configuracao_aprovacao enable row level security;
alter table public.fluxos_aprovacao enable row level security;
alter table public.etapas_aprovacao enable row level security;

-- Remove todas as policies antigas, inclusive policies permissivas com nomes
-- desconhecidos. Sem policies, RLS nega o acesso dos papéis de cliente.
do $$
declare
  alvo text;
  politica record;
begin
  foreach alvo in array array[
    'configuracao_aprovacao',
    'fluxos_aprovacao',
    'etapas_aprovacao'
  ]
  loop
    for politica in
      select policyname
      from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename = alvo
    loop
      execute format(
        'drop policy if exists %I on public.%I',
        politica.policyname,
        alvo
      );
    end loop;
  end loop;
end
$$;

revoke all on table public.configuracao_aprovacao from public;
revoke all on table public.configuracao_aprovacao from anon;
revoke all on table public.configuracao_aprovacao from authenticated;

revoke all on table public.fluxos_aprovacao from public;
revoke all on table public.fluxos_aprovacao from anon;
revoke all on table public.fluxos_aprovacao from authenticated;

revoke all on table public.etapas_aprovacao from public;
revoke all on table public.etapas_aprovacao from anon;
revoke all on table public.etapas_aprovacao from authenticated;

commit;
