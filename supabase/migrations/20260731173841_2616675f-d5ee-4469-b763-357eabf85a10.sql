CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  codigo text,
  documento text,
  contato text,
  email text,
  telefone text,
  observacao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clientes_select" ON public.clientes
  FOR SELECT TO authenticated
  USING (public.can_read_os(auth.uid()));

CREATE POLICY "clientes_insert" ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_gestor_or_admin(auth.uid()));

CREATE POLICY "clientes_update" ON public.clientes
  FOR UPDATE TO authenticated
  USING (public.is_gestor_or_admin(auth.uid()))
  WITH CHECK (public.is_gestor_or_admin(auth.uid()));

CREATE POLICY "clientes_delete" ON public.clientes
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_clientes_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

ALTER TABLE public.ativos ADD COLUMN cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL;
ALTER TABLE public.contratos ADD COLUMN cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL;
ALTER TABLE public.licencas ADD COLUMN cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL;

CREATE INDEX idx_ativos_cliente ON public.ativos(cliente_id);
CREATE INDEX idx_contratos_cliente ON public.contratos(cliente_id);
CREATE INDEX idx_licencas_cliente ON public.licencas(cliente_id);
CREATE INDEX idx_clientes_nome ON public.clientes(nome);