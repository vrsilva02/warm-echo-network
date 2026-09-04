ALTER TYPE public.license_status ADD VALUE IF NOT EXISTS 'revogada';

ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS licenca_id uuid REFERENCES public.licencas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_licenses_licenca ON public.licenses(licenca_id);

ALTER TABLE public.alocacoes
  ADD COLUMN IF NOT EXISTS chave_id uuid REFERENCES public.licenses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_alocacoes_chave ON public.alocacoes(chave_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_alocacoes_chave_unica_ativa
  ON public.alocacoes(chave_id) WHERE data_fim IS NULL AND chave_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_check_limite_chaves()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qtd int;
  v_total int;
BEGIN
  IF NEW.licenca_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT quantidade INTO v_qtd FROM public.licencas WHERE id = NEW.licenca_id;
  IF v_qtd IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT count(*) INTO v_total FROM public.licenses
    WHERE licenca_id = NEW.licenca_id AND (TG_OP = 'INSERT' OR id <> NEW.id);
  IF v_total + 1 > v_qtd THEN
    RAISE EXCEPTION 'Limite de chaves atingido: esta licença permite % chave(s) e já existem % cadastrada(s).', v_qtd, v_total;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_check_limite_chaves ON public.licenses;
CREATE TRIGGER tg_check_limite_chaves
  BEFORE INSERT OR UPDATE OF licenca_id ON public.licenses
  FOR EACH ROW EXECUTE FUNCTION public.fn_check_limite_chaves();

CREATE OR REPLACE VIEW public.vw_licencas_chaves_saldo AS
SELECT
  l.id AS licenca_id,
  l.produto_id,
  l.quantidade,
  count(k.id) AS chaves_cadastradas,
  count(k.id) FILTER (WHERE k.status = 'disponivel') AS chaves_disponiveis,
  count(k.id) FILTER (WHERE k.status = 'alocada') AS chaves_alocadas,
  count(k.id) FILTER (WHERE k.status = 'expirada') AS chaves_expiradas,
  greatest(0, coalesce(l.quantidade, 0) - count(k.id)) AS chaves_pendentes
FROM public.licencas l
LEFT JOIN public.licenses k ON k.licenca_id = l.id
GROUP BY l.id, l.produto_id, l.quantidade;

GRANT SELECT ON public.vw_licencas_chaves_saldo TO authenticated;
GRANT SELECT ON public.vw_licencas_chaves_saldo TO service_role;