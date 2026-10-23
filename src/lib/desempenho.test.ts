import { describe, expect, it } from "vitest";
import { agregarMetricas, moduloDoCaminho } from "./desempenho";

describe("métricas de carregamento", () => {
  it("ordena pelo módulo mais lento", () => {
    const r = agregarMetricas([
      { modulo: "ativos", duracao_ms: 4000 },
      { modulo: "ativos", duracao_ms: 2000 },
      { modulo: "dashboard", duracao_ms: 500 },
    ]);
    expect(r[0]).toMatchObject({ modulo: "ativos", amostras: 2, mediaMs: 3000, maxMs: 4000 });
    expect(r[1].modulo).toBe("dashboard");
  });
  it("identifica o módulo pelo caminho", () => {
    expect(moduloDoCaminho("/ativos/abc")).toBe("ativos");
    expect(moduloDoCaminho("/")).toBe("inicio");
  });
});
