-- Alocação opcionalmente referencia uma chave individual do módulo Chaves de Licença
-- (tabela public.licenses), para alocar a chave exata a um ativo/colaborador.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'alocacoes'
      AND column_name = 'chave_id'
  ) THEN
    ALTER TABLE public.alocacoes
      ADD COLUMN chave_id uuid REFERENCES public.licenses(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_alocacoes_chave_id ON public.alocacoes(chave_id);
