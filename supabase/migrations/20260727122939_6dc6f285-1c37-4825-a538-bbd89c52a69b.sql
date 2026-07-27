
-- alocacoes -> ativos/usuarios/licencas: cascade
ALTER TABLE public.alocacoes DROP CONSTRAINT IF EXISTS alocacoes_ativo_id_fkey;
ALTER TABLE public.alocacoes ADD CONSTRAINT alocacoes_ativo_id_fkey
  FOREIGN KEY (ativo_id) REFERENCES public.ativos(id) ON DELETE CASCADE;

ALTER TABLE public.alocacoes DROP CONSTRAINT IF EXISTS alocacoes_usuario_id_fkey;
ALTER TABLE public.alocacoes ADD CONSTRAINT alocacoes_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;

ALTER TABLE public.alocacoes DROP CONSTRAINT IF EXISTS alocacoes_licenca_id_fkey;
ALTER TABLE public.alocacoes ADD CONSTRAINT alocacoes_licenca_id_fkey
  FOREIGN KEY (licenca_id) REFERENCES public.licencas(id) ON DELETE CASCADE;

-- ativos_historico_status -> ativos
ALTER TABLE public.ativos_historico_status DROP CONSTRAINT IF EXISTS ativos_historico_status_ativo_id_fkey;
ALTER TABLE public.ativos_historico_status ADD CONSTRAINT ativos_historico_status_ativo_id_fkey
  FOREIGN KEY (ativo_id) REFERENCES public.ativos(id) ON DELETE CASCADE;

-- ativos -> usuarios (set null so deleting user doesn't nuke ativo)
ALTER TABLE public.ativos DROP CONSTRAINT IF EXISTS ativos_usuario_responsavel_id_fkey;
ALTER TABLE public.ativos ADD CONSTRAINT ativos_usuario_responsavel_id_fkey
  FOREIGN KEY (usuario_responsavel_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;

-- licencas -> produtos/contratos
ALTER TABLE public.licencas DROP CONSTRAINT IF EXISTS licencas_produto_id_fkey;
ALTER TABLE public.licencas ADD CONSTRAINT licencas_produto_id_fkey
  FOREIGN KEY (produto_id) REFERENCES public.produtos_catalogo(id) ON DELETE CASCADE;

ALTER TABLE public.licencas DROP CONSTRAINT IF EXISTS licencas_contrato_id_fkey;
ALTER TABLE public.licencas ADD CONSTRAINT licencas_contrato_id_fkey
  FOREIGN KEY (contrato_id) REFERENCES public.contratos(id) ON DELETE CASCADE;

-- contratos_aditivos -> contratos
ALTER TABLE public.contratos_aditivos DROP CONSTRAINT IF EXISTS contratos_aditivos_contrato_id_fkey;
ALTER TABLE public.contratos_aditivos ADD CONSTRAINT contratos_aditivos_contrato_id_fkey
  FOREIGN KEY (contrato_id) REFERENCES public.contratos(id) ON DELETE CASCADE;

-- produtos_aliases -> produtos
ALTER TABLE public.produtos_aliases DROP CONSTRAINT IF EXISTS produtos_aliases_produto_id_fkey;
ALTER TABLE public.produtos_aliases ADD CONSTRAINT produtos_aliases_produto_id_fkey
  FOREIGN KEY (produto_id) REFERENCES public.produtos_catalogo(id) ON DELETE CASCADE;

-- produtos_catalogo -> fabricantes (set null)
ALTER TABLE public.produtos_catalogo DROP CONSTRAINT IF EXISTS produtos_catalogo_fabricante_id_fkey;
ALTER TABLE public.produtos_catalogo ADD CONSTRAINT produtos_catalogo_fabricante_id_fkey
  FOREIGN KEY (fabricante_id) REFERENCES public.fabricantes(id) ON DELETE SET NULL;

-- ativos/contratos -> unidades (set null)
ALTER TABLE public.ativos DROP CONSTRAINT IF EXISTS ativos_unidade_id_fkey;
ALTER TABLE public.ativos ADD CONSTRAINT ativos_unidade_id_fkey
  FOREIGN KEY (unidade_id) REFERENCES public.unidades(id) ON DELETE SET NULL;

ALTER TABLE public.contratos DROP CONSTRAINT IF EXISTS contratos_unidade_id_fkey;
ALTER TABLE public.contratos ADD CONSTRAINT contratos_unidade_id_fkey
  FOREIGN KEY (unidade_id) REFERENCES public.unidades(id) ON DELETE SET NULL;

-- inventario_importado -> produtos (set null)
ALTER TABLE public.inventario_importado DROP CONSTRAINT IF EXISTS inventario_importado_produto_id_fkey;
ALTER TABLE public.inventario_importado ADD CONSTRAINT inventario_importado_produto_id_fkey
  FOREIGN KEY (produto_id) REFERENCES public.produtos_catalogo(id) ON DELETE SET NULL;
