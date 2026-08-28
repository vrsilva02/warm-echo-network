CREATE TABLE public.ativos_tipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ativos_tipos_nome_uniq ON public.ativos_tipos (lower(nome));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ativos_tipos TO authenticated;
GRANT ALL ON public.ativos_tipos TO service_role;
ALTER TABLE public.ativos_tipos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ativos_tipos_select" ON public.ativos_tipos FOR SELECT TO authenticated USING (public.can_read(auth.uid()) OR public.is_tecnico(auth.uid()));
CREATE POLICY "ativos_tipos_write" ON public.ativos_tipos FOR ALL TO authenticated USING (public.is_gestor_or_admin(auth.uid())) WITH CHECK (public.is_gestor_or_admin(auth.uid()));

CREATE TABLE public.ativos_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ativos_categorias_nome_uniq ON public.ativos_categorias (lower(nome));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ativos_categorias TO authenticated;
GRANT ALL ON public.ativos_categorias TO service_role;
ALTER TABLE public.ativos_categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ativos_categorias_select" ON public.ativos_categorias FOR SELECT TO authenticated USING (public.can_read(auth.uid()) OR public.is_tecnico(auth.uid()));
CREATE POLICY "ativos_categorias_write" ON public.ativos_categorias FOR ALL TO authenticated USING (public.is_gestor_or_admin(auth.uid())) WITH CHECK (public.is_gestor_or_admin(auth.uid()));

CREATE TRIGGER trg_ativos_tipos_updated BEFORE UPDATE ON public.ativos_tipos FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_ativos_categorias_updated BEFORE UPDATE ON public.ativos_categorias FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_audit_ativos_tipos AFTER INSERT OR UPDATE OR DELETE ON public.ativos_tipos FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
CREATE TRIGGER trg_audit_ativos_categorias AFTER INSERT OR UPDATE OR DELETE ON public.ativos_categorias FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

INSERT INTO public.ativos_tipos (nome) VALUES
 ('NOTEBOOK'),('DESKTOP'),('MINI PC'),('MONITOR'),('NOBREAK 600VA'),('NOBREAK 1200VA'),
 ('WORKSTATION'),('MACBOOK'),('TABLET'),('CHROMEBOOK'),('TELA INTERATIVA'),('GABINETE DE RECARGA')
ON CONFLICT DO NOTHING;

INSERT INTO public.ativos_categorias (nome) VALUES
 ('Notebook'),('Microcomputador TIPO I'),('Microcomputador TIPO II'),('Microcomputador TIPO III'),
 ('Microcomputador TIPO IV'),('Nobreak Tipo I'),('Nobreak Tipo II'),('Monitor Tipo II'),('Monitor Tipo III e IV')
ON CONFLICT DO NOTHING;

INSERT INTO public.ativos_tipos (nome)
SELECT DISTINCT btrim(a.tipo) FROM public.ativos a
WHERE btrim(coalesce(a.tipo,'')) <> ''
  AND NOT EXISTS (SELECT 1 FROM public.ativos_tipos t WHERE lower(t.nome) = lower(btrim(a.tipo)))
ON CONFLICT DO NOTHING;

INSERT INTO public.ativos_categorias (nome)
SELECT DISTINCT btrim(a.categoria) FROM public.ativos a
WHERE btrim(coalesce(a.categoria,'')) <> ''
  AND NOT EXISTS (SELECT 1 FROM public.ativos_categorias c WHERE lower(c.nome) = lower(btrim(a.categoria)))
ON CONFLICT DO NOTHING;