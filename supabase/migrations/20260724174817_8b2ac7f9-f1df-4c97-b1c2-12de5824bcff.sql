
-- Fix search_path warning
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

-- Revoga execução pública/anon nas funções SECURITY DEFINER internas
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.fn_liberar_licencas_ativo_baixado() from public, anon, authenticated;
revoke execute on function public.fn_liberar_licencas_usuario_desligado() from public, anon, authenticated;
revoke execute on function public.tg_set_updated_at() from public, anon;
revoke execute on function public.is_admin(uuid) from public, anon;
revoke execute on function public.is_gestor_or_admin(uuid) from public, anon;
revoke execute on function public.can_read(uuid) from public, anon;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
