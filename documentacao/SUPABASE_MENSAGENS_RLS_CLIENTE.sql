-- Revisão manual obrigatória antes da aplicação.
-- Etapa 4: chat de suporte, RLS de public.mensagens e bucket chat-attachments.
-- Não aplica automaticamente. Não altera public.mensagens_ti nem workflow TI.
-- Não reduz privilégios de service_role.
-- Não apaga a coluna is_private; novas inserções exigem mensagem direta/privada.
-- Reutiliza public.usuario_role_atual() da Etapa 3B.2; não a recria nem a remove.

begin;

alter table public.mensagens enable row level security;

-- Policies conhecidas (legado messages/mensagens, públicas e duplicadas).
drop policy if exists "Leitura de mensagens permitidas" on public.mensagens;
drop policy if exists "Envio de mensagens próprio" on public.mensagens;
drop policy if exists "Permitir leitura pública" on public.mensagens;
drop policy if exists "Permitir inserção para autenticados" on public.mensagens;
drop policy if exists "Usuários autenticados podem inserir" on public.mensagens;
drop policy if exists "Usuários podem deletar próprias mensagens" on public.mensagens;
drop policy if exists "Delete próprias mensagens" on public.mensagens;
drop policy if exists "Acesso público leitura" on public.mensagens;
drop policy if exists "Acesso público escrita" on public.mensagens;
drop policy if exists "Allow All Access" on public.mensagens;
drop policy if exists "Permitir leitura para todos" on public.mensagens;
drop policy if exists "Permitir inserção para todos" on public.mensagens;
drop policy if exists "Permitir exclusão para todos" on public.mensagens;

-- Nomes consolidados desta etapa (reaplicação idempotente).
drop policy if exists "Leitura de mensagens pelos participantes" on public.mensagens;
drop policy if exists "Inserção de mensagens de suporte" on public.mensagens;
drop policy if exists "Atualização de leitura pelo destinatário" on public.mensagens;

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'mensagens'
  loop
    execute format(
      'drop policy if exists %I on public.mensagens',
      pol.policyname
    );
  end loop;
end
$$;

create or replace function public.usuario_pode_conversar_com(destinatario uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select
    destinatario is not null
    and destinatario <> auth.uid()
    and exists (
      select 1
      from public.perfis as destino
      where destino.id = destinatario
        and (
          public.usuario_role_atual() = 'admin'
          or lower(btrim(coalesce(destino.role::text, ''))) = 'admin'
        )
    )
$$;

create or replace function public.usuario_pode_acessar_anexo_chat(caminho text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select
    caminho is not null
    and btrim(caminho) <> ''
    and (
      split_part(btrim(caminho), '/', 1) = auth.uid()::text
      or exists (
        select 1
        from public.mensagens as m
        where m.attachment_url is not null
          and btrim(m.attachment_url) = btrim(caminho)
          and (
            m.sender_id = auth.uid()
            or m.recipient_id = auth.uid()
          )
      )
    )
$$;

create or replace function public.usuario_pode_excluir_anexo_orfao_chat(caminho text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select
    caminho is not null
    and btrim(caminho) <> ''
    and split_part(btrim(caminho), '/', 1) = auth.uid()::text
    and not exists (
      select 1
      from public.mensagens as m
      where m.attachment_url is not null
        and btrim(m.attachment_url) = btrim(caminho)
    )
$$;

revoke all on function public.usuario_pode_conversar_com(uuid) from public;
revoke all on function public.usuario_pode_conversar_com(uuid) from anon;
revoke all on function public.usuario_pode_acessar_anexo_chat(text) from public;
revoke all on function public.usuario_pode_acessar_anexo_chat(text) from anon;
revoke all on function public.usuario_pode_excluir_anexo_orfao_chat(text) from public;
revoke all on function public.usuario_pode_excluir_anexo_orfao_chat(text) from anon;

grant execute on function public.usuario_pode_conversar_com(uuid) to authenticated;
grant execute on function public.usuario_pode_acessar_anexo_chat(text) to authenticated;
grant execute on function public.usuario_pode_excluir_anexo_orfao_chat(text) to authenticated;

create policy "Leitura de mensagens pelos participantes"
on public.mensagens
for select
to authenticated
using (
  auth.uid() = sender_id
  or auth.uid() = recipient_id
);

create policy "Inserção de mensagens de suporte"
on public.mensagens
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and recipient_id is not null
  and sender_id <> recipient_id
  and is_private = true
  and public.usuario_pode_conversar_com(recipient_id)
  and (
    attachment_url is null
    or split_part(btrim(attachment_url), '/', 1) = auth.uid()::text
  )
);

create policy "Atualização de leitura pelo destinatário"
on public.mensagens
for update
to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

revoke all on table public.mensagens from public;
revoke all on table public.mensagens from anon;
revoke all on table public.mensagens from authenticated;

grant select on table public.mensagens to authenticated;

grant insert (
  content,
  sender_id,
  is_private,
  recipient_id,
  attachment_url,
  attachment_name,
  attachment_type,
  attachment_size
) on table public.mensagens to authenticated;

grant update (read_at) on table public.mensagens to authenticated;

-- Bucket privado com limite de 5 MB e MIME permitidos.
-- Não altera o bucket avatars.
update storage.buckets
set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
where id = 'chat-attachments';

drop policy if exists "Usuários autenticados podem enviar anexos do chat" on storage.objects;
drop policy if exists "Usuários autenticados podem visualizar anexos do chat" on storage.objects;
drop policy if exists "Upload de anexos no próprio namespace" on storage.objects;
drop policy if exists "Leitura de anexos pelos participantes" on storage.objects;
drop policy if exists "Exclusão de anexo órfão pelo remetente" on storage.objects;

create policy "Upload de anexos no próprio namespace"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'chat-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Leitura de anexos pelos participantes"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'chat-attachments'
  and public.usuario_pode_acessar_anexo_chat(name)
);

create policy "Exclusão de anexo órfão pelo remetente"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'chat-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.usuario_pode_excluir_anexo_orfao_chat(name)
);

commit;
