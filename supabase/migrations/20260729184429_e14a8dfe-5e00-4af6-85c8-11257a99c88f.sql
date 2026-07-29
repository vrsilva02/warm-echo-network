-- Remove execução pública/anônima de funções internas
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- Reconcede apenas o necessário para usuários autenticados (RLS + chamadas do app)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_gestor_or_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tecnico(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_os(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_operate_os(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_log_action(text, text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_risco_compliance(text) TO authenticated;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;