# Segurança Cedro IA — Políticas RLS (Row Level Security)

Este guia documenta as políticas de segurança recomendadas para o banco de dados Supabase do Cedro IA. O objetivo é substituir políticas excessivamente permissivas por regras seguras baseadas no perfil, papel (role) e setor de cada usuário.

---

## 1. Ativação do RLS (Row Level Security)

Antes de aplicar as políticas, certifique-se de que o RLS está ativado para as três tabelas principais no **SQL Editor** do Supabase:

```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_records ENABLE ROW LEVEL SECURITY;
```

---

## 2. Tabela `profiles` (Perfis de Usuários)

Os perfis devem ser visíveis para todos os usuários autenticados para fins de listagem no chat e atribuição de etapas do fluxo. Contudo, um usuário só pode atualizar o seu próprio perfil.

```sql
-- 1. Permitir leitura de perfis para usuários autenticados
CREATE POLICY "Leitura de perfis por autenticados" 
ON public.profiles FOR SELECT 
TO authenticated
USING (true);

-- 2. Permitir que o próprio usuário atualize seu perfil
CREATE POLICY "Atualização de perfil própria" 
ON public.profiles FOR UPDATE 
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 3. Permitir inserção automática ou própria
CREATE POLICY "Autocadastro de perfil" 
ON public.profiles FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);
```

---

## 3. Tabela `messages` (Chat Interno)

Mensagens públicas de chat podem ser visualizadas por todos os usuários autentitados. Mensagens privadas só podem ser lidas pelo remetente (`sender_id`) e pelo destinatário (`recipient_id`).

```sql
-- 1. Permitir leitura de mensagens públicas ou privadas pertinentes
CREATE POLICY "Leitura de mensagens permitidas" 
ON public.messages FOR SELECT 
TO authenticated
USING (
  not is_private 
  OR auth.uid() = sender_id 
  OR auth.uid() = recipient_id
);

-- 2. Permitir envio de mensagens (apenas como si mesmo)
CREATE POLICY "Envio de mensagens próprio" 
ON public.messages FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = sender_id);
```

---

## 4. Tabela `ia_records` (Inventário e Governança de IA) — POLÍTICAS SEGURAS

Para substituir as políticas de leitura e gravação totalmente públicas (`Permitir tudo público`), utilize as regras abaixo no **SQL Editor**. 

Estas regras utilizam funções auxiliares para verificar as permissões do usuário em tempo real a partir da tabela `profiles`.

### A. Funções de Apoio (Helper Functions)
Recomenda-se criar estas pequenas funções para otimizar a checagem de regras de RLS, evitando loops ou problemas de performance:

```sql
-- Verificar cargo/role do usuário autenticado atual
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Verificar o setor do usuário autenticado atual
CREATE OR REPLACE FUNCTION public.get_auth_sector()
RETURNS text AS $$
  SELECT setor FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Verificar se o setor informado está entre os setores do usuário (suporta ponto e vírgula ';')
CREATE OR REPLACE FUNCTION public.user_has_sector(user_sectors text, target_sector text)
RETURNS boolean AS $$
BEGIN
  IF user_sectors IS NULL OR target_sector IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN lower(trim(target_sector)) = any(
    SELECT trim(both ' ' from s) 
    FROM unnest(string_to_array(lower(user_sectors), ';')) AS s
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### B. Políticas para `ia_records`

```sql
-- Remover quaisquer políticas permissivas antigas
DROP POLICY IF EXISTS "Permitir leitura pública" ON public.ia_records;
DROP POLICY IF EXISTS "Permitir tudo público" ON public.ia_records;

-- 1. política de LEITURA (SELECT)
-- - Administradores podem ler TODOS os registros.
-- - Moderadores/Avaliadores leem todos ou onde participam (para simplificar, leem do setor ou geral).
-- - Usuários comuns leem apenas registros de seus próprios setores OU que eles mesmos criaram (owner_id).
CREATE POLICY "Visualização segura de registros de IA" 
ON public.ia_records FOR SELECT
TO authenticated
USING (
  public.get_auth_role() = 'admin'
  OR public.get_auth_role() = 'moderator'
  OR owner_id = auth.uid()
  OR public.user_has_sector(public.get_auth_sector(), unidade_setor)
);

-- 2. política de INSERÇÃO (INSERT)
-- - Qualquer usuário autenticado pode registrar uma nova IA para o seu próprio setor.
CREATE POLICY "Inserção de novo registro de IA" 
ON public.ia_records FOR INSERT
TO authenticated
WITH CHECK (
  public.get_auth_role() = 'admin'
  OR owner_id = auth.uid()
);

-- 3. política de ATUALIZAÇÃO (UPDATE)
-- - Administradores podem atualizar qualquer campo.
-- - Moderadores/Avaliadores envolvidos no fluxo podem atualizar para registrar pareceres ou avanço de etapa.
-- - Usuários comuns podem atualizar apenas registros próprios que estejam como "Pendente" (antes da homologação final).
CREATE POLICY "Atualização controlada de IA" 
ON public.ia_records FOR UPDATE
TO authenticated
USING (
  public.get_auth_role() = 'admin'
  OR public.get_auth_role() = 'moderator'
  OR (owner_id = auth.uid() AND status = 'Pendente')
)
WITH CHECK (
  public.get_auth_role() = 'admin'
  OR public.get_auth_role() = 'moderator'
  OR (owner_id = auth.uid() AND status = 'Pendente')
);

