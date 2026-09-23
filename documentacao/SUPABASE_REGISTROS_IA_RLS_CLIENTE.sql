-- Revisão manual obrigatória antes da aplicação.
-- Etapa 3B.2: RLS final de cliente em public.registros_ia.
-- Não altera colunas, registros, sequence de IDs, public.perfis, sectors,
-- mensagens nem workflow.
-- Não reduz privilégios de service_role.
--
-- Matriz:
-- SELECT  anon negar | user dono ou mesmo setor | moderator/admin todos
-- INSERT  autenticado somente owner_id = auth.uid() e setor do próprio perfil
-- UPDATE  somente admin | owner_id imutável via GRANT por coluna
-- DELETE  authenticated negar | exclusão permanece no backend (service_role)

begin;

alter table public.registros_ia enable row level security;

-- Policies atuais conhecidas (permissivas / públicas / duplicadas).
drop policy if exists "Acesso público escrita" on public.registros_ia;
drop policy if exists "Acesso público leitura" on public.registros_ia;
drop policy if exists "Acesso total registros" on public.registros_ia;
drop policy if exists "Allow All Access" on public.registros_ia;
drop policy if exists "Delete apenas admin" on public.registros_ia;
drop policy if exists "Insert para autenticados" on public.registros_ia;
drop policy if exists "Leitura para autenticados" on public.registros_ia;
drop policy if exists "Permitir atualização para todos" on public.registros_ia;
drop policy if exists "Permitir exclusão para todos" on public.registros_ia;
drop policy if exists "Permitir gestão total pública" on public.registros_ia;
drop policy if exists "Permitir inserção para todos" on public.registros_ia;
drop policy if exists "Permitir leitura para todos" on public.registros_ia;
drop policy if exists "Update por dono ou admin" on public.registros_ia;

-- Nomes de documentação / legado (ia_records) caso tenham sido reaplicados.
drop policy if exists "Permitir leitura pública" on public.registros_ia;
drop policy if exists "Permitir tudo público" on public.registros_ia;
drop policy if exists "Visualização segura de registros de IA" on public.registros_ia;
drop policy if exists "Inserção de novo registro de IA" on public.registros_ia;
drop policy if exists "Atualização controlada de IA" on public.registros_ia;
drop policy if exists "Exclusão restrita a administradores" on public.registros_ia;

-- Nomes consolidados desta etapa (reaplicação idempotente).
drop policy if exists "Leitura de registros por autenticados" on public.registros_ia;
drop policy if exists "Inserção de registros pelo dono autenticado" on public.registros_ia;
drop policy if exists "Atualização de registros por administradores" on public.registros_ia;

-- Remove qualquer policy restante nesta tabela, independentemente do nome.
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'registros_ia'
  loop
    execute format(
      'drop policy if exists %I on public.registros_ia',
      pol.policyname
    );
  end loop;
end
$$;

create or replace function public.usuario_role_atual()
returns text
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select lower(btrim(coalesce(p.role::text, '')))
  from public.perfis as p
  where p.id = auth.uid()
$$;

create or replace function public.usuario_pertence_setor_registro(setor_registro text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.perfis as p
    cross join lateral unnest(
      string_to_array(coalesce(p.setor, ''), ';')
    ) as setor_bruto
    where p.id = auth.uid()
      and lower(btrim(setor_bruto)) <> ''
      and lower(btrim(setor_bruto)) = lower(btrim(coalesce(setor_registro, '')))
  )
$$;

revoke all on function public.usuario_role_atual() from public;
revoke all on function public.usuario_role_atual() from anon;
revoke all on function public.usuario_pertence_setor_registro(text) from public;
revoke all on function public.usuario_pertence_setor_registro(text) from anon;

grant execute on function public.usuario_role_atual() to authenticated;
grant execute on function public.usuario_pertence_setor_registro(text) to authenticated;

create policy "Leitura de registros por autenticados"
on public.registros_ia
for select
to authenticated
using (
  public.usuario_role_atual() in ('admin', 'moderator')
  or owner_id = auth.uid()
  or public.usuario_pertence_setor_registro(unidade_setor)
);

create policy "Inserção de registros pelo dono autenticado"
on public.registros_ia
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and public.usuario_pertence_setor_registro(unidade_setor)
);

create policy "Atualização de registros por administradores"
on public.registros_ia
for update
to authenticated
using (public.usuario_role_atual() = 'admin')
with check (public.usuario_role_atual() = 'admin');

-- PUBLIC herda para anon/authenticated; revogar remove USING true efetivo
-- e privilégios administrativos (DELETE/TRUNCATE/REFERENCES/TRIGGER).
revoke all on table public.registros_ia from public;
revoke all on table public.registros_ia from anon;
revoke all on table public.registros_ia from authenticated;

grant select on table public.registros_ia to authenticated;

-- INSERT do frontend (persistirRegistroIa, modo criar):
-- id, data, updated_at, unidade_setor, responsavel_preenchimento,
-- nome_ferramenta, status_uso, owner_id. created_at usa default.
grant insert (
  id,
  data,
  updated_at,
  unidade_setor,
  responsavel_preenchimento,
  nome_ferramenta,
  status_uso,
  owner_id
) on table public.registros_ia to authenticated;

-- UPDATE administrativo (persistirRegistroIa, modo atualizar):
-- data, updated_at, unidade_setor, responsavel_preenchimento,
-- nome_ferramenta, status_uso. id e owner_id ficam de fora.
grant update (
  data,
  updated_at,
  unidade_setor,
  responsavel_preenchimento,
  nome_ferramenta,
  status_uso
) on table public.registros_ia to authenticated;

commit;
