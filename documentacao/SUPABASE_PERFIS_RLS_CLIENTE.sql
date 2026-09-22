-- Revisão manual obrigatória antes da aplicação.
-- Etapa 1: consolida RLS de cliente em public.perfis.
-- Não altera colunas, registros, handle_new_user(), on_auth_user_created,
-- service_role, registros_ia, sectors, mensagens nem workflow.
-- Não adiciona a coluna ativo.
--
-- UPSERT do frontend (persistirAtribuicoesPerfil, onConflict id) continua
-- válido: SELECT autenticado + INSERT/UPDATE nas colunas permitidas da
-- própria linha. role e sector_locked ficam nos defaults ('user' / false)
-- e a policy de INSERT exige esses valores.

begin;

-- Policies duplicadas conhecidas (INSERT).
drop policy if exists "Insert próprio perfil" on public.perfis;
drop policy if exists "Inserção automática de perfil" on public.perfis;
drop policy if exists "Inserção automática de perfil via trigger ou manual" on public.perfis;

-- Policies duplicadas conhecidas (SELECT TO public / USING true).
drop policy if exists "Perfis são visíveis para todos" on public.perfis;
drop policy if exists "Perfis são visíveis para todos os usuários autenticados" on public.perfis;
drop policy if exists "Perfis visíveis" on public.perfis;

-- Policies duplicadas conhecidas (UPDATE).
drop policy if exists "Update próprio perfil" on public.perfis;
drop policy if exists "Usuários podem atualizar o próprio perfil" on public.perfis;
drop policy if exists "Usuários podem atualizar seus próprios perfis" on public.perfis;

-- Nomes consolidados (reaplicação idempotente).
drop policy if exists "Leitura de perfis por autenticados" on public.perfis;
drop policy if exists "Inserção do próprio perfil por autenticados" on public.perfis;
drop policy if exists "Atualização do próprio perfil por autenticados" on public.perfis;

create policy "Leitura de perfis por autenticados"
on public.perfis
for select
to authenticated
using (true);

create policy "Inserção do próprio perfil por autenticados"
on public.perfis
for insert
to authenticated
with check (
  auth.uid() = id
  and role = 'user'
  and sector_locked = false
);

create policy "Atualização do próprio perfil por autenticados"
on public.perfis
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- PUBLIC herda para anon/authenticated; revogar evita SELECT anônimo do catálogo.
revoke all on table public.perfis from public;
revoke all on table public.perfis from anon;
revoke all on table public.perfis from authenticated;

grant select on table public.perfis to authenticated;

grant insert (
  id,
  full_name,
  setor,
  cargo,
  contato,
  avatar_url,
  updated_at,
  last_seen
) on table public.perfis to authenticated;

grant update (
  id,
  full_name,
  setor,
  cargo,
  contato,
  avatar_url,
  updated_at,
  last_seen
) on table public.perfis to authenticated;

commit;
