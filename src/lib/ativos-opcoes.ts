/**
 * Listas padronizadas de Tipo e Categoria de ativos (padrão de catálogo do cliente).
 * Mantidas fora dos componentes para reuso em formulários, filtros e importação.
 */

export const ATIVO_TIPOS = [
  "NOTEBOOK",
  "DESKTOP",
  "MINI PC",
  "MONITOR",
  "NOBREAK 600VA",
  "NOBREAK 1200VA",
  "WORKSTATION",
  "MACBOOK",
  "TABLET",
  "CHROMEBOOK",
  "TELA INTERATIVA",
  "GABINETE DE RECARGA",
] as const;

export const ATIVO_CATEGORIAS = [
  "Notebook",
  "Microcomputador TIPO I",
  "Microcomputador TIPO II",
  "Microcomputador TIPO III",
  "Microcomputador TIPO IV",
  "Nobreak Tipo I",
  "Nobreak Tipo II",
  "Monitor Tipo II",
  "Monitor Tipo III e IV",
] as const;

/** Inclui um valor legado (já gravado no banco) na lista de opções, sem duplicar. */
export function comValorAtual(opcoes: readonly string[], atual?: string | null): string[] {
  const v = (atual ?? "").trim();
  if (!v || opcoes.some((o) => o.toLowerCase() === v.toLowerCase())) return [...opcoes];
  return [...opcoes, v];
}
