-- Cedro IA — reparo opcional para workflows ativos já afetados pelo bug antigo.
-- Execute UMA VEZ no SQL Editor do Supabase somente se quiser corrigir imediatamente
-- os registros antigos que já avançaram de etapa mas ficaram marcados como aguardando.

update public.approval_steps as s
set status = 'aprovado'
from public.approval_workflows as w
where s.workflow_id = w.id
  and w.final_status = 'pendente'
  and s.step_number < w.current_step
  and lower(coalesce(s.status, '')) not in ('aprovado', 'opiniao', 'negado');
