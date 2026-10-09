/** A exceção é exclusiva deste produto, nunca de outras versões do Office. */
export function isOffice2019ProfessionalPlus(nome?: string | null): boolean {
  const normalizado = (nome ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return normalizado === "office 2019 professional plus" || normalizado === "microsoft office 2019 professional plus";
}

export function contarAtivosPorChave(rows: { chave_id: string | null; ativo_id: string | null; data_fim: string | null }[]): Map<string, number> {
  const ativos = new Map<string, Set<string>>();
  const semAtivo = new Map<string, number>();
  for (const row of rows) {
    if (row.data_fim || !row.chave_id) continue;
    if (row.ativo_id) {
      const ids = ativos.get(row.chave_id) ?? new Set<string>();
      ids.add(row.ativo_id);
      ativos.set(row.chave_id, ids);
    } else {
      semAtivo.set(row.chave_id, (semAtivo.get(row.chave_id) ?? 0) + 1);
    }
  }
  return new Map([...new Set([...ativos.keys(), ...semAtivo.keys()])].map((id) => [id, (ativos.get(id)?.size ?? 0) + (semAtivo.get(id) ?? 0)]));
}