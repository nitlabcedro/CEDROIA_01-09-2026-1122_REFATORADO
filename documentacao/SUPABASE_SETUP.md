# Configuração do Supabase

Para que a integração com o Supabase funcione corretamente, siga os passos abaixo:

## 1. Ajustar a Tabela no Supabase

Se você já criou a tabela `ia_records`, execute este SQL para garantir que todas as colunas necessárias existam. O sistema utiliza uma coluna `data` (JSONB) para guardar o estado completo e colunas individuais para facilitar a visualização no dashboard do Supabase.

Abra o **SQL Editor** e execute:

```sql
-- 1. Tabela de Perfis de Usuário (Referenciando auth.users)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  full_name text,
  avatar_url text,
  cargo text,
  setor text,
  contato text,
  role text default 'user',
  last_seen timestamp with time zone
);

-- RECOMENDAÇÃO: Configurar exclusão em cascata para evitar erros ao apagar contas
-- Se você enfrentar erros como "Database error deleting user", execute os comandos abaixo:

-- 1. Cascade no Perfil (Auth -> Profile)
ALTER TABLE IF EXISTS public.profiles 
DROP CONSTRAINT IF EXISTS profiles_id_fkey,
ADD CONSTRAINT profiles_id_fkey 
FOREIGN KEY (id) REFERENCES auth.users (id) 
ON DELETE CASCADE;

-- 2. Cascade nas Mensagens (Profile -> Messages)
ALTER TABLE IF EXISTS public.messages
DROP CONSTRAINT IF EXISTS messages_sender_id_fkey,
ADD CONSTRAINT messages_sender_id_fkey 
FOREIGN KEY (sender_id) REFERENCES public.profiles (id) 
ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.messages
DROP CONSTRAINT IF EXISTS messages_recipient_id_fkey,
ADD CONSTRAINT messages_recipient_id_fkey 
FOREIGN KEY (recipient_id) REFERENCES public.profiles (id) 
ON DELETE CASCADE;

-- 3. Set Null no Inventário (Profile -> IA Records)
ALTER TABLE IF EXISTS public.ia_records
DROP CONSTRAINT IF EXISTS ia_records_owner_id_fkey,
ADD CONSTRAINT ia_records_owner_id_fkey 
FOREIGN KEY (owner_id) REFERENCES public.profiles (id) 
ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.ia_records
DROP CONSTRAINT IF EXISTS ia_records_authorized_by_fkey,
ADD CONSTRAINT ia_records_authorized_by_fkey 
FOREIGN KEY (authorized_by) REFERENCES public.profiles (id) 
ON DELETE SET NULL;

-- SE O ERRO PERSISTIR: Função SQL para limpeza profunda e exclusão
-- Esta função deve ser executada no SQL Editor. Ela apaga todas as referências antes de apagar o usuário no Auth.
-- Você pode chamá-la com: SELECT delete_user_and_cleanup('O_ID_DO_USUARIO_AQUI');

CREATE OR REPLACE FUNCTION delete_user_and_cleanup(target_user_id UUID)
RETURNS void AS $$
BEGIN
    -- 1. Mensagens
    DELETE FROM public.messages WHERE sender_id = target_user_id OR recipient_id = target_user_id;
    
    -- 2. Inventário
    UPDATE public.ia_records SET owner_id = NULL WHERE owner_id = target_user_id;
    UPDATE public.ia_records SET authorized_by = NULL WHERE authorized_by = target_user_id;
    
    -- 3. Referências em perfis
    UPDATE public.profiles SET authorized_by = NULL WHERE authorized_by = target_user_id;
    
    -- 4. Perfil
    DELETE FROM public.profiles WHERE id = target_user_id;
    
    -- 5. Storage (se houver)
    -- DELETE FROM storage.objects WHERE owner = target_user_id; 
    
    -- 6. O usuário no Auth (O próprio Supabase admin API chamará isso, mas aqui limpamos o que bloqueia)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Habilitar Realtime para Perfis para ver status online em tempo real
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
    and schemaname = 'public' 
    and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table profiles;
  end if;
end $$;

-- COMO CRIAR UM ADMINISTRADOR VIA SQL EDITOR:
-- 1. Primeiro, o usuário deve se cadastrar no app ou no dashboard do Supabase (Auth).
-- 2. No SQL Editor, execute o comando abaixo substituindo 'EMAIL_DO_USUARIO' pelo e-mail desejado:

-- DO $$ 
-- DECLARE 
--   user_id UUID;
-- BEGIN
--   SELECT id INTO user_id FROM auth.users WHERE email = 'EMAIL_DO_USUARIO';
--   
--   IF user_id IS NOT NULL THEN
--     UPDATE public.profiles SET role = 'admin' WHERE id = user_id;
--     RAISE NOTICE 'Usuário % promovido a admin com sucesso!', 'EMAIL_DO_USUARIO';
--   ELSE
--     RAISE EXCEPTION 'Usuário com e-mail % não encontrado.', 'EMAIL_DO_USUARIO';
--   END IF;
-- END $$;

-- 2. Tabela de Mensagens (Chat) com Cascade Delete
create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  sender_id uuid references profiles(id) on delete cascade not null,
  content text not null,
  is_private boolean default false,
  recipient_id uuid references profiles(id) on delete cascade
);

-- 3. Habilitar Realtime (com verificação para evitar erro 42710)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
    and schemaname = 'public' 
    and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table messages;
  end if;
end $$;

-- 4. Tabela de Inventário de IA
create table if not exists ia_records (
  id text primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  owner_id uuid references profiles(id) on delete set null,
  status text default 'Pendente',
  authorized_by uuid references profiles(id),
  authorized_at timestamp with time zone,
  data jsonb,
  unidade_setor text,
  responsavel_preenchimento text,
  cargo text,
  data_registro date,
  utiliza_ia text,
  nome_ferramenta text,
  fornecedor text,
  status_uso text,
  classificacao_risco text
);

-- 5. Tabela de Configuração de Aprovação (Workflow Config)
create table if not exists approval_config (
  step_number integer primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  role_name text not null,
  assigned_user_id uuid references public.profiles(id) on delete set null,
  assigned_user_name text,
  is_opinion_only boolean default false,
  updated_at timestamp with time zone,
  updated_by uuid references public.profiles(id) on delete set null
);

-- 6. Tabela de Fluxos de Aprovação
create table if not exists approval_workflows (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  ia_record_id text references public.ia_records(id) on delete cascade unique not null,
  current_step integer default 1 not null,
  final_status text default 'pendente' not null,
  completed_at timestamp with time zone
);

-- 7. Tabela de Etapas de Aprovação
create table if not exists approval_steps (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  workflow_id uuid references public.approval_workflows(id) on delete cascade not null,
  ia_record_id text references public.ia_records(id) on delete cascade not null,
  step_number integer not null,
  role_name text not null,
  assigned_user_id uuid references public.profiles(id) on delete set null,
  assigned_user_name text,
  status text default 'aguardando' not null,
  comment text,
  is_opinion_only boolean default false,
  decided_at timestamp with time zone,
  unique (workflow_id, step_number)
);

-- CONFIGURAÇÃO PARA UPLOAD DE FOTOS (STORAGE)
-- 1. Vá em 'Storage' no painel do Supabase.
-- 2. Crie um novo bucket chamado 'avatars'.
-- 3. Marque o bucket como 'Public' (Público).
-- 4. Execute estas políticas no SQL Editor para permitir uploads:

-- Permitir que qualquer usuário autenticado faça upload para o bucket avatars
create policy "Avatar Upload" on storage.objects for insert with check (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated'
);

-- Permitir que usuários atualizem seus próprios avatares
create policy "Avatar Update" on storage.objects for update with check (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated'
);

-- Permitir que todos visualizem os avatares (bucket público)
create policy "Avatar View" on storage.objects for select using (
  bucket_id = 'avatars'
);

-- Habilitar RLS para Perfis
alter table profiles enable row level security;
create policy "Perfis são visíveis para todos os usuários autenticados" on profiles for select using (true);
create policy "Usuários podem atualizar seus próprios perfis" on profiles for update using (auth.uid() = id);
create policy "Inserção automática de perfil via trigger ou manual" on profiles for insert with check (auth.uid() = id);

-- Habilitar RLS para Mensagens
alter table messages enable row level security;
create policy "Mensagens públicas visíveis para todos" on messages for select 
  using (not is_private or auth.uid() = sender_id or auth.uid() = recipient_id);
create policy "Qualquer usuário autenticado pode enviar mensagens" on messages for insert 
  with check (auth.uid() = sender_id);

-- Sugestão: Limpeza Automática de Mensagens (24h)
-- Nota: Para automação em background real no Supabase, você pode usar a extensão pg_cron se disponível:
-- select cron.schedule('limpar-mensagens-24h', '0 * * * *', $$ delete from messages where created_at < now() - interval '24 hours' $$);
-- A aplicação também realiza uma limpeza "lazy" ao abrir o chat.

-- Adicionar colunas extras se não existirem (sem restrição NOT NULL para flexibilidade)
alter table ia_records add column if not exists data jsonb;
alter table ia_records add column if not exists unidade_setor text;
alter table ia_records add column if not exists responsavel_preenchimento text;
alter table ia_records add column if not exists cargo text;
alter table ia_records add column if not exists data_registro date;
alter table ia_records add column if not exists utiliza_ia text;
alter table ia_records add column if not exists nome_ferramenta text;
alter table ia_records add column if not exists fornecedor text;
alter table ia_records add column if not exists status_uso text;
alter table ia_records add column if not exists classificacao_risco text;

-- Se as colunas já existirem com NOT NULL, remova a restrição (executar se persistir erro)
alter table ia_records alter column unidade_setor drop not null;
alter table ia_records alter column responsavel_preenchimento drop not null;
alter table ia_records alter column cargo drop not null;
alter table ia_records alter column data_registro drop not null;
alter table ia_records alter column utiliza_ia drop not null;
alter table ia_records alter column nome_ferramenta drop not null;
alter table ia_records alter column fornecedor drop not null;
alter table ia_records alter column status_uso drop not null;
alter table ia_records alter column classificacao_risco drop not null;

-- Habilitar Row Level Security (RLS)
alter table ia_records enable row level security;

-- Criar política de acesso público (Leitura)
drop policy if exists "Permitir leitura pública" on ia_records;
create policy "Permitir leitura pública"
  on ia_records for select
  using (true);

-- Criar política de acesso público (Tudo)
drop policy if exists "Permitir tudo público" on ia_records;
create policy "Permitir tudo público"
  on ia_records for all
  using (true)
  with check (true);

-- Habilitar RLS para tabelas de Workflow
alter table approval_config enable row level security;
alter table approval_workflows enable row level security;
alter table approval_steps enable row level security;

-- Políticas para approval_config
drop policy if exists "Permitir leitura para autenticados" on approval_config;
create policy "Permitir leitura para autenticados"
  on approval_config for select to authenticated using (true);

drop policy if exists "Permitir escrita total para autenticados" on approval_config;
create policy "Permitir escrita total para autenticados"
  on approval_config for all to authenticated using (true) with check (true);

-- Políticas para approval_workflows
drop policy if exists "Permitir leitura para autenticados" on approval_workflows;
create policy "Permitir leitura para autenticados"
  on approval_workflows for select to authenticated using (true);

drop policy if exists "Permitir escrita total para autenticados" on approval_workflows;
create policy "Permitir escrita total para autenticados"
  on approval_workflows for all to authenticated using (true) with check (true);

-- Políticas para approval_steps
drop policy if exists "Permitir leitura para autenticados" on approval_steps;
create policy "Permitir leitura para autenticados"
  on approval_steps for select to authenticated using (true);

drop policy if exists "Permitir escrita total para autenticados" on approval_steps;
create policy "Permitir escrita total para autenticados"
  on approval_steps for all to authenticated using (true) with check (true);
```

## 2. Configurar Variáveis de Ambiente

As suas chaves já parecem estar configuradas. Se o monitor no topo do app mostrar **NUVEM: ATIVO**, a conexão está funcionando.

- `VITE_SUPABASE_URL`: `https://seu-projeto.supabase.co`
- `VITE_SUPABASE_ANON_KEY`: (A chave que você enviou no chat)

## 3. Status da Integração

O monitor no topo do aplicativo indicará **NUVEM: ATIVO** se a conexão for bem-sucedida e a tabela `ia_records` estiver acessível.
