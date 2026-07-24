# Plano — Sistema ITAM/SAM (Fase 1)

Vou construir em **duas fases**. Esta é a Fase 1 (base sólida + fluxos principais). Fase 2 fica para depois que você validar.

## O que entra na Fase 1

**Base**
- Habilitar Lovable Cloud (banco + auth integrados).
- Login/cadastro por email + senha, tela `/auth`.
- Perfil básico do operador (`profiles`: id, nome, email) criado automaticamente no signup.
- Sistema de papéis (`user_roles` separada, com enum `admin | gestor_ti | auditoria` e função `has_role`) — padrão seguro anti-escalonamento de privilégio.
- Layout com sidebar fixa (Dashboard, Ativos, Usuários, Contratos, Licenças, Alocações, Reconciliação, Alertas, Auditoria, Relatórios) — módulos da Fase 2 aparecem desabilitados com badge "em breve".
- Rotas protegidas em `_authenticated/`.

**Schema** — aplico o seu SQL completo como migration versionada, adicionando `GRANT` corretos e políticas RLS por papel:
- Admin: tudo.
- Gestor TI: leitura geral + escrita em `ativos`, `usuarios`, `alocacoes`, `licencas`, `inventario_importado`; sem `DELETE` em `contratos`.
- Auditoria: só `SELECT` em tudo (inclusive `auditoria_log`).

**Módulos funcionais (Fase 1)**

1. **Dashboard** — KPIs (licenças por categoria, % compliance, contratos vencendo 30d, licenças ociosas), gráfico de barras compradas × alocadas (via `vw_elp`), gráfico de pizza de ativos por ciclo de vida, tabela ELP com semáforo verde/amarelo/vermelho.
2. **Ativos (ITAM)** — CRUD, timeline visual do ciclo de vida, modal de confirmação ao baixar (avisando que libera licenças via trigger), histórico por ativo lido de `ativos_historico_status`.
3. **Usuários (colaboradores)** — CRUD, ao marcar "desligado" mostra quais alocações foram liberadas pela trigger.
4. **Catálogo / Contratos / Licenças** — CRUD dos três, com sub-tabela de aliases dentro do produto.
5. **Alocações** — tela para alocar licença → ativo e/ou usuário, tela para encerrar (preenche `data_fim`), alerta visual (não bloqueante) quando o saldo do produto está em déficit.

**Design**
- Estilo dashboard corporativo (referência ServiceNow/Flexera): neutro, denso, muita tabela.
- Tokens semânticos em `src/styles.css` (não uso `text-white`/`bg-black` direto).
- Cores de status: verde `success`, amarelo `warning`, vermelho `destructive`.
- Tabelas com busca, filtros e paginação (shadcn `Table` + `Input`).

## O que fica para a Fase 2

- Reconciliação (upload CSV + matching por alias + relatório de divergências).
- Painel de Alertas consolidado (usa `vw_contratos_vencendo` e `vw_licencas_ociosas`).
- Log de Auditoria (tela leitura + filtros) + triggers de auditoria escrevendo em `auditoria_log`.
- Exportação CSV (ELP e ativos).

## Detalhes técnicos

- Stack: TanStack Start + React + Tailwind v4 + shadcn/ui + TanStack Query, Supabase (via Lovable Cloud) para banco/auth.
- Migration única aplica: seu schema + `GRANT`s + `ALTER ... ENABLE ROW LEVEL SECURITY` em todas as 11 tabelas + policies por papel usando `has_role()` (security definer, evita recursão) + tabela `profiles` + trigger `handle_new_user` que cria profile no signup + tabela `user_roles` + enum `app_role`.
- Views (`vw_elp`, `vw_contratos_vencendo`, `vw_licencas_ociosas`) criadas com `security_invoker=on` para respeitarem RLS de quem consulta.
- Papel inicial: o **primeiro usuário cadastrado vira `admin` automaticamente**; os próximos entram como `auditoria` até um admin promover — evita ficar travado sem admin no primeiro login. Se preferir outro comportamento (ex: só convite), me avise.
- Client Supabase via `@/integrations/supabase/client` para leituras/escrituras respeitando RLS; sem edge functions nesta fase.
- Sem dados de exemplo (seed) — começamos com base vazia. Se quiser fixtures de demonstração, me diga.

## Primeira entrega desta fase

Ao aprovar, eu executo nesta ordem:
1. Habilitar Lovable Cloud.
2. Rodar a migration (schema + RLS + profiles + roles).
3. Tela `/auth` + gate `_authenticated`.
4. Layout com sidebar + Dashboard (com dados reais das views).
5. CRUDs de Ativos, Usuários, Produtos/Contratos/Licenças, Alocações.

Pode aprovar?