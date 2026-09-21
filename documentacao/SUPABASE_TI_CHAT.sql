-- Cedro IA — chat transacional da Etapa 2 (TI)
-- Migration aditiva e retrocompatível. Revise e execute manualmente no Supabase.
-- Este arquivo NÃO converte nem altera perguntas_ti existentes.

begin;

-- PRE-CHECK DE DIAGNÓSTICO
-- Execute esta consulta isoladamente antes da migration operacional. Qualquer
-- linha exige análise manual; não apague, atualize, funda ou escolha registros.
--
-- select
--   workflow_id,
--   count(*) as conversas_abertas,
--   array_agg(id order by round_number, created_at) as ids
-- from public.solicitacoes_ti
-- where status = 'aguardando_resposta'
-- group by workflow_id
-- having count(*) > 1;

-- Bloqueio operacional: interrompe e reverte toda a migration se o pre-check
-- encontrar mais de uma conversa aberta no mesmo workflow.
do $$
declare
  v_duplicidades jsonb;
begin
  select jsonb_agg(to_jsonb(duplicidade))
    into v_duplicidades
  from (
    select
      workflow_id,
      count(*) as conversas_abertas,
      array_agg(id order by round_number, created_at) as ids
    from public.solicitacoes_ti
    where status = 'aguardando_resposta'
    group by workflow_id
    having count(*) > 1
  ) duplicidade;

  if v_duplicidades is not null then
    raise exception using
      errcode = 'P0001',
      message = 'A migration foi interrompida: existem workflows com mais de uma conversa aberta.',
      detail = 'PRECHECK_CONVERSAS_ABERTAS:' || v_duplicidades::text;
  end if;
end;
$$;

alter table public.solicitacoes_ti
  add column if not exists current_turn text null,
  add column if not exists closed_at timestamp with time zone null;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'solicitacoes_ti_current_turn_check'
      and conrelid = 'public.solicitacoes_ti'::regclass
  ) then
    alter table public.solicitacoes_ti
      add constraint solicitacoes_ti_current_turn_check
      check (current_turn is null or current_turn in ('solicitante', 'ti'));
  end if;
end;
$$;

create table if not exists public.mensagens_ti (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  request_id uuid not null references public.solicitacoes_ti(id) on delete cascade,
  sequence_number integer not null check (sequence_number > 0),
  author_id uuid not null references public.perfis(id) on delete restrict,
  author_role text not null check (author_role in ('ti', 'solicitante')),
  content text not null check (char_length(trim(content)) between 1 and 1000),
  unique (request_id, sequence_number)
);

create unique index if not exists uq_solicitacoes_ti_uma_aberta_por_workflow
  on public.solicitacoes_ti (workflow_id)
  where closed_at is null
    and (
      current_turn is not null
      or status = 'aguardando_resposta'
    );

alter table public.mensagens_ti enable row level security;
revoke all on table public.mensagens_ti from public, anon, authenticated;
grant select on table public.mensagens_ti to service_role;

