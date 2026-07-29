import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { buildXLSXBuffer } from "@/lib/export-xlsx-core";
import { ATIVOS_COLUMNS, LICENCAS_COLUMNS } from "@/lib/import-templates";

async function build(
  columns: string[],
  rows: (string | number | null | undefined)[][],
  sheetName?: string,
) {
  const buf = await buildXLSXBuffer(columns, rows, sheetName);
  const bytes = new Uint8Array(buf);
  return { bytes, wb: XLSX.read(bytes, { type: "array" }) };
}

function sheetOf(wb: XLSX.WorkBook) {
  return wb.Sheets[wb.SheetNames[0]];
}

describe("geração de XLSX", () => {
  it("produz um binário XLSX válido (assinatura ZIP) que pode ser relido", async () => {
    const { bytes, wb } = await build(["col1", "col2"], [["v1", "v2"]]);
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]); // "PK"
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheetOf(wb));
    expect(rows[0]).toEqual({ col1: "v1", col2: "v2" });
  });

  it("escreve cabeçalho e linhas na planilha, convertendo null/undefined em vazio", async () => {
    const { wb } = await build(
      ["hostname", "setor", "custo"],
      [
        ["NB-0001", null, 45.9],
        ["NB-0002", "TI", undefined],
      ],
    );
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheetOf(wb), {
      defval: "",
      raw: false,
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ hostname: "NB-0001", setor: "", custo: "45.9" });
    expect(rows[1]).toMatchObject({ hostname: "NB-0002", setor: "TI", custo: "" });
  });

  it("respeita o nome da aba e trunca em 31 caracteres (limite do Excel)", async () => {
    const { wb } = await build(["a"], [["1"]], "Licenças");
    expect(wb.SheetNames[0]).toBe("Licenças");

    const { wb: wb2 } = await build(["a"], [["1"]], "N".repeat(50));
    expect(wb2.SheetNames[0]).toHaveLength(31);
  });

  it("mantém as colunas dos templates de ativos e licenças na exportação", async () => {
    const header = (wb: XLSX.WorkBook) =>
      (XLSX.utils.sheet_to_json(sheetOf(wb), { header: 1 })[0] as string[]) ?? [];
    const a = await build([...ATIVOS_COLUMNS], []);
    const l = await build([...LICENCAS_COLUMNS], []);
    expect(header(a.wb)).toEqual([...ATIVOS_COLUMNS]);
    expect(header(l.wb)).toEqual([...LICENCAS_COLUMNS]);
  });
});
