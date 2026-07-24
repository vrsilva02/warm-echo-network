
-- =========================================
-- 1) AUTH: profiles, roles, has_role, trigger
-- =========================================

create type public.app_role as enum ('admin','gestor_ti','auditoria');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_user_id, 'admin');
$$;

create or replace function public.is_gestor_or_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_user_id, 'admin') or public.has_role(_user_id, 'gestor_ti');
$$;

create or replace function public.can_read(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_user_id, 'admin')
      or public.has_role(_user_id, 'gestor_ti')
      or public.has_role(_user_id, 'auditoria');
$$;

-- Profiles policies
create policy "profiles self select" on public.profiles for select to authenticated
  using (id = auth.uid() or public.can_read(auth.uid()));
create policy "profiles self update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles admin insert" on public.profiles for insert to authenticated
  with check (id = auth.uid());

-- user_roles policies (leitura pra quem pode ler; escrita só admin)
create policy "user_roles read" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.can_read(auth.uid()));
create policy "user_roles admin write" on public.user_roles for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Trigger: on new auth user -> create profile + assign role (first = admin, others = auditoria)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
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
    insert into public.user_roles (user_id, role) values (new.id, 'auditoria');
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =========================================
-- 2) SCHEMA DE NEGÓCIO
-- =========================================

create table public.fabricantes (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  created_at timestamptz default now()
);

create table public.usuarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text unique,
  setor text,
  matricula text,
  status text not null default 'ativo' check (status in ('ativo','desligado')),
  data_desligamento date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.produtos_catalogo (
  id uuid primary key default gen_random_uuid(),
  nome_oficial text not null,
  fabricante_id uuid references public.fabricantes(id),
  categoria text not null check (categoria in ('Windows','Office','EDR','Outro')),
  modelo_licenciamento text not null check (modelo_licenciamento in ('dispositivo','usuario','core','concorrente')),
  tipo_licenciamento text not null check (tipo_licenciamento in ('OEM','Volume','Retail','Assinatura','Perpetua')),
  created_at timestamptz default now()
);

create table public.produtos_aliases (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid references public.produtos_catalogo(id) on delete cascade,
  alias text not null,
  created_at timestamptz default now()
);

create table public.ativos (
  id uuid primary key default gen_random_uuid(),
  hostname text not null,
  tipo text not null check (tipo in ('desktop','notebook','servidor','vm','outro')),
  numero_serie text,
  setor text,
  usuario_responsavel_id uuid references public.usuarios(id),
  status_ciclo_vida text not null default 'solicitado'
    check (status_ciclo_vida in ('solicitado','estoque','em_uso','manutencao','baixado')),
  data_ultima_transicao timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.ativos_historico_status (
  id uuid primary key default gen_random_uuid(),
  ativo_id uuid references public.ativos(id) on delete cascade,
  status_anterior text,
  status_novo text not null,
  data_transicao timestamptz default now(),
  observacao text
);

create table public.contratos (
  id uuid primary key default gen_random_uuid(),
  fornecedor text not null,
  numero_contrato text,
  tipo_contrato text check (tipo_contrato in ('CSP','EA','NCE','Open Value','Perpetua','Outro')),
  data_inicio date not null,
  data_fim date,
  quantidade_seats integer not null default 0,
  valor_total numeric(14,2),
  created_at timestamptz default now()
);

create table public.licencas (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid references public.produtos_catalogo(id),
  contrato_id uuid references public.contratos(id),
  quantidade integer not null default 1,
  chave_ativacao text,
  data_expiracao date,
  created_at timestamptz default now()
);

create table public.alocacoes (
  id uuid primary key default gen_random_uuid(),
  licenca_id uuid references public.licencas(id),
  ativo_id uuid references public.ativos(id),
  usuario_id uuid references public.usuarios(id),
  data_inicio timestamptz default now(),
  data_fim timestamptz,
  observacao text,
  created_at timestamptz default now()
);

create table public.inventario_importado (
  id uuid primary key default gen_random_uuid(),
  origem text not null,
  hostname text,
  produto_nome_bruto text not null,
  produto_id uuid references public.produtos_catalogo(id),
  data_importacao timestamptz default now(),
  data_ultima_comunicacao timestamptz,
  reconciliado boolean default false
);

create table public.auditoria_log (
  id uuid primary key default gen_random_uuid(),
  tabela_afetada text not null,
  registro_id uuid,
  acao text not null check (acao in ('insert','update','delete')),
  valor_anterior jsonb,
  valor_novo jsonb,
  usuario_sistema text,
  created_at timestamptz default now()
);

-- =========================================
-- 3) GRANTS
-- =========================================
grant select, insert, update, delete on
  public.fabricantes, public.usuarios, public.produtos_catalogo, public.produtos_aliases,
  public.ativos, public.ativos_historico_status, public.contratos, public.licencas,
  public.alocacoes, public.inventario_importado, public.auditoria_log
to authenticated;

grant all on
  public.fabricantes, public.usuarios, public.produtos_catalogo, public.produtos_aliases,
  public.ativos, public.ativos_historico_status, public.contratos, public.licencas,
  public.alocacoes, public.inventario_importado, public.auditoria_log
to service_role;

-- =========================================
-- 4) RLS + POLICIES por papel
-- =========================================
alter table public.fabricantes enable row level security;
alter table public.usuarios enable row level security;
alter table public.produtos_catalogo enable row level security;
alter table public.produtos_aliases enable row level security;
alter table public.ativos enable row level security;
alter table public.ativos_historico_status enable row level security;
alter table public.contratos enable row level security;
alter table public.licencas enable row level security;
alter table public.alocacoes enable row level security;
alter table public.inventario_importado enable row level security;
alter table public.auditoria_log enable row level security;

