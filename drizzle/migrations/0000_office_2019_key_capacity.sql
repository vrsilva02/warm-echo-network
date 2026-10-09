CREATE OR REPLACE FUNCTION public.chave_office_2019(p_chave uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT coalesce((SELECT lower(regexp_replace(trim(p.nome_oficial), '[^a-zA-Z0-9]+', ' ', 'g')) IN ('microsoft office 2019 professional plus','office 2019 professional plus') FROM public.licenses k JOIN public.licencas l ON l.id=k.licenca_id JOIN public.produtos_catalogo p ON p.id=l.produto_id WHERE k.id=p_chave), false);
$$;
REVOKE ALL ON FUNCTION public.chave_office_2019(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chave_office_2019(uuid) TO authenticated, service_role;
ALTER TABLE public.alocacoes ADD COLUMN IF NOT EXISTS chave_multiplos_ativos boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.alocacoes.chave_multiplos_ativos IS 'Database-controlled capacity exemption for Office 2019 Professional Plus; never trust client value.';
UPDATE public.alocacoes SET chave_multiplos_ativos=public.chave_office_2019(chave_id) WHERE chave_id IS NOT NULL;
DROP INDEX IF EXISTS public.idx_alocacoes_chave_unica_ativa;
CREATE UNIQUE INDEX idx_alocacoes_chave_unica_ativa ON public.alocacoes(chave_id) WHERE data_fim IS NULL AND chave_id IS NOT NULL AND NOT chave_multiplos_ativos;
CREATE OR REPLACE FUNCTION public.fn_validar_capacidade_office_2019()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_key public.licenses%ROWTYPE; v_uso integer;
BEGIN
 NEW.chave_multiplos_ativos := public.chave_office_2019(NEW.chave_id);
 IF NOT NEW.chave_multiplos_ativos OR NEW.data_fim IS NOT NULL THEN RETURN NEW; END IF;
 SELECT * INTO v_key FROM public.licenses WHERE id=NEW.chave_id FOR UPDATE;
 IF v_key.licenca_id IS DISTINCT FROM NEW.licenca_id THEN RAISE EXCEPTION 'A chave não pertence à licença selecionada.'; END IF;
 IF v_key.status IN ('expirada','revogada') THEN RAISE EXCEPTION 'Esta chave está expirada ou revogada.'; END IF;
 IF TG_OP='INSERT' OR OLD.chave_id IS DISTINCT FROM NEW.chave_id OR OLD.ativo_id IS DISTINCT FROM NEW.ativo_id OR OLD.data_fim IS DISTINCT FROM NEW.data_fim THEN
   IF NEW.ativo_id IS NULL THEN RAISE EXCEPTION 'Selecione um ativo para alocar esta chave do Office 2019.'; END IF;
   SELECT count(DISTINCT ativo_id) + count(*) FILTER (WHERE ativo_id IS NULL) INTO v_uso FROM public.alocacoes WHERE chave_id=NEW.chave_id AND data_fim IS NULL AND id<>NEW.id;
   IF v_uso >= 5 THEN RAISE EXCEPTION 'Esta chave já possui 5/5 ativos alocados.'; END IF;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_validar_capacidade_office_2019() FROM PUBLIC;
CREATE TRIGGER tg_validar_capacidade_office_2019 BEFORE INSERT OR UPDATE ON public.alocacoes FOR EACH ROW EXECUTE FUNCTION public.fn_validar_capacidade_office_2019();
CREATE OR REPLACE FUNCTION public.fn_status_capacidade_office_2019()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_nome text; v_uso integer;
BEGIN
 SELECT p.nome_oficial INTO v_nome FROM public.licencas l JOIN public.produtos_catalogo p ON p.id=l.produto_id WHERE l.id=NEW.licenca_id;
 IF lower(regexp_replace(trim(coalesce(v_nome,'')), '[^a-zA-Z0-9]+', ' ', 'g')) NOT IN ('microsoft office 2019 professional plus','office 2019 professional plus') OR NEW.status IN ('expirada','revogada') THEN RETURN NEW; END IF;
 SELECT count(DISTINCT ativo_id) + count(*) FILTER (WHERE ativo_id IS NULL) INTO v_uso FROM public.alocacoes WHERE chave_id=NEW.id AND data_fim IS NULL;
 NEW.status := CASE WHEN v_uso>=5 THEN 'alocada'::public.license_status ELSE 'disponivel'::public.license_status END;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_status_capacidade_office_2019() FROM PUBLIC;
CREATE TRIGGER tg_status_capacidade_office_2019 BEFORE INSERT OR UPDATE ON public.licenses FOR EACH ROW EXECUTE FUNCTION public.fn_status_capacidade_office_2019();
CREATE OR REPLACE FUNCTION public.fn_sync_capacidade_office_2019()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
 FOR v_id IN SELECT DISTINCT id FROM unnest(ARRAY[CASE WHEN TG_OP<>'INSERT' THEN OLD.chave_id ELSE NULL END, CASE WHEN TG_OP<>'DELETE' THEN NEW.chave_id ELSE NULL END]) id WHERE id IS NOT NULL ORDER BY id LOOP
   IF public.chave_office_2019(v_id) THEN
     UPDATE public.licenses SET status=status WHERE id=v_id;
   END IF;
 END LOOP;
 RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_sync_capacidade_office_2019() FROM PUBLIC;
CREATE TRIGGER tg_sync_capacidade_office_2019 AFTER INSERT OR UPDATE OR DELETE ON public.alocacoes FOR EACH ROW EXECUTE FUNCTION public.fn_sync_capacidade_office_2019();