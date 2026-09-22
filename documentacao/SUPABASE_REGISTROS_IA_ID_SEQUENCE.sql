-- Revisão manual obrigatória antes da aplicação.
-- Etapa 3A: sequence atômica para IDs IA-NNNNNNNN.
-- Não aplica RLS em public.registros_ia.
-- Não altera public.sectors, public.perfis, mensagens nem workflow.
-- Não apaga a linha METADATA-SECTORS.
--
-- A função só deve ser executada pelo backend (service_role).
-- anon e authenticated não recebem EXECUTE.

begin;

create sequence if not exists public.registros_ia_id_seq
  as bigint
  start with 1
  increment by 1
  minvalue 1
  no cycle;

create or replace function public.next_registros_ia_id()
returns text
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  n bigint;
begin
  n := nextval('public.registros_ia_id_seq'::regclass);
  return 'IA-' || lpad(n::text, 8, '0');
end;
$$;

revoke all on sequence public.registros_ia_id_seq from public;
revoke all on sequence public.registros_ia_id_seq from anon;
revoke all on sequence public.registros_ia_id_seq from authenticated;

revoke all on function public.next_registros_ia_id() from public;
revoke all on function public.next_registros_ia_id() from anon;
revoke all on function public.next_registros_ia_id() from authenticated;

grant usage, select on sequence public.registros_ia_id_seq to service_role;
grant execute on function public.next_registros_ia_id() to service_role;

commit;
