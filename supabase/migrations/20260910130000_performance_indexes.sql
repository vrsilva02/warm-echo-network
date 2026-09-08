-- ==============================================================================
-- MIGRAÇÃO DE PERFORMANCE: ÍNDICES PARA ATIVOS, ALOCAÇÕES E LICENSES (CHAVES)
-- ==============================================================================

-- 1. Extensão para busca textual eficiente (se disponível)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Tabela ATIVOS
CREATE INDEX IF NOT EXISTS idx_ativos_hostname_lower ON public.ativos (lower(hostname));
CREATE INDEX IF NOT EXISTS idx_ativos_patrimonio_lower ON public.ativos (lower(numero_patrimonio)) WHERE numero_patrimonio IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ativos_status_ciclo ON public.ativos (status_ciclo_vida);
CREATE INDEX IF NOT EXISTS idx_ativos_usuario_resp ON public.ativos (usuario_responsavel_id);

-- Índices trigram para buscas ilike com wildcard em Ativos
CREATE INDEX IF NOT EXISTS idx_ativos_hostname_trgm ON public.ativos USING gin (hostname gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ativos_patrimonio_trgm ON public.ativos USING gin (numero_patrimonio gin_trgm_ops);

-- 3. Tabela ALOCACOES
CREATE INDEX IF NOT EXISTS idx_alocacoes_ativo_status ON public.alocacoes (ativo_id, data_fim);
CREATE INDEX IF NOT EXISTS idx_alocacoes_licenca_status ON public.alocacoes (licenca_id, data_fim);
CREATE INDEX IF NOT EXISTS idx_alocacoes_usuario_status ON public.alocacoes (usuario_id, data_fim);
CREATE INDEX IF NOT EXISTS idx_alocacoes_chave_id ON public.alocacoes (chave_id) WHERE chave_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alocacoes_ativas_only ON public.alocacoes (id) WHERE data_fim IS NULL;
CREATE INDEX IF NOT EXISTS idx_alocacoes_data_inicio_desc ON public.alocacoes (data_inicio DESC);

-- 4. Tabela LICENSES (Chaves de Licença)
CREATE INDEX IF NOT EXISTS idx_licenses_status_software ON public.licenses (status, lower(software));
CREATE INDEX IF NOT EXISTS idx_licenses_chave_lower ON public.licenses (lower(chave_ativacao));
CREATE INDEX IF NOT EXISTS idx_licenses_licenca_status ON public.licenses (licenca_id, status) WHERE licenca_id IS NOT NULL;

-- Índice trigram para busca rápida de chaves e software
CREATE INDEX IF NOT EXISTS idx_licenses_chave_trgm ON public.licenses USING gin (chave_ativacao gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_licenses_software_trgm ON public.licenses USING gin (software gin_trgm_ops);

-- 5. Tabela LICENCAS e PRODUTOS
CREATE INDEX IF NOT EXISTS idx_licencas_produto_id ON public.licencas (produto_id);
CREATE INDEX IF NOT EXISTS idx_produtos_catalogo_nome_lower ON public.produtos_catalogo (lower(nome_oficial));
