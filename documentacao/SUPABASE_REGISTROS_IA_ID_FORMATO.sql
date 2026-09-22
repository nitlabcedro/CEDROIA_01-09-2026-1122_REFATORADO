-- Revisão manual obrigatória antes da aplicação.
-- Atualiza somente o formato de IDs novos: IA-NNNNNNNN.
-- Mantém public.registros_ia_id_seq (não reinicia, não preenche lacunas).
-- Não altera IDs já existentes.
-- Não aplica RLS.

begin;

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

revoke all on function public.next_registros_ia_id() from public;
revoke all on function public.next_registros_ia_id() from anon;
revoke all on function public.next_registros_ia_id() from authenticated;

grant execute on function public.next_registros_ia_id() to service_role;

commit;
