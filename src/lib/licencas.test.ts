import { describe, it, expect, vi } from "vitest";
import { criarAlocacao } from "./licencas";

const mockStore = {
  alocacoes: [] as any[],
};

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: (table: string) => {
        const chain: any = {
          select: (columns?: string) => {
            // Se for insert().select()
            if (chain._isInsert) return chain;
            return chain;
          },
          eq: () => chain,
          neq: () => chain,
          in: () => chain,
          is: () => chain,
          limit: () => chain,
          maybeSingle: async () => {
            if (table === "alocacoes") {
              const found = mockStore.alocacoes.find(a => !a.data_fim);
              return { data: found || null, error: null };
            }
            return { data: { id: "mock-id" }, error: null };
          },
          single: async () => {
            if (table === "vw_licencas_indicadores") {
              return { data: { disponiveis: 10 }, error: null };
            }
            if (chain._isInsert && table === "alocacoes") {
              const data = chain._insertData;
              const exists = mockStore.alocacoes.find(a => 
                a.ativo_id === data.ativo_id && 
                a.licenca_id === data.licenca_id && 
                !a.data_fim
              );
              if (exists) {
                return { data: null, error: { code: "23505", message: "Unique violation" } };
              }
              const newAloc = { ...data, id: `aloc-${Math.random()}`, data_inicio: new Date().toISOString() };
              mockStore.alocacoes.push(newAloc);
              return { data: newAloc, error: null };
            }
            return { data: { id: "mock-id" }, error: null };
          },
          insert: (data: any) => {
            chain._isInsert = true;
            chain._insertData = data;
            return chain;
          },
          update: () => chain,
          _isInsert: false,
          _insertData: null
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
    mockStore.alocacoes = [];

    const r1 = await criarAlocacao({ licenca_id: licencaId, ativo_id: ativoId });
    expect(r1.ok).toBe(true);

    const r2 = await criarAlocacao({ licenca_id: licencaId, ativo_id: ativoId });
    expect(r2.ok).toBe(false);
    expect(r2.error).toBe("Este ativo já possui esta licença atribuída.");
  });

  it("deve garantir integridade em caso de múltiplas requisições paralelas (simulação de concorrência)", async () => {
    mockStore.alocacoes = [];
    const targetAtivoId = "atv-race";
    
    const promessas = Array.from({ length: 10 }).map(() => 
      criarAlocacao({ licenca_id: licencaId, ativo_id: targetAtivoId })
    );

    const resultados = await Promise.all(promessas);
    const sucessos = resultados.filter(r => r.ok).length;
    
    expect(sucessos).toBe(1);
  });
});
