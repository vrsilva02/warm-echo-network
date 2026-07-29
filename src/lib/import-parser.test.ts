import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseTabularFile } from "@/lib/import-parser";
import { ATIVOS_COLUMNS, LICENCAS_COLUMNS } from "@/lib/import-templates";

/** Monta um File .xlsx em memória a partir de cabeçalho + linhas (como o template gerado). */
function xlsxFile(name: string, columns: readonly string[], rows: (string | number)[][]) {
  const ws = XLSX.utils.aoa_to_sheet([[...columns], ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dados");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new File([buf], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

const ATIVO_EXEMPLO = [
  "NB-0001",
  "Notebook",
  "PAT-000123",
  "SN123456789",
  "Financeiro",
  "em_uso",
  "colaborador@empresa.com",
];

describe("parseTabularFile com template XLSX", () => {
  it("lê o template de ativos preservando cabeçalhos e valores", async () => {
    const file = xlsxFile("template_ativos.xlsx", ATIVOS_COLUMNS, [ATIVO_EXEMPLO]);
    const { headers, rows } = await parseTabularFile(file);

    for (const c of ATIVOS_COLUMNS) expect(headers).toContain(c);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      hostname: "NB-0001",
      tipo: "Notebook",
      numero_patrimonio: "PAT-000123",
      status_ciclo_vida: "em_uso",
      responsavel_email: "colaborador@empresa.com",
    });
  });

  it("normaliza cabeçalhos com espaços e maiúsculas", async () => {
    const file = xlsxFile("ativos.xlsx", ["  HostName  ", "TIPO"], [["SRV-01", "Servidor"]]);
    const { rows } = await parseTabularFile(file);
    expect(rows[0]).toEqual({ hostname: "SRV-01", tipo: "Servidor" });
  });

  it("descarta a linha vazia que acompanha o template", async () => {
    const vazia = ATIVOS_COLUMNS.map(() => "");
    const file = xlsxFile("template_ativos.xlsx", ATIVOS_COLUMNS, [ATIVO_EXEMPLO, vazia]);
    const { rows } = await parseTabularFile(file);
    expect(rows).toHaveLength(1);
  });

  it("mantém números como texto (quantidade, custo) sem perder precisão", async () => {
    const linha: (string | number)[] = LICENCAS_COLUMNS.map((c) =>
      c === "quantidade" ? 50 : c === "custo_unitario" ? 45.9 : "",
    );
    linha[0] = "Microsoft";
    linha[1] = "Office 365 E3";
    const file = xlsxFile("template_licencas.xlsx", LICENCAS_COLUMNS, [linha as (string | number)[]]);
    const { rows } = await parseTabularFile(file);
    expect(rows[0].quantidade).toBe("50");
    expect(rows[0].custo_unitario).toBe("45.9");
    expect(rows[0].fabricante).toBe("Microsoft");
  });

  it("retorna vazio para planilha sem linhas de dados", async () => {
    const file = xlsxFile("vazio.xlsx", ATIVOS_COLUMNS, []);
    const { rows } = await parseTabularFile(file);
    expect(rows).toEqual([]);
  });

  it("faz round-trip: export -> arquivo -> import preserva os dados", async () => {
    const dados = [
      ["NB-0001", "Notebook", "PAT-1", "SN1", "TI", "em_uso", "a@e.com"],
      ["NB-0002", "Desktop", "PAT-2", "SN2", "RH", "em_estoque", "b@e.com"],
    ];
    const file = xlsxFile("ativos_export.xlsx", ATIVOS_COLUMNS, dados);
    const { rows } = await parseTabularFile(file);
    expect(rows.map((r) => r.hostname)).toEqual(["NB-0001", "NB-0002"]);
    expect(rows.map((r) => r.setor)).toEqual(["TI", "RH"]);
  });
});
