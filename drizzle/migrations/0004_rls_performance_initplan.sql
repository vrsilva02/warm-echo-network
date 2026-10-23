DO $$
DECLARE r record; pat text := '(public\.)?\m(is_admin|is_tecnico|has_role|can_read|can_read_os|can_operate_os|is_gestor_or_admin)\(auth\.uid\(\)[^)]*\)';
  nq text; nc text; stmt text;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname, qual, with_check FROM pg_policies WHERE schemaname='public' LOOP
    nq := CASE WHEN r.qual IS NOT NULL AND r.qual !~* 'select' THEN regexp_replace(r.qual, pat, '(SELECT \&)', 'g') END;
    nc := CASE WHEN r.with_check IS NOT NULL AND r.with_check !~* 'select' THEN regexp_replace(r.with_check, pat, '(SELECT \&)', 'g') END;
    stmt := '';
    IF nq IS NOT NULL AND nq <> r.qual THEN stmt := stmt || ' USING (' || nq || ')'; END IF;
    IF nc IS NOT NULL AND nc <> r.with_check THEN stmt := stmt || ' WITH CHECK (' || nc || ')'; END IF;
    IF stmt <> '' THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename) || stmt;
    END IF;
  END LOOP;
END $$;
CREATE INDEX IF NOT EXISTS idx_ativos_hostname ON public.ativos (hostname);
CREATE INDEX IF NOT EXISTS idx_ativos_status_ciclo ON public.ativos (status_ciclo_vida);
CREATE INDEX IF NOT EXISTS idx_alocacoes_chave ON public.alocacoes (chave_id);
CREATE INDEX IF NOT EXISTS idx_alocacoes_ativo ON public.alocacoes (ativo_id);
CREATE INDEX IF NOT EXISTS idx_licenses_licenca ON public.licenses (licenca_id);