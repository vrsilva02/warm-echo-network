-- 1. Campo de garantia em ativos
ALTER TABLE public.ativos ADD COLUMN IF NOT EXISTS data_fim_garantia date;

-- 2. Enums
DO $$ BEGIN
  CREATE TYPE public.mov_tipo AS ENUM ('entrada','saida','ajuste');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.os_status AS ENUM ('aberta','em_andamento','aguardando_peca','concluida','cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.os_prioridade AS ENUM ('baixa','media','alta','critica');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Catálogo de peças
CREATE TABLE public.pecas_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  categoria text NOT NULL,
  fabricante text,
  modelos_compativeis text[] NOT NULL DEFAULT '{}',
  estoque_minimo integer NOT NULL DEFAULT 0,
  custo_unitario numeric,
  fornecedor_padrao text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pecas_catalogo TO authenticated;
GRANT ALL ON public.pecas_catalogo TO service_role;
ALTER TABLE public.pecas_catalogo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pecas_read" ON public.pecas_catalogo FOR SELECT TO authenticated USING (public.can_read(auth.uid()));
CREATE POLICY "pecas_write" ON public.pecas_catalogo FOR ALL TO authenticated
  USING (public.is_gestor_or_admin(auth.uid())) WITH CHECK (public.is_gestor_or_admin(auth.uid()));

-- 4. Movimentações
CREATE TABLE public.estoque_movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  peca_id uuid NOT NULL REFERENCES public.pecas_catalogo(id) ON DELETE CASCADE,
  tipo public.mov_tipo NOT NULL,
  quantidade integer NOT NULL,
  custo_unitario numeric,
  ordem_servico_id uuid,
  origem text NOT NULL DEFAULT 'manual',
  observacao text,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque_movimentacoes TO authenticated;
GRANT ALL ON public.estoque_movimentacoes TO service_role;
ALTER TABLE public.estoque_movimentacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mov_read" ON public.estoque_movimentacoes FOR SELECT TO authenticated USING (public.can_read(auth.uid()));
CREATE POLICY "mov_insert_manual" ON public.estoque_movimentacoes FOR INSERT TO authenticated
  WITH CHECK (public.is_gestor_or_admin(auth.uid()) AND origem = 'manual');
CREATE POLICY "mov_update_manual" ON public.estoque_movimentacoes FOR UPDATE TO authenticated
  USING (public.is_gestor_or_admin(auth.uid()) AND origem = 'manual')
  WITH CHECK (origem = 'manual');
CREATE POLICY "mov_delete_manual" ON public.estoque_movimentacoes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') AND origem = 'manual');

-- 5. Ordens de serviço
CREATE TABLE public.ordens_servico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero serial UNIQUE,
  ativo_id uuid NOT NULL REFERENCES public.ativos(id) ON DELETE CASCADE,
  descricao_defeito text NOT NULL,
  prioridade public.os_prioridade NOT NULL DEFAULT 'media',
  status public.os_status NOT NULL DEFAULT 'aberta',
  tecnico_id uuid,
  data_abertura timestamptz NOT NULL DEFAULT now(),
  data_conclusao timestamptz,
  observacoes text,
  status_ativo_anterior text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordens_servico TO authenticated;
GRANT ALL ON public.ordens_servico TO service_role;
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "os_read" ON public.ordens_servico FOR SELECT TO authenticated USING (public.can_read(auth.uid()));
CREATE POLICY "os_write" ON public.ordens_servico FOR ALL TO authenticated
  USING (public.is_gestor_or_admin(auth.uid())) WITH CHECK (public.is_gestor_or_admin(auth.uid()));

-- 6. Peças usadas na OS
CREATE TABLE public.ordens_servico_pecas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  peca_id uuid NOT NULL REFERENCES public.pecas_catalogo(id) ON DELETE RESTRICT,
  quantidade integer NOT NULL DEFAULT 1,
  custo_unitario numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordens_servico_pecas TO authenticated;
GRANT ALL ON public.ordens_servico_pecas TO service_role;
ALTER TABLE public.ordens_servico_pecas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "osp_read" ON public.ordens_servico_pecas FOR SELECT TO authenticated USING (public.can_read(auth.uid()));
CREATE POLICY "osp_write" ON public.ordens_servico_pecas FOR ALL TO authenticated
  USING (public.is_gestor_or_admin(auth.uid())) WITH CHECK (public.is_gestor_or_admin(auth.uid()));

-- 7. Views
CREATE OR REPLACE VIEW public.vw_estoque_saldo WITH (security_invoker=true) AS
SELECT p.id AS peca_id, p.nome, p.categoria, p.fabricante,
  p.estoque_minimo, p.custo_unitario, p.fornecedor_padrao,
  COALESCE(SUM(CASE WHEN m.tipo='entrada' THEN m.quantidade
                    WHEN m.tipo='saida' THEN -m.quantidade
                    WHEN m.tipo='ajuste' THEN m.quantidade
                    ELSE 0 END),0)::int AS saldo
FROM public.pecas_catalogo p
LEFT JOIN public.estoque_movimentacoes m ON m.peca_id=p.id
GROUP BY p.id;
GRANT SELECT ON public.vw_estoque_saldo TO authenticated;

CREATE OR REPLACE VIEW public.vw_pecas_reposicao WITH (security_invoker=true) AS
SELECT s.*,
  GREATEST(s.estoque_minimo * 2 - s.saldo, s.estoque_minimo - s.saldo, 1)::int AS quantidade_sugerida
FROM public.vw_estoque_saldo s
WHERE s.saldo <= s.estoque_minimo;
GRANT SELECT ON public.vw_pecas_reposicao TO authenticated;

CREATE OR REPLACE VIEW public.vw_ativos_defeito_recorrente WITH (security_invoker=true) AS
SELECT os.ativo_id, a.hostname, a.setor,
  COUNT(*)::int AS os_count,
  MAX(os.data_abertura) AS ultima_os
FROM public.ordens_servico os
JOIN public.ativos a ON a.id = os.ativo_id
WHERE os.data_abertura >= now() - interval '6 months'
GROUP BY os.ativo_id, a.hostname, a.setor
HAVING COUNT(*) >= 3;
GRANT SELECT ON public.vw_ativos_defeito_recorrente TO authenticated;

-- 8. Triggers de automação
CREATE OR REPLACE FUNCTION public.fn_os_ativo_manutencao() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_prev text;
BEGIN
  SELECT status_ciclo_vida INTO v_prev FROM public.ativos WHERE id=NEW.ativo_id;
  NEW.status_ativo_anterior := COALESCE(NEW.status_ativo_anterior, v_prev);
  UPDATE public.ativos
    SET status_ciclo_vida='manutencao', data_ultima_transicao=now()
    WHERE id=NEW.ativo_id AND status_ciclo_vida<>'manutencao';
  INSERT INTO public.ativos_historico_status (ativo_id, status_anterior, status_novo, observacao)
    VALUES (NEW.ativo_id, v_prev, 'manutencao', 'Abertura de OS #' || NEW.id::text);
  RETURN NEW;
END; $$;
CREATE TRIGGER tg_os_ativo_manutencao BEFORE INSERT ON public.ordens_servico
FOR EACH ROW EXECUTE FUNCTION public.fn_os_ativo_manutencao();

CREATE OR REPLACE FUNCTION public.fn_os_concluida() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status='concluida' AND OLD.status IS DISTINCT FROM 'concluida' THEN
    NEW.data_conclusao := COALESCE(NEW.data_conclusao, now());
    UPDATE public.ativos
      SET status_ciclo_vida=COALESCE(NEW.status_ativo_anterior,'em_uso'), data_ultima_transicao=now()
      WHERE id=NEW.ativo_id AND status_ciclo_vida='manutencao';
    INSERT INTO public.ativos_historico_status (ativo_id, status_anterior, status_novo, observacao)
      VALUES (NEW.ativo_id, 'manutencao', COALESCE(NEW.status_ativo_anterior,'em_uso'), 'Conclusão da OS');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER tg_os_concluida BEFORE UPDATE ON public.ordens_servico
FOR EACH ROW EXECUTE FUNCTION public.fn_os_concluida();

CREATE OR REPLACE FUNCTION public.fn_osp_baixa_estoque() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_custo numeric;
BEGIN
  SELECT COALESCE(NEW.custo_unitario, custo_unitario) INTO v_custo
    FROM public.pecas_catalogo WHERE id=NEW.peca_id;
  INSERT INTO public.estoque_movimentacoes
    (peca_id, tipo, quantidade, custo_unitario, ordem_servico_id, origem, observacao)
    VALUES (NEW.peca_id, 'saida', NEW.quantidade, v_custo, NEW.ordem_servico_id, 'auto_os',
      'Baixa automática por uso na OS');
  RETURN NEW;
END; $$;
CREATE TRIGGER tg_osp_baixa AFTER INSERT ON public.ordens_servico_pecas
FOR EACH ROW EXECUTE FUNCTION public.fn_osp_baixa_estoque();

CREATE OR REPLACE FUNCTION public.fn_osp_reverte_estoque() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.estoque_movimentacoes
    (peca_id, tipo, quantidade, ordem_servico_id, origem, observacao)
    VALUES (OLD.peca_id, 'entrada', OLD.quantidade, OLD.ordem_servico_id, 'auto_os',
      'Estorno automático por remoção da OS');
  RETURN OLD;
END; $$;
CREATE TRIGGER tg_osp_reverte AFTER DELETE ON public.ordens_servico_pecas
FOR EACH ROW EXECUTE FUNCTION public.fn_osp_reverte_estoque();

-- 9. updated_at
CREATE TRIGGER tg_pecas_updated BEFORE UPDATE ON public.pecas_catalogo
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_os_updated BEFORE UPDATE ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();