ALTER TABLE public.auditoria_convites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auditoria_convites FROM anon;
GRANT SELECT ON public.auditoria_convites TO authenticated;
GRANT ALL ON public.auditoria_convites TO service_role;
CREATE POLICY auditoria_convites_admin_read ON public.auditoria_convites FOR SELECT TO authenticated USING ((SELECT public.is_admin(auth.uid())));

DROP POLICY IF EXISTS os_historico_read ON public.ordens_servico_historico;
CREATE POLICY os_historico_read ON public.ordens_servico_historico FOR SELECT TO authenticated USING ((SELECT public.can_read_os(auth.uid())));

DROP POLICY IF EXISTS "Permitir leitura para autenticados" ON public.asset_licenses;
CREATE POLICY asset_licenses_read ON public.asset_licenses FOR SELECT TO authenticated USING ((SELECT public.can_read(auth.uid())));

ALTER FUNCTION public.fn_notify_os_change() SET search_path = public;
ALTER FUNCTION public.tg_os_historico_update_fn() SET search_path = public;
ALTER FUNCTION public.fn_os_historico_update() SET search_path = public;
ALTER FUNCTION public.fn_os_historico_insert() SET search_path = public;

CREATE TABLE public.metricas_carregamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo text NOT NULL,
  duracao_ms integer NOT NULL CHECK (duracao_ms >= 0 AND duracao_ms < 600000),
  tipo text NOT NULL DEFAULT 'navegacao',
  user_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_metricas_carregamento_created ON public.metricas_carregamento (created_at DESC);
GRANT SELECT, INSERT ON public.metricas_carregamento TO authenticated;
GRANT ALL ON public.metricas_carregamento TO service_role;
ALTER TABLE public.metricas_carregamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY metricas_insert_own ON public.metricas_carregamento FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY metricas_read_gestor ON public.metricas_carregamento FOR SELECT TO authenticated USING ((SELECT public.is_gestor_or_admin(auth.uid())));