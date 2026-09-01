create type public.license_tipo as enum ('OEM','Retail','Volume','CSP');
create type public.license_status as enum ('disponivel','alocada','expirada');

create table public.licenses (
  id uuid primary key default gen_random_uuid(),
  software text not null,
  chave_ativacao text not null unique,
  tipo_licenca public.license_tipo not null,
  status public.license_status not null default 'disponivel',
  ativo_id uuid references public.ativos(id) on delete set null,
  usuario_id uuid references public.usuarios(id) on delete set null,
  data_alocacao date,
  data_expiracao date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_licenses_software on public.licenses(software);
create index idx_licenses_status on public.licenses(status);
create index idx_licenses_ativo on public.licenses(ativo_id);
create index idx_licenses_usuario on public.licenses(usuario_id);

grant select, insert, update, delete on public.licenses to authenticated;
grant all on public.licenses to service_role;

alter table public.licenses enable row level security;

create policy "licenses_select" on public.licenses for select to authenticated
  using (public.can_read(auth.uid()));
create policy "licenses_insert" on public.licenses for insert to authenticated
  with check (public.is_gestor_or_admin(auth.uid()));
create policy "licenses_update" on public.licenses for update to authenticated
  using (public.is_gestor_or_admin(auth.uid())) with check (public.is_gestor_or_admin(auth.uid()));
create policy "licenses_delete" on public.licenses for delete to authenticated
  using (public.is_admin(auth.uid()));

create trigger tg_licenses_updated before update on public.licenses
  for each row execute function public.tg_set_updated_at();
create trigger trg_audit_licenses after insert or update or delete on public.licenses
  for each row execute function public.fn_audit_log();