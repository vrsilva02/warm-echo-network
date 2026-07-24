
-- Contratos: substituir políticas parciais do gestor por ALL (insert/update/delete)
DROP POLICY IF EXISTS gestor_contratos_insert ON public.contratos;
DROP POLICY IF EXISTS gestor_contratos_update ON public.contratos;
CREATE POLICY gestor_write ON public.contratos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestor_ti'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestor_ti'::app_role));

-- auditoria_log: gestão NÃO escreve (somente admin). Mantém read para todos autorizados.
-- (nenhuma mudança necessária, já é admin_all + read_all_authorized)

-- Garantir que admin tem ALL em todas as tabelas públicas de negócio (já existe admin_all onde aplicável).
-- Assegurar gestor_write em produtos_aliases, inventario_importado, ativos_historico_status (já existem).
