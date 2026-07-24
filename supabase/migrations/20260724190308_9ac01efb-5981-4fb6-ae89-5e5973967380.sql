-- Relax check to allow application-level action types
ALTER TABLE public.auditoria_log DROP CONSTRAINT IF EXISTS auditoria_log_acao_check;
ALTER TABLE public.auditoria_log ADD CONSTRAINT auditoria_log_acao_check
  CHECK (acao IN ('INSERT','UPDATE','DELETE','EXPORT','BULK_UPDATE','BULK_DELETE','VIEW','LOGIN'));

-- SECURITY DEFINER function so authorized users can insert application audit entries
CREATE OR REPLACE FUNCTION public.fn_log_action(
  p_acao text,
  p_tabela text,
  p_registro_id uuid,
  p_metadata jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_user text;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.can_read(auth.uid()) then
    raise exception 'forbidden';
  end if;
  if p_acao not in ('EXPORT','BULK_UPDATE','BULK_DELETE','VIEW','LOGIN') then
    raise exception 'invalid action %', p_acao;
  end if;
  select coalesce(p.email, auth.uid()::text) into v_user
    from public.profiles p where p.id = auth.uid();

  insert into public.auditoria_log(acao, tabela_afetada, registro_id, usuario_sistema, valor_anterior, valor_novo)
  values (p_acao, p_tabela, p_registro_id, coalesce(v_user,'sistema'), null, p_metadata)
  returning id into v_id;
  return v_id;
end;
$$;

REVOKE ALL ON FUNCTION public.fn_log_action(text, text, uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.fn_log_action(text, text, uuid, jsonb) TO authenticated;