-- Padrão: SELECT para qualquer papel autenticado com role atribuída
do $$
declare t text;
begin
  foreach t in array array[
    'fabricantes','usuarios','produtos_catalogo','produtos_aliases',
    'ativos','ativos_historico_status','contratos','licencas',
    'alocacoes','inventario_importado','auditoria_log'
  ] loop
    execute format($f$create policy "read_all_authorized" on public.%I for select to authenticated using (public.can_read(auth.uid()));$f$, t);
  end loop;
end$$;

-- Admin: escrita total em todas as tabelas
do $$
declare t text;
begin
  foreach t in array array[
    'fabricantes','usuarios','produtos_catalogo','produtos_aliases',
    'ativos','ativos_historico_status','contratos','licencas',
    'alocacoes','inventario_importado','auditoria_log'
  ] loop
    execute format($f$create policy "admin_all" on public.%I for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));$f$, t);
  end loop;
end$$;

-- Gestor TI: INSERT/UPDATE/DELETE em operacionais (sem contratos/auditoria)
do $$
declare t text;
begin
  foreach t in array array[
    'ativos','usuarios','alocacoes','licencas','produtos_catalogo',
    'produtos_aliases','fabricantes','inventario_importado','ativos_historico_status'
  ] loop
    execute format($f$create policy "gestor_write" on public.%I for all to authenticated using (public.has_role(auth.uid(),'gestor_ti')) with check (public.has_role(auth.uid(),'gestor_ti'));$f$, t);
  end loop;
end$$;

-- Contratos: gestor pode ler/inserir/atualizar mas NÃO deletar
create policy "gestor_contratos_insert" on public.contratos for insert to authenticated
  with check (public.has_role(auth.uid(),'gestor_ti'));
create policy "gestor_contratos_update" on public.contratos for update to authenticated
  using (public.has_role(auth.uid(),'gestor_ti')) with check (public.has_role(auth.uid(),'gestor_ti'));

-- =========================================
-- 5) TRIGGERS DE AUTOMAÇÃO
-- =========================================
create or replace function public.fn_liberar_licencas_ativo_baixado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status_ciclo_vida = 'baixado' and old.status_ciclo_vida is distinct from 'baixado' then
    update public.alocacoes
      set data_fim = now(),
          observacao = coalesce(observacao,'') || ' | liberado automaticamente (ativo baixado)'
      where ativo_id = new.id and data_fim is null;

    insert into public.ativos_historico_status (ativo_id, status_anterior, status_novo, observacao)
    values (new.id, old.status_ciclo_vida, new.status_ciclo_vida, 'Baixa automática - licenças liberadas');
  end if;
  return new;
end;
$$;

create trigger trg_liberar_licencas_ativo
after update on public.ativos
for each row execute function public.fn_liberar_licencas_ativo_baixado();

create or replace function public.fn_liberar_licencas_usuario_desligado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'desligado' and old.status is distinct from 'desligado' then
    update public.alocacoes
      set data_fim = now(),
          observacao = coalesce(observacao,'') || ' | liberado automaticamente (usuário desligado)'
      where usuario_id = new.id and data_fim is null;
  end if;
  return new;
end;
$$;

create trigger trg_liberar_licencas_usuario
after update on public.usuarios
for each row execute function public.fn_liberar_licencas_usuario_desligado();

-- updated_at helper
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger set_updated_at_ativos before update on public.ativos
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at_usuarios before update on public.usuarios
  for each row execute function public.tg_set_updated_at();

-- =========================================
-- 6) VIEWS (security_invoker on)
-- =========================================
create view public.vw_elp with (security_invoker = on) as
select
  pc.id as produto_id,
  pc.nome_oficial,
  pc.categoria,
  f.nome as fabricante,
  coalesce(sum(l.quantidade), 0) as licencas_compradas,
  count(distinct a.id) filter (where a.data_fim is null) as licencas_alocadas,
  coalesce(sum(l.quantidade), 0) - count(distinct a.id) filter (where a.data_fim is null) as saldo,
  case
    when coalesce(sum(l.quantidade), 0) - count(distinct a.id) filter (where a.data_fim is null) < 0 then 'deficit'
    when coalesce(sum(l.quantidade), 0) > 0
      and coalesce(sum(l.quantidade), 0) - count(distinct a.id) filter (where a.data_fim is null) > (coalesce(sum(l.quantidade),0) * 0.2) then 'ocioso'
    else 'ok'
  end as status_compliance
from public.produtos_catalogo pc
left join public.fabricantes f on f.id = pc.fabricante_id
left join public.licencas l on l.produto_id = pc.id
left join public.alocacoes a on a.licenca_id = l.id
group by pc.id, pc.nome_oficial, pc.categoria, f.nome;

create view public.vw_contratos_vencendo with (security_invoker = on) as
select
  c.*,
  (c.data_fim - current_date) as dias_para_vencer,
  case
    when (c.data_fim - current_date) <= 30 then 'critico'
    when (c.data_fim - current_date) <= 60 then 'atencao'
    when (c.data_fim - current_date) <= 90 then 'alerta'
    else 'ok'
  end as urgencia
from public.contratos c
where c.data_fim is not null
  and c.data_fim >= current_date;

create view public.vw_licencas_ociosas with (security_invoker = on) as
select
  l.id as licenca_id,
  pc.nome_oficial,
  l.quantidade,
  max(a.data_fim) as ultima_desalocacao
from public.licencas l
join public.produtos_catalogo pc on pc.id = l.produto_id
left join public.alocacoes a on a.licenca_id = l.id
group by l.id, pc.nome_oficial, l.quantidade
having max(a.data_fim) < (now() - interval '90 days') or max(a.data_fim) is null;

grant select on public.vw_elp, public.vw_contratos_vencendo, public.vw_licencas_ociosas to authenticated;
