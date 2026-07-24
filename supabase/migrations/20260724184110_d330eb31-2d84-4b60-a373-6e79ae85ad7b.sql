ALTER TABLE public.ativos ADD COLUMN numero_patrimonio text;
CREATE UNIQUE INDEX ativos_numero_patrimonio_key ON public.ativos (numero_patrimonio) WHERE numero_patrimonio IS NOT NULL;