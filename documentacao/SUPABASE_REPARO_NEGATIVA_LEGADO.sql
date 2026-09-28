-- =============================================================================
-- CEDRO IA — Reparo CIRÚRGICO (UMA IA) — negativa legado inconsistente
-- =============================================================================
--
-- Repara SOMENTE o ia_record_id informado abaixo.
-- Reparo em lote (várias IAs): use SUPABASE_REPARO_NEGATIVA_LEGADO_LOTE.sql
--
-- NÃO altera: etapas_aprovacao, pareceres, responsáveis, histórico, schema,
-- triggers, outras IAs.
--
-- =============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- PARÂMETRO — substitua pelo ID real antes de executar
-- ═══════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS pg_temp.cedro_reparo_ia_alvo;
CREATE TEMP TABLE pg_temp.cedro_reparo_ia_alvo (
  ia_record_id text PRIMARY KEY
);

INSERT INTO pg_temp.cedro_reparo_ia_alvo (ia_record_id)
VALUES ('<ID_DA_IA>');


-- =============================================================================
-- AUDITORIA ANTES (somente leitura)
-- =============================================================================

-- A) Registro + fluxo(s) vinculados à IA alvo
SELECT
  ri.id                    AS registros_ia_id,
  ri.status                AS registros_ia_status,
  ri.status_uso            AS registros_ia_status_uso,
  w.id                     AS fluxo_id,
  w.final_status           AS fluxo_final_status,
  w.completed_at           AS fluxo_completed_at,
  w.current_step           AS fluxo_current_step
FROM pg_temp.cedro_reparo_ia_alvo AS p
LEFT JOIN public.registros_ia AS ri
  ON ri.id = p.ia_record_id
LEFT JOIN public.fluxos_aprovacao AS w
  ON w.ia_record_id = p.ia_record_id
ORDER BY w.id NULLS LAST;


-- B) Etapas 1–5 de cada fluxo da IA alvo
SELECT
  p.ia_record_id,
  w.id                     AS fluxo_id,
  e.step_number            AS etapa,
  e.role_name,
  e.status                 AS status_etapa,
  e.is_opinion_only,
  e.decided_at,
  e.assigned_user_name
FROM pg_temp.cedro_reparo_ia_alvo AS p
INNER JOIN public.fluxos_aprovacao AS w
  ON w.ia_record_id = p.ia_record_id
LEFT JOIN public.etapas_aprovacao AS e
  ON e.workflow_id = w.id
  AND e.step_number BETWEEN 1 AND 5
ORDER BY w.id, e.step_number;


-- C) Campos de status no JSON data (se existirem)
SELECT
  ri.id,
  ri.data ->> 'statusAuditoria' AS data_status_auditoria,
  ri.data ->> 'statusUso'       AS data_status_uso,
  (ri.data ? 'statusAuditoria') AS possui_chave_status_auditoria,
  (ri.data ? 'statusUso')       AS possui_chave_status_uso
FROM pg_temp.cedro_reparo_ia_alvo AS p
INNER JOIN public.registros_ia AS ri
  ON ri.id = p.ia_record_id;


-- D) Elegibilidade para reparo (deve retornar 1 linha com elegivel = true)
WITH alvo AS (
  SELECT ia_record_id FROM pg_temp.cedro_reparo_ia_alvo
),
fluxos AS (
  SELECT w.*
  FROM public.fluxos_aprovacao AS w
  INNER JOIN alvo AS a ON a.ia_record_id = w.ia_record_id
),
tem_negacao_1_a_4 AS (
  SELECT EXISTS (
    SELECT 1
    FROM public.etapas_aprovacao AS e
    INNER JOIN fluxos AS f ON f.id = e.workflow_id
    WHERE e.step_number BETWEEN 1 AND 4
      AND lower(trim(coalesce(e.status, ''))) = 'negado'
  ) AS ok
),
status_fluxo AS (
  SELECT
    bool_and(
      lower(trim(coalesce(f.final_status, ''))) NOT IN ('aprovado', 'cancelado')
    ) AS ok
  FROM fluxos AS f
)
SELECT
  a.ia_record_id,
  (SELECT count(*) FROM public.registros_ia ri WHERE ri.id = a.ia_record_id) AS registro_existe,
  (SELECT count(*) FROM fluxos) AS fluxos_vinculados,
  (SELECT ok FROM tem_negacao_1_a_4) AS tem_etapa_1_a_4_negada,
  coalesce((SELECT ok FROM status_fluxo), false) AS final_status_permite_reparo,
  (
    (SELECT count(*) FROM public.registros_ia ri WHERE ri.id = a.ia_record_id) = 1
    AND (SELECT ok FROM tem_negacao_1_a_4)
    AND coalesce((SELECT ok FROM status_fluxo), false)
  ) AS elegivel_reparo
