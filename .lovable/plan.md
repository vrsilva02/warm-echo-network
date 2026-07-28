# Plano — CMDB, TCO e Gap EDR no GestoraIT

Aproveita o schema já aplicado (`servicos`, `ativos_servicos`, `ativos_relacionamentos`, `centros_custo`, `vw_tco_ativo`, `vw_custo_ociosas`, `vw_gap_edr`) e mantém design system (slate + cores semânticas) e RLS por perfil (Admin/Gestor/Auditoria).

## 1. Módulo Serviços de Negócio

Novas rotas em `src/routes/_authenticated/`:

- `servicos.tsx` — lista (AdvancedTable) com nome, criticidade (StatusPill: baixa/média/alta/crítica), responsável, nº de ativos vinculados. Ações Novo/Editar/Excluir para Admin/Gestor.
- `servicos_.$id.tsx` — ficha do serviço:
  - Cabeçalho com criticidade e responsável.
  - Lista de ativos vinculados (join `ativos_servicos` + `ativos`); linha destacada em âmbar quando `em_manutencao` e em vermelho quando `baixado`, com banner "Risco ao serviço: N ativo(s) fora de operação".
  - Diálogo "Vincular ativo" (Combobox de ativos + tipo `hospeda/suporta/depende_de`).

Ficha do ativo — novo arquivo `ativos_.$id.tsx` (ficha 360°, já que hoje só existe listagem):

- Cabeçalho + dados básicos.
- Seção **Serviços dependentes**: chips com nome + tipo de dependência; ação vincular/desvincular.
- Seção **Topologia** (mini-árvore, `ativos_relacionamentos`): filhos deste ativo agrupados por `tipo_relacao` (hospeda_vm/conecta/depende_de). Renderizada com lista recursiva simples (`<ul>` aninhado, ícone `Server`/`ServerCog`); ações "Adicionar filho"/"Remover" para Admin/Gestor.
- Card **TCO estimado** (item 3).
- Botão "Ver ficha" adicionado a cada linha em `ativos.tsx` linkando para `/ativos/{id}`.

## 2. Centro de Custo

- Nova rota `centros-custo.tsx` (CRUD simples nome/código) — visível no menu Administração.
- Adicionar `centro_custo_id` (Combobox) nos formulários em `ativos.tsx` e `contratos.tsx`, coluna opcional nas tabelas.
- Novo relatório em `relatorios.tsx`: aba "Custo de TI por centro de custo":
  - Query agregando `ativos.valor_aquisicao` + soma de `licencas.custo_unitario * 12` das licenças alocadas em ativos daquele centro (ou diretamente vinculadas a contratos do centro).
  - Tabela com colunas: Centro, Ativos (nº e R$), Licenças/ano (R$), Total anual.
  - Botão "Exportar CSV" reutilizando `src/lib/export.ts`.

## 3. Painel de TCO

- Ficha do ativo: card com `valor_aquisicao`, `valor_residual`, `custo_licencas_mensal`, `tco_anual_estimado` (de `vw_tco_ativo`), formatados em moeda BRL com números tabulares.
- Dashboard (`dashboard.tsx`):
  - Novo KPI **Custo mensal em licenças ociosas** somando `vw_custo_ociosas.custo_mensal_desperdicado`. Limite configurável em `localStorage` (`gestorait.ociosas.limit`, padrão R$ 5.000) editável via popover; badge âmbar/vermelho ao ultrapassar.
  - Gráfico de barras **TCO por centro de custo (Top 5)** usando Recharts (já disponível). Agregar `vw_tco_ativo.tco_anual_estimado` join `ativos.centro_custo_id`.

## 4. Gap de Cobertura EDR

- Dashboard: novo card **Ativos sem cobertura EDR** (contagem de `vw_gap_edr`), tom vermelho quando > 0, link para /alertas?tipo=edr.
- `alertas.tsx`: nova aba/filtro "EDR" listando `vw_gap_edr` (hostname, setor, status). Ação "Vincular EDR agora" abre modal reutilizando fluxo de `alocacoes` pré-preenchido com o primeiro produto de `produtos_catalogo.categoria = 'EDR'` e o ativo selecionado.
- Listagem de ativos (`ativos.tsx`): buscar set de `vw_gap_edr` em paralelo e exibir ícone `ShieldAlert` vermelho ao lado do hostname para ativos presentes na view (tooltip "Sem cobertura EDR").

## Detalhes técnicos

- Todas as queries via `@tanstack/react-query` + client browser (`@/integrations/supabase/client`); RLS já cobre visibilidade.
- Novos tipos declarados inline (Supabase types.ts é gerado; usar `as unknown as` para views se necessário).
- Escrita (insert/update/delete) só quando `canWrite`/`isAdmin` do `useAuth`.
- Registrar `logAction` para vínculos/desvínculos em serviços, relacionamentos e vinculação de EDR.
- Rotas dinâmicas seguem convenção existente: `ativos_.$id.tsx` e `servicos_.$id.tsx` (padrão usado em `auditoria_.$tabela.$id.tsx`), com `createFileRoute("/_authenticated/ativos/$id")` e `.../servicos/$id`.
- Sidebar: adicionar "Serviços" em Operação; "Centros de custo" em Administração.

## Arquivos novos

- `src/routes/_authenticated/servicos.tsx`
- `src/routes/_authenticated/servicos_.$id.tsx`
- `src/routes/_authenticated/ativos_.$id.tsx`
- `src/routes/_authenticated/centros-custo.tsx`
- `src/components/tco-card.tsx`
- `src/components/edr-badge.tsx` (ícone reutilizável)

## Arquivos alterados

- `src/components/app-sidebar.tsx` — novos itens de menu.
- `src/routes/_authenticated/ativos.tsx` — coluna centro de custo, badge EDR, campo no form, link "ver ficha".
- `src/routes/_authenticated/contratos.tsx` — campo centro de custo.
- `src/routes/_authenticated/dashboard.tsx` — KPI ociosas, KPI EDR, gráfico TCO por centro.
- `src/routes/_authenticated/alertas.tsx` — aba EDR + modal vincular.
- `src/routes/_authenticated/relatorios.tsx` — relatório custo por centro.

Sem novas migrations — schema já pronto.