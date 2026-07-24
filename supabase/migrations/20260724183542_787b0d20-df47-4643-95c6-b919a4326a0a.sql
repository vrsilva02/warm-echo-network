
-- Trigger genérico de auditoria
create or replace function public.fn_audit_log()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_user text;
  v_id uuid;
begin
  select coalesce(p.email, auth.uid()::text) into v_user
  from public.profiles p where p.id = auth.uid();

  if (tg_op = 'DELETE') then
    v_id := (row_to_json(old)->>'id')::uuid;
    insert into public.auditoria_log(acao, tabela_afetada, registro_id, usuario_sistema, valor_anterior, valor_novo)
    values ('DELETE', tg_table_name, v_id, coalesce(v_user,'sistema'), row_to_json(old)::jsonb, null);
    return old;
  elsif (tg_op = 'UPDATE') then
    v_id := (row_to_json(new)->>'id')::uuid;
    insert into public.auditoria_log(acao, tabela_afetada, registro_id, usuario_sistema, valor_anterior, valor_novo)
    values ('UPDATE', tg_table_name, v_id, coalesce(v_user,'sistema'), row_to_json(old)::jsonb, row_to_json(new)::jsonb);
    return new;
  else
    v_id := (row_to_json(new)->>'id')::uuid;
    insert into public.auditoria_log(acao, tabela_afetada, registro_id, usuario_sistema, valor_anterior, valor_novo)
    values ('INSERT', tg_table_name, v_id, coalesce(v_user,'sistema'), null, row_to_json(new)::jsonb);
    return new;
  end if;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['ativos','usuarios','licencas','contratos','alocacoes','produtos_catalogo','fabricantes']
  loop
    execute format('drop trigger if exists trg_audit_%1$s on public.%1$s', t);
    execute format('create trigger trg_audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.fn_audit_log()', t);
  end loop;
end $$;
