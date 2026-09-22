-- ====================================================================
-- Fix: Unicidade de ativos deve ser por cliente, não global
-- Patrimônios iguais podem existir em clientes diferentes.
-- ====================================================================

-- 1. Remove índices únicos GLOBAIS de numero_patrimonio (se existirem)
DROP INDEX IF EXISTS public.ativos_numero_patrimonio_key;
DROP INDEX IF EXISTS public.ativos_numero_patrimonio_unique;
DROP INDEX IF EXISTS public.idx_ativos_numero_patrimonio;
DROP INDEX IF EXISTS public.ativos_hostname_key;
DROP INDEX IF EXISTS public.ativos_hostname_unique;
DROP INDEX IF EXISTS public.idx_ativos_hostname;
DROP INDEX IF EXISTS public.ativos_numero_serie_key;
DROP INDEX IF EXISTS public.ativos_numero_serie_unique;
DROP INDEX IF EXISTS public.idx_ativos_numero_serie;

-- 2. Remove constraint UNIQUE diretamente na coluna (alternativa ao índice)
ALTER TABLE public.ativos DROP CONSTRAINT IF EXISTS ativos_numero_patrimonio_key;
ALTER TABLE public.ativos DROP CONSTRAINT IF EXISTS ativos_hostname_key;
ALTER TABLE public.ativos DROP CONSTRAINT IF EXISTS ativos_numero_serie_key;
ALTER TABLE public.ativos DROP CONSTRAINT IF EXISTS ativos_numero_patrimonio_unique;
ALTER TABLE public.ativos DROP CONSTRAINT IF EXISTS ativos_hostname_unique;
ALTER TABLE public.ativos DROP CONSTRAINT IF EXISTS ativos_numero_serie_unique;

-- 3. Cria índices únicos COMPOSTOS por cliente (escopo por cliente)
-- Permite mesmo patrimônio em clientes distintos, bloqueia duplicata no mesmo cliente.

CREATE UNIQUE INDEX IF NOT EXISTS idx_ativos_cliente_patrimonio_uniq
  ON public.ativos (cliente_id, lower(trim(numero_patrimonio)))
  WHERE numero_patrimonio IS NOT NULL AND cliente_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ativos_cliente_hostname_uniq
  ON public.ativos (cliente_id, lower(trim(hostname)))
  WHERE cliente_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ativos_cliente_serie_uniq
  ON public.ativos (cliente_id, lower(trim(numero_serie)))
  WHERE numero_serie IS NOT NULL AND cliente_id IS NOT NULL;
