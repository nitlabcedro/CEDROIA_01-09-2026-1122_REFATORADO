-- =============================================================================
-- CEDRO IA — Reparo MANUAL de dados legados (negativa terminal inconsistente)
-- =============================================================================
--
-- Contexto: etapa 1–4 com status 'negado', mas fluxo/registro ainda “ativos”.
--
-- Regras deste script:
--   • Considera negativa TERMINAL somente etapas 1–4 com status = 'negado'
--     (etapa 5 / is_opinion_only NÃO entra no critério — alinhado ao backend).
--   • NÃO altera schema, triggers, etapas, pareceres, histórico ou DELETE.
--   • Idempotente: reexecutar após reparo não deve alterar linhas já corretas.
--   • Execute no SQL Editor do Supabase. Revise a auditoria antes do COMMIT.
--
-- Relacionamentos confirmados no projeto:
--   public.fluxos_aprovacao.ia_record_id  → public.registros_ia.id (text)
--   public.etapas_aprovacao.workflow_id   → public.fluxos_aprovacao.id (uuid)
--   public.etapas_aprovacao.ia_record_id  → public.registros_ia.id (redundante)
--
-- Valores usados pelo aplicativo (backend decidirWorkflow / status-solicitacao):
--   fluxos_aprovacao.final_status : 'pendente' | 'aprovado' | 'negado' | 'cancelado'
--   etapas_aprovacao.status       : 'aguardando' | 'aprovado' | 'negado' | 'opiniao'
--   registros_ia.status           : 'Negado' | 'Aprovado' | 'Pendente' (auditoria)
--   registros_ia.status_uso       : 'Não aprovado' | 'Em avaliação' | ...
--   registros_ia.data (JSON)      : statusAuditoria, statusUso (camelCase)
--
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- PRÉ-CHECK (somente leitura) — confirme nomes de colunas no seu projeto
-- -----------------------------------------------------------------------------
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name IN ('registros_ia', 'fluxos_aprovacao', 'etapas_aprovacao')
-- ORDER BY table_name, ordinal_position;


-- =============================================================================
-- PARTE 1 — AUDITORIA (nenhuma alteração)
-- =============================================================================

-- 1.1) Inconsistências elegíveis para reparo AUTOMÁTICO (restritivo)
WITH negacao_terminal AS (
  SELECT
    e.workflow_id,
    MIN(e.step_number) FILTER (WHERE lower(trim(coalesce(e.status, ''))) = 'negado') AS etapa_negada,
    MAX(e.decided_at) FILTER (
      WHERE lower(trim(coalesce(e.status, ''))) = 'negado'
        AND e.step_number BETWEEN 1 AND 4
    ) AS decided_at_negacao
  FROM public.etapas_aprovacao AS e
  WHERE e.step_number BETWEEN 1 AND 4
    AND lower(trim(coalesce(e.status, ''))) = 'negado'
  GROUP BY e.workflow_id
),
alvos_reparo AS (
  SELECT
    w.id                    AS workflow_id,
    w.ia_record_id,
    nt.etapa_negada,
    nt.decided_at_negacao,
    w.current_step,
    w.final_status,
    w.completed_at,
    ri.status               AS registro_status,
    ri.status_uso           AS registro_status_uso,
    ri.data                 AS registro_data
  FROM negacao_terminal AS nt
  INNER JOIN public.fluxos_aprovacao AS w
    ON w.id = nt.workflow_id
  INNER JOIN public.registros_ia AS ri
    ON ri.id = w.ia_record_id
  WHERE
    -- Fluxo ainda não encerrado como negado OU completed_at ausente
    (
      lower(trim(coalesce(w.final_status, ''))) IS DISTINCT FROM 'negado'
      OR w.completed_at IS NULL
    )
    OR
    -- Registro ainda não reflete negativa terminal
    (
      trim(coalesce(ri.status, '')) IS DISTINCT FROM 'Negado'
      OR trim(coalesce(ri.status_uso, '')) IS DISTINCT FROM 'Não aprovado'
    )
    -- Exclui estados finais contraditórios → decisão manual
    AND lower(trim(coalesce(w.final_status, ''))) NOT IN ('aprovado', 'cancelado')
)
SELECT
  ia_record_id            AS id_ia,
  workflow_id,
  etapa_negada            AS etapa_negada,
  'negado'                AS status_etapa,
  final_status            AS final_status_atual,
  completed_at            AS completed_at_atual,
  registro_status         AS registros_ia_status_atual,
  registro_status_uso     AS registros_ia_status_uso_atual,
  registro_data ->> 'statusAuditoria' AS data_status_auditoria,
  registro_data ->> 'statusUso'       AS data_status_uso,
  current_step
