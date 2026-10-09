import { describe, expect, it } from "vitest";
import { contarAtivosPorChave, isOffice2019ProfessionalPlus } from "./chave-capacidade";

describe("Exceção Office 2019 Professional Plus", () => {
  it("reconhece somente o produto solicitado", () => {
    expect(isOffice2019ProfessionalPlus("Microsoft / Office 2019 Professional Plus")).toBe(true);
    expect(isOffice2019ProfessionalPlus("Office 2019 Professional Plus")).toBe(true);
    for (const nome of ["Microsoft / Office 2021 Professional Plus", "Office 2019 Standard", "Office 365", "Windows 11 OEM", null]) {
      expect(isOffice2019ProfessionalPlus(nome)).toBe(false);
    }
  });
  it("conta ativos distintos e ignora alocações encerradas", () => {
    const row = { chave_id: "chave", ativo_id: "ativo", data_fim: null };
    const uso = contarAtivosPorChave([row, row, { ...row, ativo_id: "outro" }, { ...row, ativo_id: "encerrado", data_fim: "2026-10-09" }]);
    expect(uso.get("chave")).toBe(2);
  });
  it("preserva ocupação de vínculos legados sem ativo", () => {
    expect(contarAtivosPorChave([{ chave_id: "chave", ativo_id: null, data_fim: null }]).get("chave")).toBe(1);
  });
});