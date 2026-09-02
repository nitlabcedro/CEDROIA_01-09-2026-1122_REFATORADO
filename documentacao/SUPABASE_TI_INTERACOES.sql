-- Cedro IA — Interações da Etapa 2 (TI) com o solicitante
-- Execute este arquivo UMA VEZ no SQL Editor do Supabase antes de usar o novo fluxo.

create extension if not exists pgcrypto;

create table if not exists public.ti_information_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  workflow_id uuid not null references public.approval_workflows(id) on delete cascade,
  ia_record_id text not null references public.ia_records(id) on delete cascade,
  step_number integer not null default 2 check (step_number = 2),
  round_number integer not null check (round_number > 0),
  requested_by_id uuid not null references public.profiles(id) on delete restrict,
  requested_by_name text not null,
  requester_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'aguardando_resposta'
    check (status in ('aguardando_resposta', 'respondida')),
  responded_at timestamp with time zone,
  unique (workflow_id, round_number)
);

create table if not exists public.ti_information_questions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  request_id uuid not null references public.ti_information_requests(id) on delete cascade,
  order_number integer not null check (order_number > 0),
  question text not null check (length(trim(question)) > 0),
  answer text,
  answered_at timestamp with time zone,
  unique (request_id, order_number)
);

create index if not exists idx_ti_information_requests_requester_status
  on public.ti_information_requests (requester_id, status, created_at);

create index if not exists idx_ti_information_requests_workflow
  on public.ti_information_requests (workflow_id, round_number);

create index if not exists idx_ti_information_questions_request
  on public.ti_information_questions (request_id, order_number);

-- As leituras e gravações deste módulo passam exclusivamente pela API backend,
-- que usa a service_role e valida explicitamente o usuário autenticado.
-- Mantemos RLS habilitado sem políticas abertas para impedir acesso direto pelo cliente.
alter table public.ti_information_requests enable row level security;
alter table public.ti_information_questions enable row level security;

revoke all on table public.ti_information_requests from anon, authenticated;
revoke all on table public.ti_information_questions from anon, authenticated;
