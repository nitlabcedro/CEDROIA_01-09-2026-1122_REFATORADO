-- Revisão manual obrigatória antes da aplicação.
-- Etapa 6B: adiciona o estado operacional da conta sem alterar dados relacionados.
-- Não concede escrita a authenticated, não altera RLS e não modifica service_role.

begin;

alter table public.perfis
  add column if not exists ativo boolean not null default true;

commit;
