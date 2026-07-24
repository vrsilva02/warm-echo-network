-- Migra usuários existentes: auditoria -> visitante
UPDATE public.user_roles SET role = 'visitante' WHERE role = 'auditoria';

-- Atualiza função de leitura para incluir os novos perfis
CREATE OR REPLACE FUNCTION public.can_read(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.has_role(_user_id, 'admin')
      or public.has_role(_user_id, 'gestor_ti')
      or public.has_role(_user_id, 'auditoria')
      or public.has_role(_user_id, 'padrao')
      or public.has_role(_user_id, 'visitante');
$function$;

-- Novo padrão para cadastros: primeiro vira admin, demais viram visitante
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_count int;
begin
  insert into public.profiles (id, nome, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email), new.email)
  on conflict (id) do nothing;

  select count(*) into v_count from public.user_roles;
  if v_count = 0 then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'visitante');
  end if;
  return new;
end;
$function$;