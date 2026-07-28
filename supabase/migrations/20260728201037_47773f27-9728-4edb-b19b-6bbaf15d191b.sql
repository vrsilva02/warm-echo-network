
-- SERVIÇOS DE NEGÓCIO
CREATE TABLE public.servicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  criticidade text CHECK (criticidade IN ('baixa','media','alta','critica')),
  responsavel_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.servicos TO authenticated;
GRANT ALL ON public.servicos TO service_role;
ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "servicos_read" ON public.servicos FOR SELECT TO authenticated USING (public.can_read(auth.uid()));
CREATE POLICY "servicos_admin_all" ON public.servicos FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "servicos_gestor_write" ON public.servicos FOR ALL TO authenticated USING (public.has_role(auth.uid(),'gestor_ti')) WITH CHECK (public.has_role(auth.uid(),'gestor_ti'));
CREATE TRIGGER trg_servicos_updated BEFORE UPDATE ON public.servicos FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ATIVOS <-> SERVIÇOS
CREATE TABLE public.ativos_servicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ativo_id uuid REFERENCES public.ativos(id) ON DELETE CASCADE,
  servico_id uuid REFERENCES public.servicos(id) ON DELETE CASCADE,
  tipo_dependencia text CHECK (tipo_dependencia IN ('hospeda','suporta','depende_de')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ativos_servicos TO authenticated;
GRANT ALL ON public.ativos_servicos TO service_role;
ALTER TABLE public.ativos_servicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ativos_servicos_read" ON public.ativos_servicos FOR SELECT TO authenticated USING (public.can_read(auth.uid()));
CREATE POLICY "ativos_servicos_admin_all" ON public.ativos_servicos FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "ativos_servicos_gestor_write" ON public.ativos_servicos FOR ALL TO authenticated USING (public.has_role(auth.uid(),'gestor_ti')) WITH CHECK (public.has_role(auth.uid(),'gestor_ti'));

-- ATIVOS <-> ATIVOS
CREATE TABLE public.ativos_relacionamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ativo_pai_id uuid REFERENCES public.ativos(id) ON DELETE CASCADE,
  ativo_filho_id uuid REFERENCES public.ativos(id) ON DELETE CASCADE,
  tipo_relacao text CHECK (tipo_relacao IN ('hospeda_vm','conecta','depende_de')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ativos_relacionamentos TO authenticated;
GRANT ALL ON public.ativos_relacionamentos TO service_role;
ALTER TABLE public.ativos_relacionamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ativos_rel_read" ON public.ativos_relacionamentos FOR SELECT TO authenticated USING (public.can_read(auth.uid()));
CREATE POLICY "ativos_rel_admin_all" ON public.ativos_relacionamentos FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "ativos_rel_gestor_write" ON public.ativos_relacionamentos FOR ALL TO authenticated USING (public.has_role(auth.uid(),'gestor_ti')) WITH CHECK (public.has_role(auth.uid(),'gestor_ti'));

-- CENTROS DE CUSTO
CREATE TABLE public.centros_custo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  codigo text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.centros_custo TO authenticated;
GRANT ALL ON public.centros_custo TO service_role;
ALTER TABLE public.centros_custo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "centros_custo_read" ON public.centros_custo FOR SELECT TO authenticated USING (public.can_read(auth.uid()));
CREATE POLICY "centros_custo_admin_all" ON public.centros_custo FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "centros_custo_gestor_write" ON public.centros_custo FOR ALL TO authenticated USING (public.has_role(auth.uid(),'gestor_ti')) WITH CHECK (public.has_role(auth.uid(),'gestor_ti'));
CREATE TRIGGER trg_centros_custo_updated BEFORE UPDATE ON public.centros_custo FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- CAMPOS TCO
ALTER TABLE public.ativos
  ADD COLUMN IF NOT EXISTS centro_custo_id uuid REFERENCES public.centros_custo(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS valor_aquisicao numeric(14,2),
  ADD COLUMN IF NOT EXISTS data_aquisicao date,
  ADD COLUMN IF NOT EXISTS vida_util_meses integer DEFAULT 36;

ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS centro_custo_id uuid REFERENCES public.centros_custo(id) ON DELETE SET NULL;

-- licencas.custo_unitario já existe; nada a fazer.

-- VIEWS
CREATE OR REPLACE VIEW public.vw_tco_ativo
WITH (security_invoker = true) AS
SELECT
  a.id AS ativo_id,
  a.hostname,
  a.valor_aquisicao,
  COALESCE(a.valor_aquisicao,0) *
    GREATEST(0, (a.vida_util_meses - EXTRACT(MONTH FROM age(now(), a.data_aquisicao))) / NULLIF(a.vida_util_meses,0)::numeric) AS valor_residual,
  COALESCE(SUM(l.custo_unitario), 0) AS custo_licencas_mensal,
  COALESCE(a.valor_aquisicao,0) + COALESCE(SUM(l.custo_unitario) * 12, 0) AS tco_anual_estimado
FROM public.ativos a
LEFT JOIN public.alocacoes al ON al.ativo_id = a.id AND al.data_fim IS NULL
LEFT JOIN public.licencas l ON l.id = al.licenca_id
GROUP BY a.id, a.hostname, a.valor_aquisicao, a.data_aquisicao, a.vida_util_meses;

CREATE OR REPLACE VIEW public.vw_custo_ociosas
WITH (security_invoker = true) AS
SELECT
  pc.nome_oficial,
  COUNT(*) AS qtd_ociosa,
  COUNT(*) * AVG(l.custo_unitario) AS custo_mensal_desperdicado
FROM public.licencas l
JOIN public.produtos_catalogo pc ON pc.id = l.produto_id
LEFT JOIN public.alocacoes al ON al.licenca_id = l.id AND al.data_fim IS NULL
WHERE al.id IS NULL
GROUP BY pc.nome_oficial;

CREATE OR REPLACE VIEW public.vw_gap_edr
WITH (security_invoker = true) AS
SELECT
  a.id AS ativo_id,
  a.hostname,
  a.setor,
  a.status_ciclo_vida
FROM public.ativos a
WHERE a.status_ciclo_vida = 'em_uso'
AND NOT EXISTS (
  SELECT 1 FROM public.alocacoes al
  JOIN public.licencas l ON l.id = al.licenca_id
  JOIN public.produtos_catalogo pc ON pc.id = l.produto_id
  WHERE al.ativo_id = a.id
    AND al.data_fim IS NULL
    AND pc.categoria = 'EDR'
);

GRANT SELECT ON public.vw_tco_ativo, public.vw_custo_ociosas, public.vw_gap_edr TO authenticated;
