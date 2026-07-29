import { supabase } from "@/integrations/supabase/client";

/**
 * Busca todas as linhas de uma tabela/view em páginas de 1000 registros.
 *
 * O PostgREST limita cada resposta a 1000 linhas — sem paginação, exportações
 * e caches de importação ficavam silenciosamente truncados. O callback
 * `onProgress` permite exibir o andamento do download na interface.
 */
export async function fetchAll<T = any>(
  table: string,
  select: string,
  modify?: (q: any) => any,
  opts?: { pageSize?: number; onProgress?: (loaded: number) => void },
): Promise<{ data: T[]; error: any }> {
  const pageSize = opts?.pageSize ?? 1000;
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    let q: any = supabase.from(table as any).select(select);
    if (modify) q = modify(q);
    const { data, error } = await q.range(from, from + pageSize - 1);
    if (error) return { data: out, error };
    const page = (data ?? []) as T[];
    out.push(...page);
    opts?.onProgress?.(out.length);
    if (page.length < pageSize) break;
  }
  return { data: out, error: null };
}
