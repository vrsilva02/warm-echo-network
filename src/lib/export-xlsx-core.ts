export type Cell = string | number | null | undefined;

/**
 * Gera o binário XLSX em memória. Isolado de APIs de DOM para poder rodar
 * dentro de um Web Worker (exportação em background).
 */
export async function buildXLSXBuffer(
  columns: string[],
  rows: Cell[][],
  sheetName = "Dados",
): Promise<ArrayBuffer> {
  const XLSX = await import("xlsx");
  const data = [columns, ...rows.map((r) => r.map((c) => (c == null ? "" : c)))];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = columns.map((c, i) => {
    const width = Math.max(
      String(c).length,
      ...rows.map((r) => String(r[i] ?? "").length),
    );
    return { wch: Math.min(Math.max(width + 2, 10), 50) };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return out;
}

export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
