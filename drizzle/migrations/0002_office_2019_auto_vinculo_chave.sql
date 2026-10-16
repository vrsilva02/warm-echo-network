CREATE OR REPLACE FUNCTION public.produto_office_2019(p_licenca uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 SELECT coalesce((SELECT (' '||n||' ') LIKE '% office 2019 %' AND ((' '||n||' ') LIKE '% pro plus %' OR (' '||n||' ') LIKE '% professional plus %')
  FROM (SELECT lower(trim(regexp_replace(p.nome_oficial, '[^a-zA-Z0-9]+', ' ', 'g'))) n
        FROM public.licencas l JOIN public.produtos_catalogo p ON p.id=l.produto_id WHERE l.id=p_licenca) s), false);
$$;
CREATE OR REPLACE FUNCTION public.fn_vincular_chave_office_2019()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.chave_id IS NOT NULL AND NEW.licenca_id IS NOT NULL AND public.produto_office_2019(NEW.licenca_id) THEN
    UPDATE public.licenses SET licenca_id = NEW.licenca_id
     WHERE id = NEW.chave_id AND licenca_id IS NULL
       AND (' '||lower(trim(regexp_replace(software, '[^a-zA-Z0-9]+', ' ', 'g')))||' ') LIKE '% office 2019 %';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tg_a_vincular_chave_office_2019 BEFORE INSERT OR UPDATE OF chave_id, licenca_id ON public.alocacoes
FOR EACH ROW EXECUTE FUNCTION public.fn_vincular_chave_office_2019();
CREATE OR REPLACE FUNCTION public.fn_vincular_lote_office_2019()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v uuid;
BEGIN
  IF NEW.licenca_id IS NULL AND (' '||lower(trim(regexp_replace(NEW.software, '[^a-zA-Z0-9]+', ' ', 'g')))||' ') LIKE '% office 2019 %'
     AND (' '||lower(trim(regexp_replace(NEW.software, '[^a-zA-Z0-9]+', ' ', 'g')))||' ') ~ ' (pro|professional) plus ' THEN
    SELECT l.id INTO v FROM public.licencas l WHERE public.produto_office_2019(l.id) ORDER BY l.created_at DESC LIMIT 1;
    NEW.licenca_id := v;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tg_a_vincular_lote_office_2019 BEFORE INSERT ON public.licenses
FOR EACH ROW EXECUTE FUNCTION public.fn_vincular_lote_office_2019();