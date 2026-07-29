import { describe, it, expect, vi, beforeEach } from "vitest";
import * as XLSXActual from "xlsx";

/**
 * Captura as chamadas de XLSX.writeFile para inspecionar o arquivo gerado
 * sem tocar no sistema de arquivos / DOM.
 */
const written: { name: string; wb: XLSXActual.WorkBook }[] = [];

vi.mock("xlsx", async () => {
  const actual = await vi.importActual<typeof XLSXActual>("xlsx");
  return {
    ...actual,
    writeFile: (wb: XLSXActual.WorkBook, name: string) => {
      written.push({ name, wb });
    },
  };
});

import { downloadXLSX } from "@/lib/export";
import { ATIVOS_COLUMNS, LICENCAS_COLUMNS } from "@/lib/import-templates";

beforeEach(() => {
  written.length = 0;
});

function sheetOf(wb: XLSXActual.WorkBook) {
  return wb.Sheets[wb.SheetNames[0]];
}

describe("downloadXLSX", () => {
  it("gera arquivo com extensão .xlsx mesmo quando o nome vem sem extensão ou como .csv", async () => {
    await downloadXLSX("relatorio", ["a"], [["1"]]);
    await downloadXLSX("relatorio.csv", ["a"], [["1"]]);
    await downloadXLSX("relatorio.xlsx", ["a"], [["1"]]);
    expect(written.map((w) => w.name)).toEqual([
      "relatorio.xlsx",
      "relatorio.xlsx",
      "relatorio.xlsx",
    ]);
  });

  it("escreve cabeçalho e linhas na planilha, convertendo null/undefined em vazio", async () => {
    await downloadXLSX(
      "ativos",
      ["hostname", "setor", "custo"],
      [
        ["NB-0001", null, 45.9],
        ["NB-0002", "TI", undefined],
      ],
    );
    const rows = XLSXActual.utils.sheet_to_json<Record<string, unknown>>(
      sheetOf(written[0].wb),
      { defval: "", raw: false },
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ hostname: "NB-0001", setor: "", custo: "45.9" });
    expect(rows[1]).toMatchObject({ hostname: "NB-0002", setor: "TI", custo: "" });
  });

  it("respeita o nome da aba e trunca em 31 caracteres (limite do Excel)", async () => {
    await downloadXLSX("x", ["a"], [["1"]], "Licenças");
    expect(written[0].wb.SheetNames[0]).toBe("Licenças");

    const nomeLongo = "N".repeat(50);
    await downloadXLSX("y", ["a"], [["1"]], nomeLongo);
    expect(written[1].wb.SheetNames[0]).toHaveLength(31);
  });

  it("produz um binário XLSX válido (assinatura ZIP) que pode ser relido", async () => {
    await downloadXLSX("t", ["col1", "col2"], [["v1", "v2"]]);
    const buf = XLSXActual.write(written[0].wb, { type: "array", bookType: "xlsx" });
    const bytes = new Uint8Array(buf as ArrayBuffer);
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]); // "PK"

    const relido = XLSXActual.read(bytes, { type: "array" });
    const rows = XLSXActual.utils.sheet_to_json<Record<string, string>>(sheetOf(relido));
    expect(rows[0]).toEqual({ col1: "v1", col2: "v2" });
  });

  it("mantém as colunas dos templates de ativos e licenças na exportação", async () => {
    await downloadXLSX("ativos", [...ATIVOS_COLUMNS], []);
    await downloadXLSX("licencas", [...LICENCAS_COLUMNS], []);
    const header = (wb: XLSXActual.WorkBook) =>
      (XLSXActual.utils.sheet_to_json(sheetOf(wb), { header: 1 })[0] as string[]) ?? [];
    expect(header(written[0].wb)).toEqual([...ATIVOS_COLUMNS]);
    expect(header(written[1].wb)).toEqual([...LICENCAS_COLUMNS]);
  });
});