FROM alvo AS a;


-- =============================================================================
-- REPARO (somente se elegível — updates restritos ao ia_record_id)
-- =============================================================================

-- 1) fluxos_aprovacao
WITH alvo AS (
  SELECT ia_record_id FROM pg_temp.cedro_reparo_ia_alvo
),
elegivel AS (
  SELECT a.ia_record_id
  FROM alvo AS a
  INNER JOIN public.registros_ia AS ri ON ri.id = a.ia_record_id
  WHERE EXISTS (
    SELECT 1
    FROM public.fluxos_aprovacao AS w
    INNER JOIN public.etapas_aprovacao AS e ON e.workflow_id = w.id
    WHERE w.ia_record_id = a.ia_record_id
      AND e.step_number BETWEEN 1 AND 4
      AND lower(trim(coalesce(e.status, ''))) = 'negado'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.fluxos_aprovacao AS w
    WHERE w.ia_record_id = a.ia_record_id
      AND lower(trim(coalesce(w.final_status, ''))) IN ('aprovado', 'cancelado')
  )
),
fluxos_atualizados AS (
  UPDATE public.fluxos_aprovacao AS w
  SET
    final_status = 'negado',
    completed_at = COALESCE(w.completed_at, now())
  FROM elegivel AS e
  WHERE w.ia_record_id = e.ia_record_id
    AND (
      lower(trim(coalesce(w.final_status, ''))) IS DISTINCT FROM 'negado'
      OR w.completed_at IS NULL
    )
  RETURNING w.id, w.ia_record_id, w.final_status, w.completed_at
)
SELECT 'fluxos_atualizados' AS operacao, count(*) AS linhas
FROM fluxos_atualizados;


-- 2) registros_ia (colunas + JSON apenas se chaves já existirem)
WITH alvo AS (
  SELECT ia_record_id FROM pg_temp.cedro_reparo_ia_alvo
),
elegivel AS (
  SELECT a.ia_record_id
  FROM alvo AS a
  INNER JOIN public.registros_ia AS ri ON ri.id = a.ia_record_id
  WHERE EXISTS (
    SELECT 1
    FROM public.fluxos_aprovacao AS w
    INNER JOIN public.etapas_aprovacao AS e ON e.workflow_id = w.id
    WHERE w.ia_record_id = a.ia_record_id
      AND e.step_number BETWEEN 1 AND 4
      AND lower(trim(coalesce(e.status, ''))) = 'negado'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.fluxos_aprovacao AS w
    WHERE w.ia_record_id = a.ia_record_id
      AND lower(trim(coalesce(w.final_status, ''))) IN ('aprovado', 'cancelado')
  )
),
registros_atualizados AS (
  UPDATE public.registros_ia AS ri
  SET
    status = 'Negado',
    status_uso = 'Não aprovado',
    updated_at = now(),
    data = CASE
      WHEN ri.data IS NULL THEN NULL
      ELSE (
        SELECT
          CASE
            WHEN (base.d ? 'statusUso') THEN
              jsonb_set(
                CASE
                  WHEN (base.d ? 'statusAuditoria') THEN
                    jsonb_set(base.d, '{statusAuditoria}', to_jsonb('Negado'::text), false)
                  ELSE base.d
                END,
                '{statusUso}',
                to_jsonb('Não aprovado'::text),
                false
              )
            WHEN (base.d ? 'statusAuditoria') THEN
              jsonb_set(base.d, '{statusAuditoria}', to_jsonb('Negado'::text), false)
            ELSE base.d
          END
        FROM (SELECT ri.data::jsonb AS d) AS base
      )
    END
  FROM elegivel AS e
  WHERE ri.id = e.ia_record_id
  RETURNING ri.id, ri.status, ri.status_uso
)
SELECT 'registros_atualizados' AS operacao, count(*) AS linhas
FROM registros_atualizados;


-- =============================================================================
-- AUDITORIA DEPOIS + VALIDAÇÃO FINAL
-- =============================================================================