FROM alvos_reparo
ORDER BY ia_record_id, workflow_id;


-- 1.2) Quantidade potencial de reparo (mesmos critérios da 1.1)
WITH negacao_terminal AS (
  SELECT e.workflow_id
  FROM public.etapas_aprovacao AS e
  WHERE e.step_number BETWEEN 1 AND 4
    AND lower(trim(coalesce(e.status, ''))) = 'negado'
  GROUP BY e.workflow_id
),
alvos_reparo AS (
  SELECT w.id, w.ia_record_id
  FROM negacao_terminal AS nt
  INNER JOIN public.fluxos_aprovacao AS w ON w.id = nt.workflow_id
  INNER JOIN public.registros_ia AS ri ON ri.id = w.ia_record_id
  WHERE (
      lower(trim(coalesce(w.final_status, ''))) IS DISTINCT FROM 'negado'
      OR w.completed_at IS NULL
      OR trim(coalesce(ri.status, '')) IS DISTINCT FROM 'Negado'
      OR trim(coalesce(ri.status_uso, '')) IS DISTINCT FROM 'Não aprovado'
    )
    AND lower(trim(coalesce(w.final_status, ''))) NOT IN ('aprovado', 'cancelado')
)
SELECT
  count(DISTINCT ia_record_id) AS ias_distintas,
  count(*)                     AS workflows_alvo
FROM alvos_reparo;


-- 1.3) Casos AMBÍGUOS — NÃO entram no UPDATE automático (revisão manual)
WITH negacao_terminal AS (
  SELECT
    e.workflow_id,
    MIN(e.step_number) AS etapa_negada
  FROM public.etapas_aprovacao AS e
  WHERE e.step_number BETWEEN 1 AND 4
    AND lower(trim(coalesce(e.status, ''))) = 'negado'
  GROUP BY e.workflow_id
)
SELECT
  w.ia_record_id,
  w.id AS workflow_id,
  nt.etapa_negada,
  w.final_status,
  w.completed_at,
  ri.status,
  ri.status_uso,
  CASE
    WHEN lower(trim(coalesce(w.final_status, ''))) = 'aprovado'
      THEN 'CONFLITO: etapa 1–4 negada mas final_status=aprovado'
    WHEN lower(trim(coalesce(w.final_status, ''))) = 'cancelado'
      THEN 'CONFLITO: etapa 1–4 negada mas final_status=cancelado'
    ELSE 'OUTRO'
  END AS motivo_revisao
FROM negacao_terminal AS nt
INNER JOIN public.fluxos_aprovacao AS w ON w.id = nt.workflow_id
INNER JOIN public.registros_ia AS ri ON ri.id = w.ia_record_id
WHERE lower(trim(coalesce(w.final_status, ''))) IN ('aprovado', 'cancelado')
ORDER BY w.ia_record_id;


-- 1.4) Etapa 5 negada (somente opinião) — informativo, fora do reparo
SELECT
  w.ia_record_id,
  w.id AS workflow_id,
  e.step_number,
  e.status,
  e.is_opinion_only,
  w.final_status
