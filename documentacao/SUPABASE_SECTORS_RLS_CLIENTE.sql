-- Revisão manual obrigatória antes da aplicação.
-- Etapa 2: consolida RLS de cliente em public.sectors.
-- Não altera colunas, registros, public.perfis, registros_ia, mensagens,
-- workflow, autenticação, service_role nem adiciona a coluna ativo.
--
-- SELECT anônimo permanece, limitado a status = 'Ativo': o cadastro/login
-- carrega setores e cargos via obterSetoresAtivos() antes de auth.uid().
-- Escrita fica restrita a authenticated cujo perfil em public.perfis
-- tenha role = 'admin'. get_auth_role() não é usada: no projeto ela
-- aponta para public.profiles (legado) e não há função aplicada válida.

begin;

-- Policies atuais conhecidas (escrita ampla e leitura pública).
drop policy if exists "Apenas admins podem modificar setores" on public.sectors;
drop policy if exists "Setores visíveis para todos" on public.sectors;

-- Nomes consolidados desta etapa (reaplicação idempotente).
drop policy if exists "Leitura de setores por anonimos" on public.sectors;
drop policy if exists "Leitura de setores ativos por anonimos" on public.sectors;
drop policy if exists "Leitura de setores por autenticados" on public.sectors;
drop policy if exists "Inserção de setores por administradores" on public.sectors;
drop policy if exists "Atualização de setores por administradores" on public.sectors;
drop policy if exists "Exclusão de setores por administradores" on public.sectors;

create policy "Leitura de setores ativos por anonimos"
on public.sectors
for select
to anon
using (status = 'Ativo');

create policy "Leitura de setores por autenticados"
on public.sectors
for select
to authenticated
using (true);

create policy "Inserção de setores por administradores"
on public.sectors
for insert
to authenticated
with check (
  exists (
    select 1
    from public.perfis
    where id = auth.uid()
      and role = 'admin'
  )
);

create policy "Atualização de setores por administradores"
on public.sectors
for update
to authenticated
using (
  exists (
    select 1
    from public.perfis
    where id = auth.uid()
      and role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.perfis
    where id = auth.uid()
      and role = 'admin'
  )
);

create policy "Exclusão de setores por administradores"
on public.sectors
for delete
to authenticated
using (
  exists (
    select 1
    from public.perfis
    where id = auth.uid()
      and role = 'admin'
  )
);

-- PUBLIC herda para anon/authenticated; revogar evita escrita anônima
-- e privilégios administrativos (TRUNCATE/REFERENCES/TRIGGER).
revoke all on table public.sectors from public;
revoke all on table public.sectors from anon;
revoke all on table public.sectors from authenticated;

grant select on table public.sectors to anon;

grant select, insert, update, delete on table public.sectors to authenticated;

commit;