create or replace function public.criar_conversa_comunicacao_ti(
  p_ia_record_id text,
  p_user_id uuid,
  p_user_name text,
  p_content text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_workflow public.fluxos_aprovacao%rowtype;
  v_step public.etapas_aprovacao%rowtype;
  v_request public.solicitacoes_ti%rowtype;
  v_message public.mensagens_ti%rowtype;
  v_requester_id uuid;
  v_round_number integer;
  v_is_admin boolean;
  v_requested_by_name text;
begin
  p_content := trim(p_content);
  if p_content is null or char_length(p_content) not between 1 and 1000 then
    raise exception using
      errcode = 'P0001',
      message = 'A mensagem deve ter entre 1 e 1000 caracteres.',
      detail = 'MENSAGEM_INVALIDA';
  end if;

  select *
    into v_workflow
  from public.fluxos_aprovacao
  where ia_record_id = p_ia_record_id
  for update;

  if not found
     or v_workflow.final_status <> 'pendente'
     or v_workflow.current_step <> 2 then
    raise exception using
      errcode = 'P0001',
      message = 'O workflow deve estar pendente na Etapa 2 — TI.',
      detail = 'WORKFLOW_INVALIDO';
  end if;

  select *
    into v_step
  from public.etapas_aprovacao
  where workflow_id = v_workflow.id
    and step_number = 2;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'A Etapa 2 — TI não foi encontrada.',
      detail = 'WORKFLOW_INVALIDO';
  end if;

  select
    lower(trim(coalesce(role, ''))) = 'admin',
    coalesce(nullif(trim(full_name), ''), nullif(trim(p_user_name), ''), 'Usuário')
    into v_is_admin, v_requested_by_name
  from public.perfis
  where id = p_user_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'O usuário autenticado não possui perfil.',
      detail = 'NAO_AUTORIZADO';
  end if;

  if not v_is_admin and v_step.assigned_user_id is distinct from p_user_id then
    raise exception using
      errcode = 'P0001',
      message = 'Apenas o responsável da Etapa 2 — TI ou um administrador pode criar a conversa.',
      detail = 'NAO_AUTORIZADO';
  end if;

  select coalesce(owner_id, nullif(data ->> 'ownerId', '')::uuid)
    into v_requester_id
  from public.registros_ia
  where id = p_ia_record_id;

  if not found or v_requester_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'A solicitação não possui um solicitante válido.',
      detail = 'WORKFLOW_INVALIDO';
  end if;

  if exists (
    select 1
    from public.solicitacoes_ti
    where workflow_id = v_workflow.id
      and closed_at is null
      and (
        current_turn is not null
        or status = 'aguardando_resposta'
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Já existe uma conversa aberta para este workflow.',
      detail = 'CONVERSA_ABERTA';
  end if;

  select coalesce(max(round_number), 0) + 1
    into v_round_number
  from public.solicitacoes_ti
  where workflow_id = v_workflow.id;

  insert into public.solicitacoes_ti (
    workflow_id,
    ia_record_id,
    step_number,
    round_number,
    requested_by_id,
    requested_by_name,
    requester_id,
    status,
    responded_at,
    current_turn,
    closed_at
  )
  values (
    v_workflow.id,
    p_ia_record_id,
    2,
    v_round_number,
    p_user_id,
    v_requested_by_name,
    v_requester_id,
    'aguardando_resposta',
    null,
    'solicitante',
    null
  )
  returning * into v_request;

  insert into public.mensagens_ti (
    request_id,
    sequence_number,
    author_id,
    author_role,
    content
  )
  values (
    v_request.id,
    1,
    p_user_id,
    'ti',
    p_content
  )
  returning * into v_message;

  return jsonb_build_object(
    'request', to_jsonb(v_request),
    'message', to_jsonb(v_message)
  );
end;
$$;

create or replace function public.enviar_mensagem_comunicacao_ti(
  p_request_id uuid,
  p_user_id uuid,
  p_content text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_request public.solicitacoes_ti%rowtype;
  v_workflow public.fluxos_aprovacao%rowtype;
  v_step public.etapas_aprovacao%rowtype;
  v_message public.mensagens_ti%rowtype;
  v_sequence_number integer;
  v_author_role text;
  v_is_admin boolean;
  v_now timestamp with time zone := now();
begin
  p_content := trim(p_content);
  if p_content is null or char_length(p_content) not between 1 and 1000 then
    raise exception using
      errcode = 'P0001',
      message = 'A mensagem deve ter entre 1 e 1000 caracteres.',
      detail = 'MENSAGEM_INVALIDA';
  end if;

  select *
    into v_request
  from public.solicitacoes_ti
  where id = p_request_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Conversa não encontrada.',
      detail = 'THREAD_NAO_ENCONTRADA';
  end if;

  if v_request.closed_at is not null then
    raise exception using
      errcode = 'P0001',
      message = 'Esta conversa já foi encerrada.',
      detail = 'CONVERSA_ENCERRADA';
  end if;

  if v_request.current_turn is null then
    raise exception using
      errcode = 'P0001',
      message = 'Esta rodada utiliza o fluxo legado de perguntas e respostas.',
      detail = 'MODO_LEGADO';
  end if;

  select *
    into v_workflow
  from public.fluxos_aprovacao
  where id = v_request.workflow_id
  for update;

  if not found
     or v_workflow.final_status <> 'pendente'
     or v_workflow.current_step <> 2 then
    raise exception using
      errcode = 'P0001',
      message = 'O workflow deve estar pendente na Etapa 2 — TI.',
      detail = 'WORKFLOW_INVALIDO';
  end if;

  if v_request.current_turn = 'solicitante' then
    if v_request.requester_id is distinct from p_user_id then
      raise exception using
        errcode = 'P0001',
        message = 'Somente o solicitante pode responder neste turno.',
        detail = 'NAO_AUTORIZADO';
    end if;
    v_author_role := 'solicitante';
  elsif v_request.current_turn = 'ti' then
    select *
      into v_step
    from public.etapas_aprovacao
    where workflow_id = v_workflow.id
      and step_number = 2;

    select lower(trim(coalesce(role, ''))) = 'admin'
      into v_is_admin
    from public.perfis
    where id = p_user_id;

    if not found then
      raise exception using
        errcode = 'P0001',
        message = 'O usuário autenticado não possui perfil.',
        detail = 'NAO_AUTORIZADO';
    end if;

    if v_step.id is null
       or (not v_is_admin and v_step.assigned_user_id is distinct from p_user_id) then
      raise exception using
        errcode = 'P0001',
        message = 'Somente o responsável da Etapa 2 — TI ou um administrador pode enviar neste turno.',
        detail = 'NAO_AUTORIZADO';
    end if;
    v_author_role := 'ti';
  else
    raise exception using
      errcode = 'P0001',
      message = 'O turno atual da conversa é inválido.',
      detail = 'TURNO_INVALIDO';
  end if;

  select coalesce(max(sequence_number), 0) + 1
    into v_sequence_number
  from public.mensagens_ti
  where request_id = p_request_id;

  insert into public.mensagens_ti (
    request_id,
    sequence_number,
    author_id,
    author_role,
    content
  )
  values (
    p_request_id,
    v_sequence_number,
    p_user_id,
    v_author_role,
    p_content
  )
  returning * into v_message;

  if v_author_role = 'solicitante' then
    update public.solicitacoes_ti
    set
      current_turn = 'ti',
      status = 'respondida',
      responded_at = v_now
    where id = p_request_id
    returning * into v_request;
  else
    update public.solicitacoes_ti
    set
      current_turn = 'solicitante',
      status = 'aguardando_resposta',
      responded_at = null
    where id = p_request_id
    returning * into v_request;
  end if;

  return jsonb_build_object(
    'request', to_jsonb(v_request),
    'message', to_jsonb(v_message)
  );
end;
$$;

create or replace function public.encerrar_conversa_comunicacao_ti(
  p_request_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_request public.solicitacoes_ti%rowtype;
  v_workflow public.fluxos_aprovacao%rowtype;
  v_step public.etapas_aprovacao%rowtype;
  v_is_admin boolean;
  v_now timestamp with time zone := now();
begin
  select *
    into v_request
  from public.solicitacoes_ti
  where id = p_request_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Conversa não encontrada.',
      detail = 'THREAD_NAO_ENCONTRADA';
  end if;

  if v_request.current_turn is null then
    raise exception using
      errcode = 'P0001',
      message = 'Esta rodada utiliza o fluxo legado de perguntas e respostas.',
      detail = 'MODO_LEGADO';
  end if;

  if v_request.closed_at is not null then
    raise exception using
      errcode = 'P0001',
      message = 'Esta conversa já foi encerrada.',
      detail = 'CONVERSA_ENCERRADA';
  end if;

  if v_request.current_turn <> 'ti' then
    raise exception using
      errcode = 'P0001',
      message = 'A conversa só pode ser encerrada durante o turno da TI.',
      detail = 'TURNO_INVALIDO';
  end if;

  select *
    into v_workflow
  from public.fluxos_aprovacao
  where id = v_request.workflow_id
  for update;

  if not found
     or v_workflow.final_status <> 'pendente'
     or v_workflow.current_step <> 2 then
    raise exception using
      errcode = 'P0001',
      message = 'O workflow deve estar pendente na Etapa 2 — TI.',
      detail = 'WORKFLOW_INVALIDO';
  end if;

  select *
    into v_step
  from public.etapas_aprovacao
  where workflow_id = v_workflow.id
    and step_number = 2;

  select lower(trim(coalesce(role, ''))) = 'admin'
    into v_is_admin
  from public.perfis
  where id = p_user_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'O usuário autenticado não possui perfil.',
      detail = 'NAO_AUTORIZADO';
  end if;

  if v_step.id is null
     or (not v_is_admin and v_step.assigned_user_id is distinct from p_user_id) then
    raise exception using
      errcode = 'P0001',
      message = 'Somente o responsável da Etapa 2 — TI ou um administrador pode encerrar.',
      detail = 'NAO_AUTORIZADO';
  end if;

  update public.solicitacoes_ti
  set closed_at = v_now
  where id = p_request_id
  returning * into v_request;

  return jsonb_build_object('request', to_jsonb(v_request));
end;
$$;

-- A decisão da Etapa 2 compartilha o mesmo lock de workflow das RPCs do chat.
-- Assim, a validação de pendência e as atualizações de etapa/workflow são uma
-- única transação e não deixam parecer aprovado se surgir uma pergunta.
create or replace function public.decidir_etapa_ti_comunicacao_segura(
  p_workflow_id uuid,
  p_step_id uuid,
  p_user_id uuid,
  p_decision text,
  p_comment text,
  p_user_name text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_workflow public.fluxos_aprovacao%rowtype;
  v_step public.etapas_aprovacao%rowtype;
  v_is_admin boolean;
  v_actor_name text;
  v_now timestamp with time zone := now();
begin
  if p_decision is null
     or p_decision not in ('aprovado', 'negado') then
    raise exception using
      errcode = 'P0001',
      message = 'A decisão informada é inválida.',
      detail = 'DECISAO_INVALIDA';
  end if;

  select *
    into v_workflow
  from public.fluxos_aprovacao
  where id = p_workflow_id
  for update;

  if not found
     or v_workflow.final_status <> 'pendente'
     or v_workflow.current_step <> 2 then
    raise exception using
      errcode = 'P0001',
      message = 'O workflow deve estar pendente na Etapa 2 — TI.',
      detail = 'WORKFLOW_INVALIDO';
  end if;

  select *
    into v_step
  from public.etapas_aprovacao
  where id = p_step_id
    and workflow_id = p_workflow_id
    and step_number = 2
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'A Etapa 2 — TI não foi encontrada.',
      detail = 'WORKFLOW_INVALIDO';
  end if;

  select
    lower(trim(coalesce(role, ''))) = 'admin',
    coalesce(nullif(trim(full_name), ''), nullif(trim(p_user_name), ''), 'Avaliador')
    into v_is_admin, v_actor_name
  from public.perfis
  where id = p_user_id;

  if not found
     or (not v_is_admin and v_step.assigned_user_id is distinct from p_user_id) then
    raise exception using
      errcode = 'P0001',
      message = 'Somente o responsável da Etapa 2 — TI ou um administrador pode decidir.',
      detail = 'NAO_AUTORIZADO';
  end if;

  if exists (
    select 1
    from public.solicitacoes_ti
    where workflow_id = p_workflow_id
      and status = 'aguardando_resposta'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'A Etapa 2 — TI possui comunicação aguardando resposta do solicitante.',
      detail = 'PENDENCIA_SOLICITANTE';
  end if;

  update public.etapas_aprovacao
  set
    status = p_decision,
    comment = nullif(p_comment, ''),
    decided_at = v_now,
    assigned_user_id = coalesce(v_step.assigned_user_id, p_user_id),
    assigned_user_name = coalesce(v_step.assigned_user_name, v_actor_name)
  where id = p_step_id;

  if p_decision = 'aprovado' then
    update public.fluxos_aprovacao
    set
      current_step = 3,
      final_status = 'pendente'
    where id = p_workflow_id
    returning * into v_workflow;
  else
    update public.fluxos_aprovacao
    set
      current_step = 2,
      final_status = 'negado',
      completed_at = v_now
    where id = p_workflow_id
    returning * into v_workflow;
  end if;

  return jsonb_build_object(
    'workflow', to_jsonb(v_workflow),
    'step', (
      select to_jsonb(etapa)
      from public.etapas_aprovacao etapa
      where etapa.id = p_step_id
    )
  );
end;
$$;

revoke execute on function public.criar_conversa_comunicacao_ti(text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.criar_conversa_comunicacao_ti(text, uuid, text, text)
  to service_role;

revoke execute on function public.enviar_mensagem_comunicacao_ti(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.enviar_mensagem_comunicacao_ti(uuid, uuid, text)
  to service_role;

revoke execute on function public.encerrar_conversa_comunicacao_ti(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.encerrar_conversa_comunicacao_ti(uuid, uuid)
  to service_role;

revoke execute on function public.decidir_etapa_ti_comunicacao_segura(uuid, uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.decidir_etapa_ti_comunicacao_segura(uuid, uuid, uuid, text, text, text)
  to service_role;

commit;
