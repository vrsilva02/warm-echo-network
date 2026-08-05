import { describe, it, expect, beforeAll } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { criarAlocacao, encerrarAlocacao } from "./licencas";

describe("Regras de Negócio de Licenças - Integridade e Concorrência", () => {
  let fabricanteId: string;
  let produtoId: string;
  let licencaId: string;
  let ativoId: string;

  beforeAll(async () => {
    // 1. Garantir um fabricante de teste (ignora RLS pois estamos usando o cliente padrão que deve ter permissão ou ser service role em ambiente de teste, mas aqui usamos o client comum)
    const { data: fabs } = await supabase.from("fabricantes").select("id").limit(1);
    
    if (!fabs || fabs.length === 0) {
      const { data: novoFab, error: errFab } = await supabase.from("fabricantes").insert({ nome: "Fabricante Teste Vitest" }).select("id").single();
      if (errFab) throw new Error(`Falha ao criar fabricante: ${errFab.message}`);
      fabricanteId = novoFab.id;
    } else {
      fabricanteId = fabs[0].id;
    }

    // 2. Criar um produto de teste com campos obrigatórios
    const { data: produto, error: errProd } = await supabase.from("produtos_catalogo").insert({
      nome_oficial: `VITEST-PROD-${Date.now()}`,
      fabricante_id: fabricanteId,
      categoria: "Software",
      modelo_licenciamento: "por_dispositivo",
      tipo_licenciamento: "perpetuo"
    }).select("id").single();
    
    if (errProd) throw new Error(`Falha ao criar produto: ${errProd.message}`);
    produtoId = produto.id;

    // 3. Criar uma licença de teste com saldo
    const { data: licenca, error: errLic } = await supabase.from("licencas").insert({
      produto_id: produtoId,
      quantidade: 10
    }).select("id").single();
    
    if (errLic) throw new Error(`Falha ao criar licença: ${errLic.message}`);
    licencaId = licenca.id;

    // 4. Criar um ativo de teste
    const { data: ativo, error: errAtivo } = await supabase.from("ativos").insert({
      hostname: `VITEST-ATV-${Date.now()}`,
      status_ciclo_vida: "estoque"
    }).select("id").single();
    
    if (errAtivo) throw new Error(`Falha ao criar ativo: ${errAtivo.message}`);
    ativoId = ativo.id;
  });

  it("não deve permitir duplicar a mesma licença para o mesmo ativo (sequencial)", async () => {
    // Primeira tentativa
    const r1 = await criarAlocacao({ licenca_id: licencaId, ativo_id: ativoId });
    expect(r1.ok).toBe(true);

    // Segunda tentativa (deve falhar)
    const r2 = await criarAlocacao({ licenca_id: licencaId, ativo_id: ativoId });
    expect(r2.ok).toBe(false);
    expect(r2.error).toBe("ALREADY_ALLOCATED");
  });

  it("deve garantir integridade em caso de condição de corrida (múltiplas requisições paralelas)", async () => {
    const { data: ativoRace } = await supabase.from("ativos").insert({
      hostname: `VITEST-RACE-${Date.now()}`,
      status_ciclo_vida: "estoque"
    }).select("id").single();

    // Disparar 10 tentativas simultâneas para o mesmo par (ativo, licença)
    const promessas = Array.from({ length: 10 }).map(() => 
      criarAlocacao({ licenca_id: licencaId, ativo_id: ativoRace!.id })
    );

    const resultados = await Promise.all(promessas);
    const sucessos = resultados.filter(r => r.ok).length;
    const falhas = resultados.filter(r => !r.ok);
    
    // Apenas 1 deve ter sucesso devido ao índice UNIQUE no banco
    expect(sucessos).toBe(1);
    
    // Todas as outras devem ter falhado com o erro de duplicidade
    expect(falhas.length).toBe(9);
    expect(falhas.every(f => f.error === "ALREADY_ALLOCATED")).toBe(true);
  });

  it("deve permitir reatribuir após encerrar a alocação anterior", async () => {
    // Encerrar a alocação ativa do ativoId
    const { data: aloc } = await supabase.from("alocacoes")
      .select("id")
      .eq("ativo_id", ativoId)
      .eq("licenca_id", licencaId)
      .is("data_fim", null)
      .single();

    await encerrarAlocacao(aloc!.id);

    // Tentar alocar novamente o mesmo par
    const r = await criarAlocacao({ licenca_id: licencaId, ativo_id: ativoId });
    expect(r.ok).toBe(true);
  });
});
