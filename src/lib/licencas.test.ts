import { describe, it, expect } from "vitest";
import { criarAlocacao } from "./licencas";
import { vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => {
  const mockAlocacoes: any[] = [];
  return {
    supabase: {
      from: (table: string) => {
        const chain = {
          select: () => chain,
          eq: () => chain,
          is: () => chain,
          maybeSingle: async () => {
            if (table === "alocacoes") {
              return { data: mockAlocacoes.find(a => !a.data_fim), error: null };
            }
            return { data: { id: "mock-id" }, error: null };
          },
          single: async () => {
            return { data: { id: "mock-id", quantidade_disponivel: 10 }, error: null };
          },
          insert: async (data: any) => {
            if (table === "alocacoes") {
              const exists = mockAlocacoes.find(a => 
                a.ativo_id === data.ativo_id && 
                a.licenca_id === data.licenca_id && 
                !a.data_fim
              );
              if (exists) {
                return { data: null, error: { code: "23505", message: "Unique violation" } };
              }
              const newAloc = { ...data, id: `aloc-${Math.random()}`, data_inicio: new Date().toISOString() };
              mockAlocacoes.push(newAloc);
              return { data: newAloc, error: null };
            }
            return { data: { id: "mock-id" }, error: null };
          },
          update: () => ({ eq: () => ({ error: null }) })
        };
        return chain;
      }
    }
  };
});

describe("Regras de Negócio de Licenças - Integridade (Mocked)", () => {
  const licencaId = "lic-123";
  const ativoId = "atv-456";

  it("não deve permitir duplicar a mesma licença para o mesmo ativo (sequencial)", async () => {
    const r1 = await criarAlocacao({ licenca_id: licencaId, ativo_id: ativoId });
    expect(r1.ok).toBe(true);

    const r2 = await criarAlocacao({ licenca_id: licencaId, ativo_id: ativoId });
    expect(r2.ok).toBe(false);
    expect(r2.error).toBe("ALREADY_ALLOCATED");
  });

  it("deve garantir integridade em caso de múltiplas requisições paralelas (simulação de concorrência)", async () => {
    const targetAtivoId = "atv-race";
    
    const promessas = Array.from({ length: 10 }).map(() => 
      criarAlocacao({ licenca_id: licencaId, ativo_id: targetAtivoId })
    );

    const resultados = await Promise.all(promessas);
    const sucessos = resultados.filter(r => r.ok).length;
    
    expect(sucessos).toBe(1);
    
    const falhas = resultados.filter(r => !r.ok);
    expect(falhas.every(f => f.error === "ALREADY_ALLOCATED")).toBe(true);
  });
});