FROM public.etapas_aprovacao AS e
INNER JOIN public.fluxos_aprovacao AS w ON w.id = e.workflow_id
WHERE e.step_number = 5
  AND lower(trim(coalesce(e.status, ''))) = 'negado'
ORDER BY w.ia_record_id;


-- =============================================================================
-- PARTE 2 — REPARO (somente alvos da auditoria 1.1 / 1.2)
-- =============================================================================

WITH negacao_terminal AS (
  SELECT
    e.workflow_id,
    MAX(e.decided_at) FILTER (
      WHERE lower(trim(coalesce(e.status, ''))) = 'negado'
        AND e.step_number BETWEEN 1 AND 4
    ) AS decided_at_negacao
  FROM public.etapas_aprovacao AS e
  WHERE e.step_number BETWEEN 1 AND 4
    AND lower(trim(coalesce(e.status, ''))) = 'negado'
  GROUP BY e.workflow_id
),
alvos_reparo AS (
  SELECT
    w.id AS workflow_id,
    w.ia_record_id,
    nt.decided_at_negacao
  FROM negacao_terminal AS nt
  INNER JOIN public.fluxos_aprovacao AS w ON w.id = nt.workflow_id
  INNER JOIN public.registros_ia AS ri ON ri.id = w.ia_record_id
  WHERE (
      lower(trim(coalesce(w.final_status, ''))) IS DISTINCT FROM 'negado'
      OR w.completed_at IS NULL
      OR trim(coalesce(ri.status, '')) IS DISTINCT FROM 'Negado'
      OR trim(coalesce(ri.status_uso, '')) IS DISTINCT FROM 'Não aprovado'
    )
    AND lower(trim(coalesce(w.final_status, ''))) NOT IN ('aprovado', 'cancelado')
),
fluxos_atualizados AS (
  UPDATE public.fluxos_aprovacao AS w
  SET
    final_status = 'negado',
    completed_at = COALESCE(
      w.completed_at,
      ar.decided_at_negacao,
      now()
    )
  FROM alvos_reparo AS ar
  WHERE w.id = ar.workflow_id
    AND (
      lower(trim(coalesce(w.final_status, ''))) IS DISTINCT FROM 'negado'
      OR w.completed_at IS NULL
    )
  RETURNING w.id, w.ia_record_id, w.final_status, w.completed_at
)
SELECT 'fluxos_atualizados' AS etapa, count(*) AS linhas
FROM fluxos_atualizados;

-- Registros IA: colunas + merge parcial do JSON (preserva demais chaves)
WITH negacao_terminal AS (
  SELECT e.workflow_id
  FROM public.etapas_aprovacao AS e
  WHERE e.step_number BETWEEN 1 AND 4
    AND lower(trim(coalesce(e.status, ''))) = 'negado'
  GROUP BY e.workflow_id
),
alvos_reparo AS (
  SELECT w.ia_record_id
  FROM negacao_terminal AS nt
  INNER JOIN public.fluxos_aprovacao AS w ON w.id = nt.workflow_id
  INNER JOIN public.registros_ia AS ri ON ri.id = w.ia_record_id
  WHERE (
      lower(trim(coalesce(w.final_status, ''))) IS DISTINCT FROM 'negado'
      OR w.completed_at IS NULL
      OR trim(coalesce(ri.status, '')) IS DISTINCT FROM 'Negado'
      OR trim(coalesce(ri.status_uso, '')) IS DISTINCT FROM 'Não aprovado'
    )
    AND lower(trim(coalesce(w.final_status, ''))) NOT IN ('aprovado', 'cancelado')
),
registros_atualizados AS (
  UPDATE public.registros_ia AS ri
  SET
    status = 'Negado',
    status_uso = 'Não aprovado',
    updated_at = now(),
    data = (
      COALESCE(
        CASE
          WHEN ri.data IS NULL THEN '{}'::jsonb
          ELSE ri.data::jsonb
        END,
        '{}'::jsonb
      ) || jsonb_build_object(
        'statusAuditoria', 'Negado',
        'statusUso', 'Não aprovado'
      )
    )
  FROM alvos_reparo AS ar
  WHERE ri.id = ar.ia_record_id
    AND (
      trim(coalesce(ri.status, '')) IS DISTINCT FROM 'Negado'
      OR trim(coalesce(ri.status_uso, '')) IS DISTINCT FROM 'Não aprovado'
      OR COALESCE(ri.data::jsonb ->> 'statusAuditoria', '') IS DISTINCT FROM 'Negado'
      OR COALESCE(ri.data::jsonb ->> 'statusUso', '') IS DISTINCT FROM 'Não aprovado'
    )
  RETURNING ri.id, ri.status, ri.status_uso
)
SELECT 'registros_atualizados' AS etapa, count(*) AS linhas
FROM registros_atualizados;