-- 4. política de EXCLUSÃO (DELETE)
-- - Apenas Administradores têm permissão para apagar registros de IA.
CREATE POLICY "Exclusão restrita a administradores" 
ON public.ia_records FOR DELETE
TO authenticated
USING (public.get_auth_role() = 'admin');
```

---

## 5. Proteção de Chaves Sensíveis

As chaves do Supabase (`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`) expostas no cliente são seguras por natureza **desde que as políticas de RLS acima estejam ativas**. O RLS é a linha de defesa que impede que um usuário mal-intencionado execute requisições diretas de leitura ou exclusão no banco em nome no anon_key. 

- Nunca use a chave `service_role` (que ignora o RLS) em ambientes cliente/frontend.
- Mantenha sempre a `GEMINI_API_KEY` rodando exclusivamente do lado do servidor (sem prefixo `VITE_` e hospedada em variáveis de ambiente da nuvem/Netlify).

---

## 6. Tabelas de Workflow de Aprovação — POLÍTICAS SEGURAS

As tabelas de workflow regulam o fluxo de aprovação das IAs e também devem ser protegidas adequadamente usando políticas baseadas em funções e propriedade dos registros.

### A. Tabela `approval_config` (Configurações Globais das Etapas)
As configurações devem ser consultadas por qualquer usuário autenticado, mas modificadas apenas por administradores.

```sql
ALTER TABLE public.approval_config ENABLE ROW LEVEL SECURITY;

-- 1. Qualquer usuário autenticado pode ler a configuração de etapas
CREATE POLICY "Leitura de configuração de aprovação por autentitados"
ON public.approval_config FOR SELECT
TO authenticated
USING (true);

-- 2. Apenas administradores podem inserir, atualizar ou excluir configurações
CREATE POLICY "Gerenciamento de configuração exclusivo para administradores"
ON public.approval_config FOR ALL
TO authenticated
USING (public.get_auth_role() = 'admin')
WITH CHECK (public.get_auth_role() = 'admin');
```

### B. Tabela `approval_workflows` (Fluxos de Aprovação Ativos)
Os fluxos podem ser lidos por qualquer pessoa autenticada. Atualizações de status (como aprovar, rejeitar ou cancelar) são permitidas para administradores, moderadores e para o solicitante da IA correspondente.

```sql
ALTER TABLE public.approval_workflows ENABLE ROW LEVEL SECURITY;

-- 1. Leitura por qualquer usuário autenticado
CREATE POLICY "Leitura de fluxos de aprovação por autenticados"
ON public.approval_workflows FOR SELECT
TO authenticated
USING (true);

-- 2. Criação por administradores, moderadores ou pelo criador da IA
CREATE POLICY "Criação de fluxos de aprovação controlada"
ON public.approval_workflows FOR INSERT
TO authenticated
WITH CHECK (
  public.get_auth_role() = 'admin'
  OR public.get_auth_role() = 'moderator'
  OR EXISTS (
    SELECT 1 FROM public.ia_records 
    WHERE public.ia_records.id = ia_record_id 
    AND public.ia_records.owner_id = auth.uid()
  )
);

-- 3. Atualização por admins, moderadores ou pelo criador da IA (para cancelamento)
CREATE POLICY "Atualização de fluxos de aprovação controlada"
ON public.approval_workflows FOR UPDATE
TO authenticated
USING (
  public.get_auth_role() = 'admin'
  OR public.get_auth_role() = 'moderator'
  OR EXISTS (
    SELECT 1 FROM public.ia_records 
    WHERE public.ia_records.id = ia_record_id 
    AND public.ia_records.owner_id = auth.uid()
  )
)
WITH CHECK (
  public.get_auth_role() = 'admin'
  OR public.get_auth_role() = 'moderator'
  OR EXISTS (
    SELECT 1 FROM public.ia_records 
    WHERE public.ia_records.id = ia_record_id 
    AND public.ia_records.owner_id = auth.uid()
  )
);

-- 4. Exclusão restrita a administradores
CREATE POLICY "Exclusão de fluxos restrita a admins"
ON public.approval_workflows FOR DELETE
TO authenticated
USING (public.get_auth_role() = 'admin');
```

### C. Tabela `approval_steps` (Histórico de Pareceres de cada Etapa)
As etapas devem poder ser visualizadas por todos os autenticados, mas preenchidas apenas por administradores ou pelos responsáveis designados de cada etapa.

```sql
ALTER TABLE public.approval_steps ENABLE ROW LEVEL SECURITY;

-- 1. Leitura por qualquer usuário autenticado
CREATE POLICY "Leitura de etapas de aprovação por autenticados"
ON public.approval_steps FOR SELECT
TO authenticated
USING (true);

-- 2. Criação de etapas por admins ou moderadores
CREATE POLICY "Criação de etapas controlada"
ON public.approval_steps FOR INSERT
TO authenticated
WITH CHECK (
  public.get_auth_role() = 'admin'
  OR public.get_auth_role() = 'moderator'
);

-- 3. Atualização de etapas pelo responsável designado, admin ou moderador
CREATE POLICY "Preenchimento de pareceres pelo responsável"
ON public.approval_steps FOR UPDATE
TO authenticated
USING (
  public.get_auth_role() = 'admin'
  OR public.get_auth_role() = 'moderator'
  -- Permitir se for o responsável atribuído àquela etapa específica
  OR assigned_user_id = auth.uid()
)
WITH CHECK (
  public.get_auth_role() = 'admin'
  OR public.get_auth_role() = 'moderator'
  OR assigned_user_id = auth.uid()
);

-- 4. Exclusão restrita a administradores
CREATE POLICY "Exclusão de etapas restrita a admins"
ON public.approval_steps FOR DELETE
TO authenticated
USING (public.get_auth_role() = 'admin');
```
