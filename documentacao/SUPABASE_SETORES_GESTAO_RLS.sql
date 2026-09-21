-- Revisão manual obrigatória antes da aplicação.
-- Aplique somente se administradores autenticados não conseguirem INSERT/UPDATE/DELETE
-- em public.sectors (ou public.setores, conforme o nome físico do projeto).

begin;

-- Ajuste o nome da tabela se o ambiente usar public.setores em vez de public.sectors.
alter table public.sectors enable row level security;

drop policy if exists "Leitura de setores por autenticados" on public.sectors;
create policy "Leitura de setores por autenticados"
on public.sectors for select
to authenticated
using (true);

drop policy if exists "Gestão de setores por administradores" on public.sectors;
create policy "Gestão de setores por administradores"
on public.sectors for all
to authenticated
using (public.get_auth_role() = 'admin')
with check (public.get_auth_role() = 'admin');

commit;
