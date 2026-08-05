import { describe, it, expect } from "vitest";
import { criarAlocacao, encerrarAlocacao } from "./licencas";

// Mock do Supabase para simular comportamento do banco em ambiente de CI/Teste sem depender de dados reais ou RLS
import { vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => {
  const mockAlocacoes: any[] = [];
  return {
    supabase: {
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              is: () => ({
                single: async () => {
                  if (table === "alocacoes") {
                    return { data: mockAlocacoes.find(a => !a.data_fim), error: null };
                  }
                  return { data: { id: "mock-id" }, error: null };
                }
              })
            })
          })
        }),
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
        update: async (data: any) => ({
          eq: () => {
            if (table === "alocacoes" && data.data_fim) {
              const aloc = mockAlocacoes.find(a => !a.data_fim);
              if (aloc) aloc.data_fim = data.data_fim;
            }
            return { error: null };
          }
        })
      })
    }
  };
});

describe("Regras de Negócio de Licenças - Integridade (Mocked)", () => {
  const licencaId = "lic-123";
  const ativoId = "atv-456";

  it("não deve permitir duplicar a mesma licença para o mesmo ativo (sequencial)", async () => {
    // Primeira tentativa
    const r1 = await criarAlocacao({ licenca_id: licencaId, ativo_id: ativoId });
    expect(r1.ok).toBe(true);

    // Segunda tentativa (deve falhar com ALREADY_ALLOCATED mapeado do código 23505)
    const r2 = await criarAlocacao({ licenca_id: licencaId, ativo_id: ativoId });
    expect(r2.ok).toBe(false);
    expect(r2.error).toBe("ALREADY_ALLOCATED");
  });

  it("deve garantir integridade em caso de múltiplas requisições paralelas (simulação de concorrência)", async () => {
    const targetAtivoId = "atv-race";
    
    // Disparar 10 tentativas simultâneas
    // Nota: Como o mock é síncrono no push do array, o primeiro que entrar 'vence'
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
