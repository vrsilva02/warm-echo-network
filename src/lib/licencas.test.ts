import { describe, it, expect, beforeAll } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { criarAlocacao, encerrarAlocacao } from "./licencas";

describe("Regras de Negócio de Licenças - Integridade e Concorrência", () => {
  let licencaId: string;
  let ativoId: string;

  beforeAll(async () => {
    // Para evitar problemas de RLS nos testes automatizados, vamos buscar registros existentes
    // 1. Obter uma licença com saldo disponível
    const { data: licenca } = await supabase
      .from("licencas")
      .select("id")
      .limit(1)
      .single();
    
    if (!licenca) throw new Error("Ambiente de teste requer ao menos uma licença cadastrada.");
    licencaId = licenca.id;

    // 2. Obter um ativo
    const { data: ativo } = await supabase
      .from("ativos")
      .select("id")
      .limit(1)
      .single();
    
    if (!ativo) throw new Error("Ambiente de teste requer ao menos um ativo cadastrado.");
    ativoId = ativo.id;

    // Limpeza inicial
    const { data: alocExistente } = await supabase
      .from("alocacoes")
      .select("id")
      .eq("ativo_id", ativoId)
      .eq("licenca_id", licencaId)
      .is("data_fim", null)
      .single();
    
    if (alocExistente) {
      await encerrarAlocacao(alocExistente.id);
    }
  });

  it("não deve permitir duplicar a mesma licença para o mesmo ativo (sequencial)", async () => {
    const r1 = await criarAlocacao({ licenca_id: licencaId, ativo_id: ativoId });
    expect(r1.ok).toBe(true);

    const r2 = await criarAlocacao({ licenca_id: licencaId, ativo_id: ativoId });
    expect(r2.ok).toBe(false);
    expect(r2.error).toBe("ALREADY_ALLOCATED");
  });

  it("deve garantir integridade em caso de condição de corrida (múltiplas requisições paralelas)", async () => {
    const { data: outroAtivo } = await supabase.from("ativos").select("id").neq("id", ativoId).limit(1).single();
    const targetAtivoId = outroAtivo?.id || ativoId;

    // Limpar
    const { data: alocs } = await supabase.from("alocacoes").select("id").eq("ativo_id", targetAtivoId).eq("licenca_id", licencaId).is("data_fim", null);
    if (alocs) {
      for (const a of alocs) await encerrarAlocacao(a.id);
    }

    // Disparar 5 tentativas simultâneas
    const promessas = Array.from({ length: 5 }).map(() => 
      criarAlocacao({ licenca_id: licencaId, ativo_id: targetAtivoId })
    );

    const resultados = await Promise.all(promessas);
    const sucessos = resultados.filter(r => r.ok).length;
    
    expect(sucessos).toBe(1);
    
    const falhas = resultados.filter(r => !r.ok);
    expect(falhas.every(f => f.error === "ALREADY_ALLOCATED")).toBe(true);
  });
});
