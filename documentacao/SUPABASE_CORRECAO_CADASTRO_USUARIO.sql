-- Revisão manual obrigatória antes da aplicação.
-- Esta migration não altera perfis existentes e não concede novas permissões.

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_full_name text := nullif(btrim(new.raw_user_meta_data ->> 'full_name'), '');
  v_setor text := nullif(btrim(new.raw_user_meta_data ->> 'setor'), '');
  v_cargo text := nullif(btrim(new.raw_user_meta_data ->> 'cargo'), '');
begin
  if v_full_name is null then
    raise exception using
      errcode = 'P0001',
      message = 'Nome completo é obrigatório para criar o perfil.';
  end if;

  if v_setor is null then
    raise exception using
      errcode = 'P0001',
      message = 'Setor é obrigatório para criar o perfil.';
  end if;

  if v_cargo is null then
    raise exception using
      errcode = 'P0001',
      message = 'Cargo é obrigatório para criar o perfil.';
  end if;

  if not exists (
    select 1
    from public.sectors as setor
    where setor.name = v_setor
      and setor.status = 'Ativo'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'O setor informado não existe ou não está ativo.';
  end if;

  if not exists (
    select 1
    from public.sectors as setor
    where setor.name = v_setor
      and setor.status = 'Ativo'
      and jsonb_typeof(setor.cargos) = 'array'
      and setor.cargos ? v_cargo
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'O cargo informado não pertence ao setor selecionado.';
  end if;

  insert into public.perfis (id, full_name, setor, cargo)
  values (new.id, v_full_name, v_setor, v_cargo);

  return new;
end;
$$;

-- Funções de trigger não precisam de execução direta por clientes.
-- Os REVOKEs também removem ACLs públicas eventualmente preservadas pelo
-- CREATE OR REPLACE FUNCTION.
revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;

commit;
