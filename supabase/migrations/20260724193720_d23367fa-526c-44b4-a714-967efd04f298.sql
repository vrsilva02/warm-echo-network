
-- 1) CUSTO FINANCEIRO
alter table public.licencas add column if not exists custo_unitario numeric(12,2);
alter table public.contratos add column if not exists valor_total numeric(14,2);

create or replace view public.vw_ociosidade_financeira as
select
  p.id as produto_id,
  p.nome_oficial,
  p.categoria,
  count(distinct a.id) filter (where a.data_fim is null) as licencas_ociosas,
  coalesce(sum(l.custo_unitario) filter (where a.data_fim is null), 0) as valor_ocioso
from public.produtos_catalogo p
left join public.licencas l on l.produto_id = p.id
left join public.alocacoes a on a.licenca_id = l.id
  and a.data_fim is null
  and a.data_inicio < (now() - interval '90 days')
group by p.id, p.nome_oficial, p.categoria;

grant select on public.vw_ociosidade_financeira to authenticated;

-- 2) RISCO DE COMPLIANCE
alter table public.fabricantes
  add column if not exists criticidade smallint not null default 3
  check (criticidade between 1 and 5);

create or replace function public.fn_risco_compliance(_categoria text)
returns table(categoria text, deficit_pct numeric, criticidade_media numeric, score numeric)
language sql stable security definer set search_path = public
as $$
  with base as (
    select
      p.categoria,
      sum(greatest(0, e.licencas_alocadas - e.licencas_compradas))::numeric as excedente,
      nullif(sum(e.licencas_compradas), 0)::numeric as total,
      avg(coalesce(f.criticidade, 3))::numeric as crit
    from public.vw_elp e
    join public.produtos_catalogo p on p.id = e.produto_id
    left join public.fabricantes f on f.id = p.fabricante_id
    where (_categoria is null or p.categoria = _categoria)
    group by p.categoria
  )
  select
    b.categoria,
    coalesce(round((b.excedente / nullif(b.total,0)) * 100, 2), 0) as deficit_pct,
    round(b.crit, 2) as criticidade_media,
    least(100, round(coalesce((b.excedente / nullif(b.total,0)) * 100, 0) * (b.crit / 5.0), 2)) as score
  from base b;
$$;

-- 3) WORKFLOW DE APROVAÇÃO
do $$ begin
  create type public.solicitacao_status as enum ('pendente','aprovada','rejeitada','cancelada');
exception when duplicate_object then null; end $$;

create table if not exists public.solicitacoes_licenca (
  id uuid primary key default gen_random_uuid(),
  solicitante_id uuid not null references auth.users(id) on delete cascade,
  produto_id uuid not null references public.produtos_catalogo(id) on delete restrict,
  quantidade int not null check (quantidade > 0),
  justificativa text not null,
  status public.solicitacao_status not null default 'pendente',
  aprovador_id uuid references auth.users(id),
  decidido_em timestamptz,
  motivo_decisao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.solicitacoes_licenca to authenticated;
grant all on public.solicitacoes_licenca to service_role;

alter table public.solicitacoes_licenca enable row level security;

create policy "sol_read_all_auth" on public.solicitacoes_licenca
  for select to authenticated using (public.can_read(auth.uid()));
create policy "sol_insert_self" on public.solicitacoes_licenca
  for insert to authenticated with check (solicitante_id = auth.uid());
create policy "sol_update_owner_pending" on public.solicitacoes_licenca
  for update to authenticated
  using (solicitante_id = auth.uid() and status = 'pendente')
  with check (solicitante_id = auth.uid());
create policy "sol_manage_admin_gestor" on public.solicitacoes_licenca
  for update to authenticated
  using (public.is_gestor_or_admin(auth.uid()))
  with check (public.is_gestor_or_admin(auth.uid()));
create policy "sol_delete_admin" on public.solicitacoes_licenca
  for delete to authenticated using (public.is_admin(auth.uid()));

create trigger trg_sol_updated_at before update on public.solicitacoes_licenca
  for each row execute function public.tg_set_updated_at();
create trigger trg_sol_audit after insert or update or delete on public.solicitacoes_licenca
  for each row execute function public.fn_audit_log();

-- 4) ADITIVOS DE CONTRATO
do $$ begin
  create type public.aditivo_tipo as enum ('quantidade','prazo','valor','outro');
exception when duplicate_object then null; end $$;

create table if not exists public.contratos_aditivos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  numero text not null,
  tipo public.aditivo_tipo not null,
  delta_seats int default 0,
  delta_valor numeric(14,2) default 0,
  nova_data_fim date,
  descricao text,
  criado_por uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.contratos_aditivos to authenticated;
grant all on public.contratos_aditivos to service_role;

alter table public.contratos_aditivos enable row level security;

create policy "adt_read_all_auth" on public.contratos_aditivos
  for select to authenticated using (public.can_read(auth.uid()));
create policy "adt_write_admin_gestor" on public.contratos_aditivos
  for all to authenticated
  using (public.is_gestor_or_admin(auth.uid()))
  with check (public.is_gestor_or_admin(auth.uid()));

create trigger trg_adt_updated_at before update on public.contratos_aditivos
  for each row execute function public.tg_set_updated_at();
create trigger trg_adt_audit after insert or update or delete on public.contratos_aditivos
  for each row execute function public.fn_audit_log();

create or replace function public.fn_aplicar_aditivo()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.tipo = 'quantidade' and coalesce(new.delta_seats,0) <> 0 then
    update public.contratos
      set seats_totais = greatest(0, coalesce(seats_totais,0) + new.delta_seats)
      where id = new.contrato_id;
  end if;
  if new.tipo = 'prazo' and new.nova_data_fim is not null then
    update public.contratos set data_fim = new.nova_data_fim where id = new.contrato_id;
  end if;
  if new.tipo = 'valor' and coalesce(new.delta_valor,0) <> 0 then
    update public.contratos
      set valor_total = coalesce(valor_total,0) + new.delta_valor
      where id = new.contrato_id;
  end if;
  return new;
end;
$$;

create trigger trg_adt_apply after insert on public.contratos_aditivos
  for each row execute function public.fn_aplicar_aditivo();

-- 5) UNIDADE / FILIAL
create table if not exists public.unidades (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  codigo text unique,
  uf char(2),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.unidades to authenticated;
grant all on public.unidades to service_role;

alter table public.unidades enable row level security;

create policy "uni_read_all_auth" on public.unidades
  for select to authenticated using (public.can_read(auth.uid()));
create policy "uni_write_admin_gestor" on public.unidades
  for all to authenticated
  using (public.is_gestor_or_admin(auth.uid()))
  with check (public.is_gestor_or_admin(auth.uid()));

create trigger trg_uni_updated_at before update on public.unidades
  for each row execute function public.tg_set_updated_at();
create trigger trg_uni_audit after insert or update or delete on public.unidades
  for each row execute function public.fn_audit_log();

alter table public.ativos    add column if not exists unidade_id uuid references public.unidades(id) on delete set null;
alter table public.contratos add column if not exists unidade_id uuid references public.unidades(id) on delete set null;

create index if not exists idx_ativos_unidade on public.ativos(unidade_id);
create index if not exists idx_contratos_unidade on public.contratos(unidade_id);
create index if not exists idx_sol_status on public.solicitacoes_licenca(status);
create index if not exists idx_adt_contrato on public.contratos_aditivos(contrato_id);
