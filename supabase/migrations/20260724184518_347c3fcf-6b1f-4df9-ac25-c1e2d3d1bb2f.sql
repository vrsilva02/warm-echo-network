-- Trigger de auditoria em user_roles: registra conceder/revogar perfis com quem fez a alteração
CREATE TRIGGER trg_audit_user_roles
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();