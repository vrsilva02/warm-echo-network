export type ParsedTable = {
  headers: string[];
  rows: Record<string, string>[];
};

/**
 * Núcleo de parsing de planilhas/CSV, isolado de qualquer API de DOM para
 * poder rodar tanto na thread principal quanto dentro de um Web Worker.
 */
export async function parseTabularBuffer(
  buffer: ArrayBuffer,
  fileName: string,
): Promise<ParsedTable> {
  const name = fileName.toLowerCase();
  const isExcel = name.endsWith(".xlsx") || name.endsWith(".xls");

  if (isExcel) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buffer, { type: "array" });
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

  // CSV — decodifica o buffer e usa o parser síncrono do papaparse
  const { default: Papa } = await import("papaparse");
  const text = new TextDecoder("utf-8").decode(new Uint8Array(buffer));
  const res = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  const rows = (res.data as Record<string, string>[]).filter((r) =>
    Object.values(r).some((v) => (v ?? "").toString().trim() !== ""),
  );
  return { headers: res.meta.fields ?? [], rows };
}
