
# Refinamento ITAM/SAM — nível corporativo

Escopo grande. Vou entregar em **4 fases** para você validar incrementalmente. Cada fase é utilizável ao final.

---

## Fase 1 — Fundação visual e navegação

**Design system (src/styles.css)**
- Paleta neutra slate/zinc + **uma** cor de destaque (indigo) para ações primárias.
- Tokens semânticos exclusivos de status: `--status-ok`, `--status-warn`, `--status-critical`, `--status-neutral` — usados só em badges e KPIs.
- Fonte com `font-variant-numeric: tabular-nums` global para células numéricas; utilitário `.num` com alinhamento à direita.
- Remoção de gradientes decorativos coloridos existentes.

**Componentes base novos**
- `Breadcrumbs` automático a partir da rota (`src/components/breadcrumbs.tsx`).
- `StatusPill` (ícone + label, 4 variantes de status).
- `Skeleton` de tabela, card e formulário (substitui spinners).
- `EmptyState` ilustrado (SVG monocromático) com CTA por contexto.
- `CommandPalette` (Ctrl+K) com busca em ativos, colaboradores, licenças, contratos e navegação de páginas.

**Aplicação**
- Sidebar e header refinados (densidade menor, tipografia hierárquica).
- Todas as telas internas recebem breadcrumb + skeleton + empty state.

---

## Fase 2 — Tabelas corporativas

Refatorar `DataTable` (`src/components/data-table.tsx`) com TanStack Table:

- **Colunas configuráveis:** mostrar/ocultar, reordenar via drag. Persistido em `localStorage` por tabela.
- **Visualizações salvas:** presets nomeados de filtros por tela (ex.: "Licenças em déficit", "Contratos vencendo em 30d", "Ativos sem alocação"). Persistidos por usuário em `localStorage` (v1) — evita nova tabela pesada agora.
- **Seleção múltipla + bulk actions:**
  - Licenças/Alocações: desalocar em massa.
  - Ativos: baixar em massa (com preview de impacto).
  - Colaboradores: desligar em massa.
- **Export CSV respeita filtros ativos:** o botão exporta o dataset já filtrado/pesquisado da tela, não a query bruta.

---

## Fase 3 — Formulários e UX de ações

- Remover `window.confirm/alert` — substituir por **AlertDialog** com preview.
- **Preview de impacto** para ações destrutivas:
  - Baixar ativo → lista licenças que serão liberadas.
  - Desligar colaborador → lista licenças/ativos que serão liberados.
  - Excluir contrato → lista licenças órfãs.
- **Tooltips explicativos** em termos técnicos (licença ociosa, ELP, déficit, tipo de contrato, aditivo, unidade). Componente `HelpTooltip` reutilizável.
- **Autocomplete em relacionamentos:** `EntityCombobox` com busca server-side debounced (hostname parcial, nome parcial de colaborador, nome parcial de produto). Substitui os selects longos atuais em Alocações e Licenças.
- Toasts consistentes (sonner) para todas as mutações, com ação "desfazer" onde aplicável.

---

## Fase 4 — Novas funcionalidades de negócio

**Migration única** cobrindo:

1. **Custo financeiro**
   - `licencas.custo_unitario numeric(12,2)`, `contratos.valor_total numeric(14,2)`.
   - View `vw_ociosidade_financeira` (soma `custo_unitario` × licenças ociosas por produto).
   - Card novo no Dashboard: "Valor financeiro em licenças ociosas" + top 5 produtos.

2. **Score de risco de compliance (0–100) por categoria de produto**
   - `fabricantes.criticidade smallint` (1–5).
   - View/função `fn_risco_compliance(categoria)` combinando déficit (%) × criticidade do fabricante.
   - Nova aba "Risco" no Dashboard com heatmap por categoria.

3. **Workflow de aprovação de licenças**
   - Nova tabela `solicitacoes_licenca` com `status enum('pendente','aprovada','rejeitada','cancelada')`, `solicitante_id`, `produto_id`, `quantidade`, `justificativa`, `aprovador_id`, `decidido_em`, `motivo_decisao`.
   - RLS: qualquer autenticado cria; só **Admin** ou **Gestão** aprova/rejeita.
   - Tela `/solicitacoes` (lista + criar + aprovar). Badge com contagem no sidebar para aprovadores.
   - Ao aprovar: cria alocação/licença automaticamente conforme regra.

4. **Aditivos de contrato**
   - Nova tabela `contratos_aditivos` (`contrato_id`, `numero`, `tipo enum('quantidade','prazo','valor','outro')`, `delta_seats int`, `delta_valor numeric`, `nova_data_fim date`, `descricao`, `criado_por`).
   - Trigger opcional: ao inserir aditivo do tipo `quantidade`, incrementa `seats_totais` do contrato preservando histórico.
   - Aba "Histórico e aditivos" na tela de detalhes do contrato (timeline).

5. **Unidade/filial**
   - Nova tabela `unidades` (`nome`, `codigo`, `uf`, `ativo`).
   - `ativos.unidade_id`, `contratos.unidade_id` (nullable, FK).
   - Filtro global "Unidade" no Dashboard (dropdown no topo) — afeta KPIs, gráficos e alertas.
   - CRUD simples em Administração.

**Permissões (respeitando roles existentes)**
- Admin: tudo.
- Gestão: cria, edita, exclui, aprova solicitações, registra aditivos.
- Padrão/Visitante: leitura; podem **criar** solicitação de licença (própria), não aprovam.

---

## Detalhes técnicos

- **Stack:** mantém TanStack Start + Query + Supabase; nenhuma nova dependência pesada além de `@tanstack/react-table` (para tabelas) e `cmdk` (para command palette) — ambos leves.
- **Persistência de preferências de tabela:** `localStorage` chaveado por `tableId` + `userId` para não misturar entre contas na mesma máquina.
- **Migrations:** uma migration por fase (2 no total — fase 1/2/3 são só frontend, fase 4 tem SQL).
- **Sem quebra:** telas atuais continuam funcionando durante cada fase; adições são aditivas.
- **Compatibilidade:** views existentes (`vw_elp`, `vw_contratos_vencendo`, `vw_licencas_ociosas`) permanecem; novas views são adicionais.

---

## Ordem de entrega sugerida

1. Fase 1 (fundação visual) — impacto imediato visível.
2. Fase 2 (tabelas) — ganho de produtividade.
3. Fase 4 (negócio) — em paralelo com fase 3, pois requer migration.
4. Fase 3 (formulários/tooltips) — polimento final.

Confirma que posso seguir nessa ordem, ou prefere priorizar diferente (ex.: começar por workflow de aprovação)?
