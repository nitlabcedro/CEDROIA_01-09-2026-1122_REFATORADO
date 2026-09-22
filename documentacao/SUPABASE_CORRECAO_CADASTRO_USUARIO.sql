-- Revisão manual obrigatória antes da aplicação.
-- Esta migration não altera perfis existentes e não concede novas permissões.
-- CREATE OR REPLACE atualiza somente public.handle_new_user().

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_full_name text := nullif(btrim(new.raw_user_meta_data ->> 'full_name'), '');
  v_atribuicoes jsonb := new.raw_user_meta_data -> 'atribuicoes';
  v_setor text := nullif(btrim(new.raw_user_meta_data ->> 'setor'), '');
  v_cargo text := nullif(btrim(new.raw_user_meta_data ->> 'cargo'), '');
  v_setores text[] := '{}';
  v_cargos text[] := '{}';
  v_item jsonb;
  v_setor_item text;
  v_cargo_item text;
begin
  if v_full_name is null then
    raise exception using
      errcode = 'P0001',
      message = 'Nome completo é obrigatório para criar o perfil.';
  end if;

  if v_atribuicoes is not null then
    if jsonb_typeof(v_atribuicoes) <> 'array' then
      raise exception using
        errcode = 'P0001',
        message = 'As atribuições do cadastro devem ser uma lista.';
    end if;

    if jsonb_array_length(v_atribuicoes) < 1 then
      raise exception using
        errcode = 'P0001',
        message = 'Adicione pelo menos uma atribuição de setor e cargo.';
    end if;

    for v_item in
      select elem
      from jsonb_array_elements(v_atribuicoes) with ordinality as t(elem, ord)
      order by t.ord
    loop
      if jsonb_typeof(v_item) <> 'object' then
        raise exception using
          errcode = 'P0001',
          message = 'Cada atribuição do cadastro deve ser um objeto.';
      end if;

      v_setor_item := nullif(btrim(coalesce(v_item ->> 'setor', '')), '');
      v_cargo_item := nullif(btrim(coalesce(v_item ->> 'cargo', '')), '');

      if v_setor_item is null then
        raise exception using
          errcode = 'P0001',
          message = 'Setor é obrigatório para criar o perfil.';
      end if;

      if v_cargo_item is null then
        raise exception using
          errcode = 'P0001',
          message = 'Cargo é obrigatório para criar o perfil.';
      end if;

      if v_setor_item = any (v_setores) then
        raise exception using
          errcode = 'P0001',
          message = 'Não é permitido selecionar o mesmo setor mais de uma vez.';
      end if;

      if not exists (
        select 1
        from public.sectors as setor
        where setor.name = v_setor_item
          and setor.status = 'Ativo'
      ) then
        raise exception using
          errcode = 'P0001',
          message = 'O setor informado não existe ou não está ativo.';
      end if;

      if not exists (
        select 1
        from public.sectors as setor
        where setor.name = v_setor_item
          and setor.status = 'Ativo'
          and jsonb_typeof(setor.cargos) = 'array'
          and setor.cargos ? v_cargo_item
      ) then
        raise exception using
          errcode = 'P0001',
          message = 'O cargo informado não pertence ao setor selecionado.';
      end if;

      v_setores := array_append(v_setores, v_setor_item);
      v_cargos := array_append(v_cargos, v_cargo_item);
    end loop;

    v_setor := array_to_string(v_setores, '; ');
    v_cargo := array_to_string(v_cargos, '; ');
  else
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
