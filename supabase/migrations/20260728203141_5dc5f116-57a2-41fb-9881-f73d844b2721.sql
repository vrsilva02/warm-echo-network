
-- 1) Helpers
CREATE OR REPLACE FUNCTION public.is_tecnico(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(_user_id, 'tecnico') $$;

CREATE OR REPLACE FUNCTION public.can_operate_os(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR public.has_role(_user_id, 'gestor_ti')
      OR public.has_role(_user_id, 'tecnico');
$$;

CREATE OR REPLACE FUNCTION public.can_read_os(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.can_read(_user_id) OR public.has_role(_user_id, 'tecnico');
$$;

-- 2) Estender SELECT de tabelas que Técnicos precisam ver

-- ativos (adiciona política complementar para técnicos)
CREATE POLICY "ativos_tecnico_read" ON public.ativos
  FOR SELECT TO authenticated USING (public.is_tecnico(auth.uid()));

-- pecas_catalogo
CREATE POLICY "pecas_tecnico_read" ON public.pecas_catalogo
  FOR SELECT TO authenticated USING (public.is_tecnico(auth.uid()));

-- estoque_movimentacoes (somente leitura)
CREATE POLICY "mov_tecnico_read" ON public.estoque_movimentacoes
  FOR SELECT TO authenticated USING (public.is_tecnico(auth.uid()));

-- ordens_servico: leitura + escrita (sem delete)
CREATE POLICY "os_tecnico_read" ON public.ordens_servico
  FOR SELECT TO authenticated USING (public.is_tecnico(auth.uid()));
CREATE POLICY "os_tecnico_insert" ON public.ordens_servico
  FOR INSERT TO authenticated WITH CHECK (public.is_tecnico(auth.uid()));
CREATE POLICY "os_tecnico_update" ON public.ordens_servico
  FOR UPDATE TO authenticated
  USING (public.is_tecnico(auth.uid())) WITH CHECK (public.is_tecnico(auth.uid()));

-- ordens_servico_pecas: leitura + escrita
CREATE POLICY "osp_tecnico_read" ON public.ordens_servico_pecas
  FOR SELECT TO authenticated USING (public.is_tecnico(auth.uid()));
CREATE POLICY "osp_tecnico_write" ON public.ordens_servico_pecas
  FOR ALL TO authenticated
  USING (public.is_tecnico(auth.uid())) WITH CHECK (public.is_tecnico(auth.uid()));

-- profiles: técnicos precisam ver nome de outros técnicos p/ atribuir OS
CREATE POLICY "profiles_tecnico_read" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_tecnico(auth.uid()));

-- 3) Tabela de anexos de OS
CREATE TABLE public.ordens_servico_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  nome_arquivo text NOT NULL,
  mime_type text,
  tamanho_bytes bigint,
  descricao text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_os_anexos_os ON public.ordens_servico_anexos(ordem_servico_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordens_servico_anexos TO authenticated;
GRANT ALL ON public.ordens_servico_anexos TO service_role;

ALTER TABLE public.ordens_servico_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "os_anexos_read" ON public.ordens_servico_anexos
  FOR SELECT TO authenticated USING (public.can_read_os(auth.uid()));
CREATE POLICY "os_anexos_insert" ON public.ordens_servico_anexos
  FOR INSERT TO authenticated
  WITH CHECK (public.can_operate_os(auth.uid()) AND uploaded_by = auth.uid());
CREATE POLICY "os_anexos_delete" ON public.ordens_servico_anexos
  FOR DELETE TO authenticated
  USING (public.can_operate_os(auth.uid()));

-- 4) Bucket policies (bucket os-evidencias)
-- caminho esperado: "{ordem_servico_id}/{filename}"
CREATE POLICY "os_evidencias_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'os-evidencias' AND public.can_read_os(auth.uid()));

CREATE POLICY "os_evidencias_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'os-evidencias' AND public.can_operate_os(auth.uid()));

CREATE POLICY "os_evidencias_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'os-evidencias' AND public.can_operate_os(auth.uid()));

CREATE POLICY "os_evidencias_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'os-evidencias' AND public.can_operate_os(auth.uid()));
