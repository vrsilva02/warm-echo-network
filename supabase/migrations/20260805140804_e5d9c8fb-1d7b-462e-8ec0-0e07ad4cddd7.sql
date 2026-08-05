DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'asset_licenses') THEN
        CREATE TABLE public.asset_licenses (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            asset_id uuid REFERENCES public.ativos(id) ON DELETE CASCADE NOT NULL,
            license_id uuid REFERENCES public.licencas(id) ON DELETE CASCADE NOT NULL,
            assigned_at timestamptz DEFAULT now(),
            assigned_by uuid,
            removed_at timestamptz,
            removed_by uuid,
            status text DEFAULT 'ativo',
            UNIQUE(asset_id, license_id)
        );
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_licenses TO authenticated;
        GRANT ALL ON public.asset_licenses TO service_role;
        ALTER TABLE public.asset_licenses ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Permitir leitura para autenticados" ON public.asset_licenses FOR SELECT TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_alocacoes_ativo_licenca_unique_ativa') THEN
        CREATE UNIQUE INDEX idx_alocacoes_ativo_licenca_unique_ativa ON public.alocacoes (ativo_id, licenca_id) WHERE (data_fim IS NULL AND ativo_id IS NOT NULL AND licenca_id IS NOT NULL);
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.check_license_deletion()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.alocacoes WHERE licenca_id = OLD.id AND data_fim IS NULL) THEN
        RAISE EXCEPTION 'Esta licença possui ativos vinculados e não pode ser excluída.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_license_deletion ON public.licencas;
CREATE TRIGGER trg_check_license_deletion
BEFORE DELETE ON public.licencas
FOR EACH ROW EXECUTE FUNCTION public.check_license_deletion();

CREATE OR REPLACE VIEW public.vw_licencas_indicadores AS
SELECT 
    l.id AS licenca_id,
    pc.nome_oficial AS nome,
    f.nome AS fabricante,
    pc.categoria,
    pc.subtipo AS tipo_licenca,
    l.quantidade AS total,
    (SELECT COUNT(*)::int FROM public.alocacoes a WHERE a.licenca_id = l.id AND a.data_fim IS NULL) AS atribuidas,
    l.quantidade - (SELECT COUNT(*)::int FROM public.alocacoes a WHERE a.licenca_id = l.id AND a.data_fim IS NULL) AS disponiveis,
    CASE 
        WHEN l.quantidade > 0 THEN ROUND(((SELECT COUNT(*)::float FROM public.alocacoes a WHERE a.licenca_id = l.id AND a.data_fim IS NULL) / l.quantidade::float) * 100)
        ELSE 0
    END AS percentual_uso,
    l.data_expiracao AS data_vencimento
FROM public.licencas l
JOIN public.produtos_catalogo pc ON pc.id = l.produto_id
LEFT JOIN public.fabricantes f ON f.id = pc.fabricante_id;

GRANT SELECT ON public.vw_licencas_indicadores TO authenticated;
