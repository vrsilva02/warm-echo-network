# Sincronização manual — Ativos sem cobertura de EDR

## Objetivo
Ter um botão de sincronização manual no relatório "Ativos sem cobertura de EDR" que recarregue os dados na hora e atualize a lista exibida assim que terminar.

## Situação atual
A tela de Relatórios já tem um botão "Atualizar agora" genérico, mas ele só recarrega a consulta do relatório em cache. Para o EDR ele não força a releitura das tabelas de origem (ativos e alocações), então a lista pode continuar mostrando dados antigos logo após vincular um EDR.

## O que será feito
- Adicionar um botão "Sincronizar EDR agora" no cabeçalho do relatório de Ativos sem cobertura de EDR (aparece apenas nesse relatório).
- Ao clicar: invalidar os caches de ativos e alocações, reexecutar a consulta do relatório e só então atualizar a tabela exibida.
- Enquanto roda: botão desabilitado, ícone girando e texto "Sincronizando...".
- Ao concluir: aviso de sucesso com quantidade de registros e tempo de execução; em caso de falha, mensagem de erro legível com opção de tentar novamente.
- Atualizar o rodapé de status (última sincronização, duração, registros) com o resultado da execução manual.

## Detalhes técnicos
- Arquivo: `src/routes/_authenticated/relatorios.tsx`, componente `ReportRunner`.
- Novo handler async: `queryClient.invalidateQueries` para `["ativos"]` e `["alocacoes"]`, seguido de `await refetch()`.
- Botão renderizado condicionalmente quando `tipo === "gap_edr"`, reaproveitando os toasts já existentes de loading/sucesso/erro.
- Sem mudanças de banco de dados.
