import { supabase } from "@/integrations/supabase/client";

/**
 * Busca todas as linhas de uma tabela/view.
 *
 * O PostgREST limita cada resposta a 1000 linhas. Para acelerar o carregamento
 * de tabelas grandes, fazemos primeiro um HEAD com `count: exact` e então
 * baixamos as páginas em paralelo (com concorrência limitada) em vez de
 * sequencialmente. O callback `onProgress` exibe o andamento na interface.
 */
export async function fetchAll<T = any>(
  table: string,
  select: string,
  modify?: (q: any) => any,
  opts?: { pageSize?: number; onProgress?: (loaded: number) => void; concurrency?: number },
): Promise<{ data: T[]; error: any }> {
  const pageSize = opts?.pageSize ?? 1000;
  const concurrency = opts?.concurrency ?? 4;

  const build = () => {
    let q: any = supabase.from(table as any).select(select);
    if (modify) q = modify(q);
    return q;
  };

  // 1) Descobre o total sem trazer dados.
  let total: number | null = null;
  try {
    let countQ: any = supabase.from(table as any).select(select, { count: "exact", head: true });
    if (modify) countQ = modify(countQ);
    const { count, error } = await countQ;
    if (!error) total = count ?? null;
  } catch {
    total = null;
  }

  // Fallback sequencial quando o count não está disponível.
  if (total == null) {
    const out: T[] = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await build().range(from, from + pageSize - 1);
      if (error) return { data: out, error };
      const page = (data ?? []) as T[];
      out.push(...page);
      opts?.onProgress?.(out.length);
      if (page.length < pageSize) break;
    }
    return { data: out, error: null };
  }

  if (total === 0) return { data: [], error: null };

  const pages = Math.ceil(total / pageSize);
  const results: T[][] = new Array(pages);
  let loaded = 0;
  let firstError: any = null;
  let next = 0;

  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= pages || firstError) return;
      const { data, error } = await build().range(i * pageSize, i * pageSize + pageSize - 1);
      if (error) {
        firstError ??= error;
        return;
      }
      const page = (data ?? []) as T[];
      results[i] = page;
      loaded += page.length;
      opts?.onProgress?.(loaded);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, pages) }, worker));
  if (firstError) return { data: results.filter(Boolean).flat(), error: firstError };
  return { data: results.flat(), error: null };
}
