
-- Campos novos em licencas
alter table public.licencas add column if not exists tipo_ativacao text check (tipo_ativacao in ('chave_ativacao','arquivo_chave','assinatura'));
alter table public.licencas add column if not exists numero_certificado text;
alter table public.licencas add column if not exists limite_workstations integer;
alter table public.licencas add column if not exists limite_file_servers integer;
alter table public.licencas add column if not exists dias_carencia integer default 0;
alter table public.licencas add column if not exists politica_grupo text;

-- Subtipo em produtos_catalogo
alter table public.produtos_catalogo add column if not exists subtipo text;

-- Relatórios recorrentes
create table if not exists public.relatorios_recorrentes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null,
  filtros jsonb not null default '{}'::jsonb,
  frequencia text not null default 'mensal' check (frequencia in ('semanal','mensal','trimestral')),
  destinatarios text[] not null default '{}',
  formato text not null default 'pdf' check (formato in ('csv','pdf','ambos')),
  ativo boolean not null default true,
  ultimo_envio timestamptz,
  proximo_envio timestamptz,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.relatorios_recorrentes to authenticated;
grant all on public.relatorios_recorrentes to service_role;

alter table public.relatorios_recorrentes enable row level security;

create policy "leitura para autenticados"
  on public.relatorios_recorrentes for select
  using (public.can_read(auth.uid()));

create policy "gestao gerencia recorrentes"
  on public.relatorios_recorrentes for all
  using (public.is_gestor_or_admin(auth.uid()))
  with check (public.is_gestor_or_admin(auth.uid()));

create trigger tg_relatorios_recorrentes_updated_at
  before update on public.relatorios_recorrentes
  for each row execute function public.tg_set_updated_at();

create trigger tg_audit_relatorios_recorrentes
  after insert or update or delete on public.relatorios_recorrentes
  for each row execute function public.fn_audit_log();
