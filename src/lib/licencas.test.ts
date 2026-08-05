import { describe, it, expect } from "vitest";
import { criarAlocacao } from "./licencas";
import { vi } from "vitest";

// Armazenamento global do mock para persistir entre chamadas de criarAlocacao
const mockStore = {
  alocacoes: [] as any[],
};

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: (table: string) => {
        const chain = {
          select: () => chain,
          eq: () => chain,
          is: () => chain,
          maybeSingle: async () => {
            if (table === "alocacoes") {
              // Simula busca por alocação ativa existente
              const found = mockStore.alocacoes.find(a => !a.data_fim);
              return { data: found || null, error: null };
            }
            return { data: { id: "mock-id" }, error: null };
          },
          single: async () => {
            if (table === "licencas") {
              // Simula verificação de saldo (quantidade disponível)
              return { data: { id: "lic-123", quantidade_disponivel: 10 }, error: null };
            }
            return { data: { id: "mock-id" }, error: null };
          },
          insert: async (data: any) => {
            if (table === "alocacoes") {
              // Simula trava de unicidade do banco (Unique Index)
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
    // Reset store
    mockStore.alocacoes = [];

    // Primeira tentativa
    const r1 = await criarAlocacao({ licenca_id: licencaId, ativo_id: ativoId });
    expect(r1.ok).toBe(true);

    // Segunda tentativa (deve falhar com ALREADY_ALLOCATED mapeado do código 23505)
    const r2 = await criarAlocacao({ licenca_id: licencaId, ativo_id: ativoId });
    expect(r2.ok).toBe(false);
    expect(r2.error).toBe("ALREADY_ALLOCATED");
  });

  it("deve garantir integridade em caso de múltiplas requisições paralelas (simulação de concorrência)", async () => {
    // Reset store
    mockStore.alocacoes = [];
    const targetAtivoId = "atv-race";
    
    // Disparar 10 tentativas simultâneas
    const promessas = Array.from({ length: 10 }).map(() => 
      criarAlocacao({ licenca_id: licencaId, ativo_id: targetAtivoId })
    );

    const resultados = await Promise.all(promessas);
    const sucessos = resultados.filter(r => r.ok).length;
    
    // Apenas 1 deve ter sucesso
    expect(sucessos).toBe(1);
    
    const falhas = resultados.filter(r => !r.ok);
    expect(falhas.every(f => f.error === "ALREADY_ALLOCATED")).toBe(true);
  });
});
