export type ModuloResumo = { modulo: string; amostras: number; mediaMs: number; p95Ms: number; maxMs: number };

/** Agrupa amostras por módulo e ordena do mais lento (p95) para o mais rápido. */
export function agregarMetricas(rows: { modulo: string; duracao_ms: number }[]): ModuloResumo[] {
  const by = new Map<string, number[]>();
  for (const r of rows) {
    if (!r.modulo || !Number.isFinite(r.duracao_ms)) continue;
    const arr = by.get(r.modulo) ?? [];
    arr.push(r.duracao_ms);
    by.set(r.modulo, arr);
  }
  return [...by.entries()]
    .map(([modulo, v]) => {
      v.sort((a, b) => a - b);
      const p95 = v[Math.min(v.length - 1, Math.ceil(v.length * 0.95) - 1)];
      return {
        modulo,
        amostras: v.length,
        mediaMs: Math.round(v.reduce((s, x) => s + x, 0) / v.length),
        p95Ms: p95,
        maxMs: v[v.length - 1],
      };
    })
    .sort((a, b) => b.p95Ms - a.p95Ms);
}

/** Nome do módulo a partir do caminho (ex.: /ativos/123 -> ativos). */
export function moduloDoCaminho(pathname: string): string {
  const seg = pathname.split("/").filter(Boolean)[0] ?? "inicio";
  return seg.replace(/_$/, "");
}
