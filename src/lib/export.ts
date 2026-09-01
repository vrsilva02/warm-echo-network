/**
 * Utilitários de exportação. As bibliotecas pesadas (xlsx, jspdf) são
 * carregadas sob demanda via import dinâmico para não pesar no bundle
 * inicial — elas só chegam ao navegador quando o usuário exporta algo.
 * A geração do XLSX acontece em um Web Worker (ver xlsx-builder).
 */
import { buildXLSXBlob } from "./xlsx-builder";

export { exportXLSXInBackground } from "./export-background";

export async function downloadXLSX(
  filename: string,
  columns: string[],
  rows: (string | number | null | undefined)[][],
  sheetName = "Dados",
) {
  const name = filename.replace(/\.(csv|xlsx?)$/i, "") + ".xlsx";
  const blob = await buildXLSXBlob(columns, rows, sheetName);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function toCSV(
  columns: string[],
  rows: (string | number | null | undefined)[][],
): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns, ...rows].map((r) => r.map(esc).join(";")).join("\r\n");
}

export function downloadCSV(
  filename: string,
  columns: string[],
  rows: (string | number | null | undefined)[][],
) {
  const name = filename.replace(/\.(csv|xlsx?)$/i, "") + ".csv";
  // BOM para o Excel reconhecer acentuação
  const blob = new Blob(["\uFEFF" + toCSV(columns, rows)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}


export async function downloadPDF(opts: {
  filename: string;
  title: string;
  subtitle?: string;
  columns: string[];
  rows: (string | number | null | undefined)[][];
}) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(14);
  doc.text(opts.title, 40, 40);
  if (opts.subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(opts.subtitle, 40, 58);
  }
  doc.setFontSize(9);
  doc.setTextColor(140);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 40, opts.subtitle ? 74 : 58);
  autoTable(doc, {
    head: [opts.columns],
    body: opts.rows.map((r) => r.map((c) => (c == null ? "" : String(c)))),
    startY: opts.subtitle ? 86 : 70,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 40, right: 40 },
  });
  doc.save(opts.filename);
}