-- =============================================================================
-- PARTE 3 — VALIDAÇÃO PÓS-UPDATE
-- =============================================================================

-- 3.1) Alvos reparados devem estar coerentes
WITH negacao_terminal AS (
  SELECT
    e.workflow_id,
    MIN(e.step_number) FILTER (WHERE lower(trim(coalesce(e.status, ''))) = 'negado') AS etapa_negada
  FROM public.etapas_aprovacao AS e
  WHERE e.step_number BETWEEN 1 AND 4
    AND lower(trim(coalesce(e.status, ''))) = 'negado'
  GROUP BY e.workflow_id
)
SELECT
  w.ia_record_id,
  w.id AS workflow_id,
  nt.etapa_negada,
  e.status AS status_etapa_negada,
  w.final_status,
  w.completed_at,
  ri.status,
  ri.status_uso,
  ri.data ->> 'statusAuditoria' AS data_status_auditoria,
  ri.data ->> 'statusUso' AS data_status_uso
FROM negacao_terminal AS nt
INNER JOIN public.fluxos_aprovacao AS w ON w.id = nt.workflow_id
INNER JOIN public.registros_ia AS ri ON ri.id = w.ia_record_id
INNER JOIN public.etapas_aprovacao AS e
  ON e.workflow_id = w.id AND e.step_number = nt.etapa_negada
WHERE lower(trim(coalesce(w.final_status, ''))) NOT IN ('aprovado', 'cancelado')
ORDER BY w.ia_record_id;


-- 3.2) Deve retornar ZERO linhas após reparo bem-sucedido
WITH negacao_terminal AS (
  SELECT e.workflow_id
  FROM public.etapas_aprovacao AS e
  WHERE e.step_number BETWEEN 1 AND 4
    AND lower(trim(coalesce(e.status, ''))) = 'negado'
  GROUP BY e.workflow_id
)
SELECT
  w.ia_record_id,
  w.id AS workflow_id,
  w.final_status,
  ri.status,
  ri.status_uso
FROM negacao_terminal AS nt
INNER JOIN public.fluxos_aprovacao AS w ON w.id = nt.workflow_id
INNER JOIN public.registros_ia AS ri ON ri.id = w.ia_record_id
WHERE lower(trim(coalesce(w.final_status, ''))) NOT IN ('aprovado', 'cancelado')
  AND (
    lower(trim(coalesce(w.final_status, ''))) IS DISTINCT FROM 'negado'
    OR w.completed_at IS NULL
    OR trim(coalesce(ri.status, '')) IS DISTINCT FROM 'Negado'
    OR trim(coalesce(ri.status_uso, '')) IS DISTINCT FROM 'Não aprovado'
  );


-- =============================================================================
-- EFETIVAÇÃO
-- =============================================================================
-- Revise os resultados das PARTES 1 e 3. Se estiver correto:
--   COMMIT;
-- Caso contrário (primeira execução / dry-run):
ROLLBACK;
