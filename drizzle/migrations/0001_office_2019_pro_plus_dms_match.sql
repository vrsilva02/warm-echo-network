CREATE OR REPLACE FUNCTION public.chave_office_2019(p_chave uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 SELECT coalesce((SELECT (' '||n||' ') LIKE '% office 2019 %' AND ((' '||n||' ') LIKE '% pro plus %' OR (' '||n||' ') LIKE '% professional plus %')
  FROM (SELECT lower(trim(regexp_replace(p.nome_oficial, '[^a-zA-Z0-9]+', ' ', 'g'))) n
        FROM public.licenses k JOIN public.licencas l ON l.id=k.licenca_id JOIN public.produtos_catalogo p ON p.id=l.produto_id WHERE k.id=p_chave) s), false);
$$;
UPDATE public.alocacoes SET chave_multiplos_ativos = public.chave_office_2019(chave_id) WHERE chave_id IS NOT NULL;
UPDATE public.licenses SET status=status WHERE public.chave_office_2019(id) AND status IN ('disponivel','alocada');