-- Cedro IA — blocos estruturados de perguntas da Etapa 2 (TI)
-- Migration aditiva: cria somente RPCs. Não altera tabelas nem converte dados.
-- Revise e execute manualmente no SQL Editor do Supabase.
--
-- Representação:
--   • cada bloco é uma nova rodada em solicitacoes_ti;
--   • seus itens existem somente em perguntas_ti;
--   • mensagens_ti continua exclusivo do chat simples já existente;
--   • legado permanece identificado por current_turn IS NULL.

begin;

-- PRE-CHECK: aborta se já existirem rodadas misturando perguntas estruturadas
-- e mensagens de chat. Não apaga, atualiza nem converte registros.
do $$
begin
  if exists (
    select 1
    from public.solicitacoes_ti solicitacao
    where exists (
      select 1
      from public.perguntas_ti pergunta
      where pergunta.request_id = solicitacao.id
    )
      and exists (
        select 1
        from public.mensagens_ti mensagem
        where mensagem.request_id = solicitacao.id
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Existem rodadas TI contendo simultaneamente perguntas estruturadas e mensagens de chat.',
      detail = 'DADOS_TI_MODO_MISTO';
  end if;
end;
$$;

create or replace function public.criar_bloco_perguntas_ti(
  p_ia_record_id text,
  p_user_id uuid,
  p_user_name text,
  p_questions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_workflow public.fluxos_aprovacao%rowtype;
  v_step public.etapas_aprovacao%rowtype;
  v_open_request public.solicitacoes_ti%rowtype;
  v_request public.solicitacoes_ti%rowtype;
  v_requester_id uuid;
  v_round_number integer;
  v_is_admin boolean;
  v_requested_by_name text;
  v_now timestamp with time zone := now();
begin
  if p_questions is null
     or jsonb_typeof(p_questions) <> 'array'
     or jsonb_array_length(p_questions) not between 1 and 10 then
    raise exception using
      errcode = 'P0001',
      message = 'O bloco deve conter entre 1 e 10 perguntas.',
      detail = 'QUANTIDADE_PERGUNTAS_INVALIDA';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_questions) pergunta(valor)
    where jsonb_typeof(pergunta.valor) <> 'string'
       or char_length(pergunta.valor #>> '{}') not between 1 and 1000
       or btrim(pergunta.valor #>> '{}') = ''
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Cada pergunta deve ter entre 1 e 1000 caracteres.',
      detail = 'PERGUNTA_INVALIDA';
  end if;

  -- Descobre o workflow sem lock para manter a mesma ordem de locks das RPCs
  -- existentes: solicitação aberta -> workflow.
  select *
    into v_workflow
  from public.fluxos_aprovacao
  where ia_record_id = p_ia_record_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Workflow de aprovação não encontrado.',
      detail = 'WORKFLOW_INVALIDO';
  end if;

  select *
    into v_open_request
  from public.solicitacoes_ti
  where workflow_id = v_workflow.id
    and closed_at is null
    and (
      current_turn is not null
      or status = 'aguardando_resposta'
    )
  for update;

  select *
    into v_workflow
  from public.fluxos_aprovacao
  where id = v_workflow.id
  for update;

  if not found
     or v_workflow.final_status <> 'pendente'
     or v_workflow.current_step <> 2 then
    raise exception using
      errcode = 'P0001',
      message = 'O workflow deve estar pendente na Etapa 2 — TI.',
      detail = 'WORKFLOW_INVALIDO';
  end if;

  -- Reconsulta após o lock do workflow para cobrir criação concorrente quando
  -- ainda não havia solicitação aberta na primeira leitura.
  select *
    into v_open_request
  from public.solicitacoes_ti
  where workflow_id = v_workflow.id
    and closed_at is null
    and (
      current_turn is not null
      or status = 'aguardando_resposta'
    )
  for update;

  if found then
    if v_open_request.current_turn is null then
      raise exception using
        errcode = 'P0001',
        message = 'Existe uma rodada legada aguardando o solicitante.',
        detail = 'MODO_LEGADO';
    end if;

    if v_open_request.current_turn <> 'ti' then
      raise exception using
        errcode = 'P0001',
        message = 'Um novo bloco só pode ser criado no turno da TI.',
        detail = 'TURNO_INVALIDO';
    end if;
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

  if not found
     or (not v_is_admin and v_step.assigned_user_id is distinct from p_user_id) then
    raise exception using
      errcode = 'P0001',
      message = 'Somente o responsável da Etapa 2 — TI ou um administrador pode criar o bloco.',
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

  -- A rodada anterior permanece imutável no histórico. Fechá-la libera o
  -- índice único parcial para a nova rodada dentro da mesma transação.
  if v_open_request.id is not null then
    update public.solicitacoes_ti
    set closed_at = v_now
    where id = v_open_request.id;
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

  insert into public.perguntas_ti (
    request_id,
    order_number,
    question,
    answer
  )
  select
    v_request.id,
    pergunta.ordem::integer,
    btrim(pergunta.valor #>> '{}'),
    null
  from jsonb_array_elements(p_questions) with ordinality
    as pergunta(valor, ordem);

  return jsonb_build_object(
    'request', to_jsonb(v_request),
    'questions', (
      select coalesce(
        jsonb_agg(to_jsonb(pergunta) order by pergunta.order_number),
        '[]'::jsonb
      )
      from public.perguntas_ti pergunta
      where pergunta.request_id = v_request.id
    )
  );
end;
$$;

create or replace function public.salvar_resposta_bloco_ti(
  p_request_id uuid,
  p_question_id uuid,
  p_user_id uuid,
  p_answer text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_request public.solicitacoes_ti%rowtype;
  v_workflow public.fluxos_aprovacao%rowtype;
  v_question public.perguntas_ti%rowtype;
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
      message = 'Bloco de perguntas não encontrado.',
      detail = 'BLOCO_NAO_ENCONTRADO';
  end if;

  if v_request.current_turn is null then
    raise exception using
      errcode = 'P0001',
      message = 'Esta rodada utiliza o fluxo legado.',
      detail = 'MODO_LEGADO';
  end if;

  if exists (
    select 1
    from public.mensagens_ti
    where request_id = p_request_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Esta rodada utiliza o chat simples.',
      detail = 'MODO_CHAT_SIMPLES';
  end if;

  if v_request.closed_at is not null then
    raise exception using
      errcode = 'P0001',
      message = 'Este bloco já foi encerrado.',
      detail = 'CONVERSA_ENCERRADA';
  end if;

  if v_request.requester_id is distinct from p_user_id then
    raise exception using
      errcode = 'P0001',
      message = 'Somente o solicitante deste bloco pode responder.',
      detail = 'NAO_AUTORIZADO';
  end if;

  if v_request.current_turn <> 'solicitante' then
    raise exception using
      errcode = 'P0001',
      message = 'As respostas deste bloco não podem mais ser editadas.',
      detail = 'RESPOSTAS_IMUTAVEIS';
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

  if p_answer is null
     or char_length(p_answer) not between 1 and 1000
     or btrim(p_answer) = '' then
    raise exception using
      errcode = 'P0001',
      message = 'A resposta deve ter entre 1 e 1000 caracteres.',
      detail = 'RESPOSTA_INVALIDA';
  end if;

  select *
    into v_question
  from public.perguntas_ti
  where id = p_question_id
    and request_id = p_request_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'A pergunta não pertence a este bloco.',
      detail = 'PERGUNTA_NAO_ENCONTRADA';
  end if;

  update public.perguntas_ti
  set
    answer = p_answer,
    updated_at = v_now
  where id = p_question_id
    and request_id = p_request_id
  returning * into v_question;

  return jsonb_build_object(
    'request', to_jsonb(v_request),
    'question', to_jsonb(v_question)
  );
end;
$$;

create or replace function public.finalizar_respostas_bloco_ti(
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
  v_question_count integer;
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
      message = 'Bloco de perguntas não encontrado.',
      detail = 'BLOCO_NAO_ENCONTRADO';
  end if;

  if v_request.current_turn is null then
    raise exception using
      errcode = 'P0001',
      message = 'Esta rodada utiliza o fluxo legado.',
      detail = 'MODO_LEGADO';
  end if;

  if exists (
    select 1
    from public.mensagens_ti
    where request_id = p_request_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Esta rodada utiliza o chat simples.',
      detail = 'MODO_CHAT_SIMPLES';
  end if;

  if v_request.closed_at is not null then
    raise exception using
      errcode = 'P0001',
      message = 'Este bloco já foi encerrado.',
      detail = 'CONVERSA_ENCERRADA';
  end if;

  if v_request.requester_id is distinct from p_user_id then
    raise exception using
      errcode = 'P0001',
      message = 'Somente o solicitante deste bloco pode enviar as respostas.',
      detail = 'NAO_AUTORIZADO';
  end if;

  if v_request.current_turn <> 'solicitante' then
    raise exception using
      errcode = 'P0001',
      message = 'Este bloco já foi enviado para a TI.',
      detail = 'RESPOSTAS_IMUTAVEIS';
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

  -- Bloqueia todos os itens para impedir salvamento concorrente durante o envio.
  perform id
  from public.perguntas_ti
  where request_id = p_request_id
  for update;

  select count(*)
    into v_question_count
  from public.perguntas_ti
  where request_id = p_request_id;

  if v_question_count not between 1 and 10 then
    raise exception using
      errcode = 'P0001',
      message = 'O bloco deve conter entre 1 e 10 perguntas.',
      detail = 'BLOCO_INVALIDO';
  end if;

  if exists (
    select 1
    from public.perguntas_ti
    where request_id = p_request_id
      and (
        answer is null
        or btrim(answer) = ''
        or char_length(answer) > 1000
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Todas as perguntas devem ser respondidas antes do envio.',
      detail = 'BLOCO_INCOMPLETO';
  end if;

  update public.perguntas_ti
  set
    answered_at = v_now,
    updated_at = v_now
  where request_id = p_request_id;

  update public.solicitacoes_ti
  set
    current_turn = 'ti',
    status = 'respondida',
    responded_at = v_now
  where id = p_request_id
  returning * into v_request;

  return jsonb_build_object(
    'request', to_jsonb(v_request),
    'questions', (
      select coalesce(
        jsonb_agg(to_jsonb(pergunta) order by pergunta.order_number),
        '[]'::jsonb
      )
      from public.perguntas_ti pergunta
      where pergunta.request_id = p_request_id
    )
  );
end;
$$;

revoke execute on function public.criar_bloco_perguntas_ti(text, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.criar_bloco_perguntas_ti(text, uuid, text, jsonb)
  to service_role;

revoke execute on function public.salvar_resposta_bloco_ti(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.salvar_resposta_bloco_ti(uuid, uuid, uuid, text)
  to service_role;

revoke execute on function public.finalizar_respostas_bloco_ti(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.finalizar_respostas_bloco_ti(uuid, uuid)
  to service_role;

-- Redefine o chat simples para recusar rodadas já estruturadas em perguntas_ti.
-- Comportamento original preservado; o guard é a única mudança funcional.
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

  if exists (
    select 1
    from public.perguntas_ti
    where request_id = p_request_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Esta rodada utiliza um bloco estruturado de perguntas.',
      detail = 'MODO_BLOCO_PERGUNTAS';
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

revoke execute on function public.enviar_mensagem_comunicacao_ti(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.enviar_mensagem_comunicacao_ti(uuid, uuid, text)
  to service_role;

commit;