-- Registro + fluxo após reparo
SELECT
  ri.id                    AS registros_ia_id,
  ri.status                AS registros_ia_status,
  ri.status_uso            AS registros_ia_status_uso,
  w.id                     AS fluxo_id,
  w.final_status           AS fluxo_final_status,
  w.completed_at           AS fluxo_completed_at
FROM pg_temp.cedro_reparo_ia_alvo AS p
LEFT JOIN public.registros_ia AS ri ON ri.id = p.ia_record_id
LEFT JOIN public.fluxos_aprovacao AS w ON w.ia_record_id = p.ia_record_id
ORDER BY w.id NULLS LAST;


-- Etapas 1–5 (etapa que negou deve permanecer 'negado')
SELECT
  p.ia_record_id,
  w.id AS fluxo_id,
  e.step_number AS etapa,
  e.status AS status_etapa
FROM pg_temp.cedro_reparo_ia_alvo AS p
INNER JOIN public.fluxos_aprovacao AS w ON w.ia_record_id = p.ia_record_id
LEFT JOIN public.etapas_aprovacao AS e
  ON e.workflow_id = w.id AND e.step_number BETWEEN 1 AND 5
ORDER BY w.id, e.step_number;


-- Validação: 1 linha OK por fluxo elegível, ou aviso se não elegível
WITH alvo AS (
  SELECT ia_record_id FROM pg_temp.cedro_reparo_ia_alvo
),
negacao AS (
  SELECT
    w.id AS workflow_id,
    w.ia_record_id,
    MIN(e.step_number) AS etapa_negada
  FROM alvo AS a
  INNER JOIN public.fluxos_aprovacao AS w ON w.ia_record_id = a.ia_record_id
  INNER JOIN public.etapas_aprovacao AS e ON e.workflow_id = w.id
  WHERE e.step_number BETWEEN 1 AND 4
    AND lower(trim(coalesce(e.status, ''))) = 'negado'
  GROUP BY w.id, w.ia_record_id
)
SELECT
  n.ia_record_id,
  n.workflow_id,
  n.etapa_negada,
  e.status AS status_etapa_que_negou,
  w.final_status,
  w.completed_at IS NOT NULL AS completed_at_preenchido,
  ri.status AS registro_status,
  ri.status_uso AS registro_status_uso,
  (
    lower(trim(coalesce(e.status, ''))) = 'negado'
    AND lower(trim(coalesce(w.final_status, ''))) = 'negado'
    AND trim(coalesce(ri.status, '')) = 'Negado'
    AND trim(coalesce(ri.status_uso, '')) = 'Não aprovado'
  ) AS validacao_ok
FROM negacao AS n
INNER JOIN public.fluxos_aprovacao AS w ON w.id = n.workflow_id
INNER JOIN public.registros_ia AS ri ON ri.id = n.ia_record_id
INNER JOIN public.etapas_aprovacao AS e
  ON e.workflow_id = n.workflow_id AND e.step_number = n.etapa_negada;


-- Deve retornar ZERO linhas se reparo foi aplicado e validação passou
WITH alvo AS (
  SELECT ia_record_id FROM pg_temp.cedro_reparo_ia_alvo
)
SELECT
  a.ia_record_id,
  w.id AS workflow_id,
  'INCONSISTENCIA_RESIDUAL' AS motivo
FROM alvo AS a
INNER JOIN public.fluxos_aprovacao AS w ON w.ia_record_id = a.ia_record_id
INNER JOIN public.registros_ia AS ri ON ri.id = a.ia_record_id
WHERE EXISTS (
    SELECT 1
    FROM public.etapas_aprovacao AS e
    WHERE e.workflow_id = w.id
      AND e.step_number BETWEEN 1 AND 4
      AND lower(trim(coalesce(e.status, ''))) = 'negado'
  )
  AND lower(trim(coalesce(w.final_status, ''))) NOT IN ('aprovado', 'cancelado')
  AND (
    lower(trim(coalesce(w.final_status, ''))) IS DISTINCT FROM 'negado'
    OR w.completed_at IS NULL
    OR trim(coalesce(ri.status, '')) IS DISTINCT FROM 'Negado'
    OR trim(coalesce(ri.status_uso, '')) IS DISTINCT FROM 'Não aprovado'
  );


-- =============================================================================
-- EFETIVAÇÃO
-- =============================================================================
-- Revise auditoria ANTES/DEPOIS e validacao_ok = true.
-- Se estiver correto, substitua ROLLBACK por:
-- COMMIT;

ROLLBACK;
