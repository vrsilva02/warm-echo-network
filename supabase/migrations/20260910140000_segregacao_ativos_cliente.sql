-- ====================================================================
-- Migração: Segregação de Ativos por Cliente e Relação com Contratos
-- ====================================================================

-- 1. Adiciona contrato_id na tabela ativos (ativo -> contrato -> cliente)
ALTER TABLE public.ativos 
ADD COLUMN IF NOT EXISTS contrato_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ativos_contrato_id 
ON public.ativos(contrato_id);

-- 2. Remove o índice de unicidade global anterior em numero_patrimonio
-- Isso permite que clientes diferentes possuam ativos com o mesmo número de patrimônio
DROP INDEX IF EXISTS public.ativos_numero_patrimonio_key;

-- 3. Cria índices únicos compostos por cliente (escopo "cliente")
-- Um identificador não pode se repetir dentro do mesmo cliente, mas pode existir em clientes distintos.

-- 3.1 Unicidade composta de número de patrimônio por cliente (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ativos_cliente_patrimonio_uniq 
ON public.ativos (cliente_id, lower(trim(numero_patrimonio))) 
WHERE numero_patrimonio IS NOT NULL AND cliente_id IS NOT NULL;

-- 3.2 Unicidade composta de hostname/código por cliente (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ativos_cliente_hostname_uniq 
ON public.ativos (cliente_id, lower(trim(hostname))) 
WHERE cliente_id IS NOT NULL;

-- 3.3 Unicidade composta de número de série por cliente (case-insensitive, opcional)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ativos_cliente_serie_uniq 
ON public.ativos (cliente_id, lower(trim(numero_serie))) 
WHERE numero_serie IS NOT NULL AND cliente_id IS NOT NULL;

-- 4. Comentários para documentação de schema
COMMENT ON COLUMN public.ativos.contrato_id IS 'Contrato de fornecimento/licenciamento ao qual o ativo pertence.';
COMMENT ON INDEX public.idx_ativos_cliente_patrimonio_uniq IS 'Garante que o número de patrimônio seja único dentro do escopo de cada cliente.';
COMMENT ON INDEX public.idx_ativos_cliente_hostname_uniq IS 'Garante que o hostname seja único dentro do escopo de cada cliente.';
