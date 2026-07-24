
do $$
declare fn text;
begin
  for fn in
    select p.oid::regprocedure::text
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef = true
      and p.proname in ('fn_audit_log','handle_new_user','fn_liberar_licencas_ativo','fn_liberar_licencas_usuario')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn);
  end loop;
end $$;
