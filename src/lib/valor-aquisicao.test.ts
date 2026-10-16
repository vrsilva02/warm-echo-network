import { describe, expect, it } from "vitest";
import { parseValorAquisicao, valorAquisicaoImport } from "./valor-aquisicao";

describe("Valor de compra do equipamento", () => {
  it("aceita valor para inclusão e edição individual ou em massa", () => {
    expect(parseValorAquisicao("4.500,90")).toBe(4500.9);
    expect(parseValorAquisicao("4500.90")).toBe(4500.9);
    expect(valorAquisicaoImport("R$ 4.500,90")).toEqual({ valor_aquisicao: 4500.9 });
  });
  it("preserva valores existentes quando a planilha não informa valor", () => {
    expect({ valor_aquisicao: 3200, ...valorAquisicaoImport("") }).toEqual({ valor_aquisicao: 3200 });
    expect(valorAquisicaoImport(undefined)).toEqual({});
  });
  it("aceita aquisição sem custo e permite campo opcional", () => {
    expect(parseValorAquisicao("0")).toBe(0);
    expect(parseValorAquisicao("")).toBeNull();
  });
  it("rejeita valores negativos, texto e frações menores que centavos", () => {
    for (const value of ["-1", "abc", "1.001", "1,001", "Infinity"]) {
      expect(() => parseValorAquisicao(value)).toThrow();
    }
  });
});