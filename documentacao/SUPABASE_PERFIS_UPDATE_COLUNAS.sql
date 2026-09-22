-- Revisão manual obrigatória antes da aplicação.
-- Esta migration não altera policies RLS, não altera registros existentes
-- e não modifica privilégios de service_role.
--
-- authenticated não pode fazer UPDATE de role ou sector_locked.
-- id permanece permitido somente por compatibilidade com o UPSERT;
-- a RLS atual garante que o usuário só possa operar a própria linha.

begin;

-- Remove o UPDATE de tabela inteira herdado por clientes PostgREST.
-- PUBLIC é revogado porque GRANT em PUBLIC também vale para authenticated/anon.
revoke update on table public.perfis from public;
revoke update on table public.perfis from anon;
revoke update on table public.perfis from authenticated;

-- authenticated volta a poder atualizar somente campos do próprio perfil
-- usados pelo frontend (persistencia-perfil, heartbeat last_seen e contato).
-- INSERT permanece inalterado (necessário para upsert onConflict id).
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
