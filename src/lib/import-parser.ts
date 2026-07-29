
export type ParsedTable = {
  headers: string[];
  rows: Record<string, string>[];
};

/**
 * Lê CSV, XLSX ou XLS retornando cabeçalhos normalizados (lowercase, trim)
 * e linhas como objetos de strings. Usado pelos importadores em massa para
 * suportar o mesmo template tanto em CSV quanto em planilhas Excel.
 */
export async function parseTabularFile(file: File): Promise<ParsedTable> {
  const name = file.name.toLowerCase();
  const isExcel = name.endsWith(".xlsx") || name.endsWith(".xls");

  if (isExcel) {
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const first = wb.SheetNames[0];
    if (!first) return { headers: [], rows: [] };
    const ws = wb.Sheets[first];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: "",
      raw: false,
    });
    const headerSet = new Set<string>();
    const rows = raw
      .map((r) => {
        const o: Record<string, string> = {};
        for (const k of Object.keys(r)) {
          const key = k.trim().toLowerCase();
          headerSet.add(key);
          o[key] = String(r[k] ?? "").trim();
        }
        return o;
      })
      .filter((r) => Object.values(r).some((v) => v !== ""));
    return { headers: Array.from(headerSet), rows };
  }

  // CSV
  const { default: Papa } = await import("papaparse");
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => {
        const rows = (res.data as Record<string, string>[]).filter((r) =>
          Object.values(r).some((v) => (v ?? "").toString().trim() !== ""),
        );
        resolve({ headers: res.meta.fields ?? [], rows });
      },
      error: (err) => reject(err),
    });
  });
}
