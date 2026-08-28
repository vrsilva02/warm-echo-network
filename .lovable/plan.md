# Tipo e Categoria de ativos como catálogo editável

Hoje as listas de Tipo e Categoria em Ativos são fixas no código (`src/lib/ativos-opcoes.ts`). Elas passarão a vir do banco, e Admin/Gestão poderão criar novas opções direto no formulário de "Novo ativo".

## O que muda para o usuário

- No formulário de ativo (novo ou edição), os campos **Tipo** e **Categoria** continuam com busca, mas a lista vem do catálogo do sistema.
- Ao digitar um valor que não existe, aparece a opção **"Criar 'XYZ'"** — disponível apenas para Admin e Gestão. Ao confirmar, a opção é salva no catálogo e já fica selecionada, ficando disponível para todos daí em diante.
- Perfis sem permissão de escrita continuam apenas visualizando; o botão "Novo ativo" e a criação de opções ficam ocultos para eles.
- Valores antigos já gravados em ativos continuam funcionando: são importados para o catálogo na migração, então nada some das listas nem dos filtros.
- A importação em massa de ativos (.xlsx) passa a aceitar tipos/categorias novos, cadastrando-os automaticamente no catálogo quando quem importa é Admin/Gestão.

## Banco de dados

Duas novas tabelas de catálogo:

- `ativos_tipos` — nome (único, sem diferenciar maiúsculas), ativo (sim/não), datas de criação/atualização.
- `ativos_categorias` — mesma estrutura.

Regras de acesso:
- Qualquer usuário autenticado com permissão de leitura enxerga as opções.
- Somente Admin e Gestão podem criar, alterar ou remover opções (via `is_gestor_or_admin`).
- Grants para `authenticated` e `service_role`, RLS habilitada, trigger de `updated_at` e trigger de auditoria (mesmo padrão das demais tabelas).

Carga inicial na própria migração: as 12 opções de Tipo e as 9 de Categoria já existentes no código, mais todos os valores distintos já gravados na tabela `ativos` que não estejam nessa lista.

## Detalhes técnicos

- `src/lib/ativos-opcoes.ts`: mantém as listas apenas como semente/fallback e ganha hooks `useAtivoTipos()` / `useAtivoCategorias()` (React Query) que leem as tabelas, com `useRealtimeInvalidate` para refletir novas opções em outras abas.
- Novo componente `src/components/combobox-creatable.tsx` (baseado no `Combobox` atual): mostra o item "Criar 'termo'" quando a busca não casa com nenhuma opção e `allowCreate` é verdadeiro; chama `onCreate(nome)` e seleciona o valor retornado.
- `src/routes/_authenticated/ativos.tsx`: substitui os dois `Combobox` de tipo/categoria pelo novo componente, com `allowCreate={canWrite}`; a criação faz `insert` na tabela do catálogo, invalida a query e trata conflito de nome duplicado reaproveitando o registro existente.
- Filtros e visões ("Sem tipo", "Sem categoria") passam a montar as opções a partir do catálogo em vez das constantes.
- `src/components/ativos-import-export.tsx`: ao importar, resolve tipo/categoria contra o catálogo (case-insensitive) e cria as faltantes em lote antes de gravar os ativos.
- A coluna `ativos.tipo` / `ativos.categoria` continua texto livre no banco (sem FK), evitando quebrar importações e registros históricos.
