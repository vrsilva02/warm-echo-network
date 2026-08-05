import { describe, it, expect, beforeAll } from "vitest";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { criarAlocacao, encerrarAlocacao } from "./licencas";

describe("Regras de Negócio de Licenças - Integridade e Concorrência", () => {
  let fabricanteId: string;
  let produtoId: string;
  let licencaId: string;
  let ativoId: string;

  beforeAll(async () => {
    // Usamos o supabaseAdmin para garantir que os testes possam criar dados sem barreiras de RLS
    const { data: fabs } = await supabaseAdmin.from("fabricantes").select("id").limit(1);
    
    if (!fabs || fabs.length === 0) {
      const { data: novoFab, error: errFab } = await supabaseAdmin.from("fabricantes").insert({ nome: "Fabricante Teste Vitest" }).select("id").single();
      if (errFab) throw new Error(`Falha ao criar fabricante: ${errFab.message}`);
      fabricanteId = novoFab.id;
    } else {
      fabricanteId = fabs[0].id;
    }

    const { data: produto, error: errProd } = await supabaseAdmin.from("produtos_catalogo").insert({
      nome_oficial: `VITEST-PROD-${Date.now()}`,
      fabricante_id: fabricanteId,
      categoria: "Software",
      modelo_licenciamento: "por_dispositivo",
      tipo_licenciamento: "perpetuo"
    }).select("id").single();
    
    if (errProd) throw new Error(`Falha ao criar produto: ${errProd.message}`);
    produtoId = produto.id;

    const { data: licenca, error: errLic } = await supabaseAdmin.from("licencas").insert({
      produto_id: produtoId,
      quantidade: 10
    }).select("id").single();
    
    if (errLic) throw new Error(`Falha ao criar licença: ${errLic.message}`);
    licencaId = licenca.id;

    const { data: ativo, error: errAtivo } = await supabaseAdmin.from("ativos").insert({
      hostname: `VITEST-ATV-${Date.now()}`,
      status_ciclo_vida: "estoque"
    }).select("id").single();
    
    if (errAtivo) throw new Error(`Falha ao criar ativo: ${errAtivo.message}`);
    ativoId = ativo.id;
  });

  it("não deve permitir duplicar a mesma licença para o mesmo ativo (sequencial)", async () => {
    const r1 = await criarAlocacao({ licenca_id: licencaId, ativo_id: ativoId });
    expect(r1.ok).toBe(true);

    const r2 = await criarAlocacao({ licenca_id: licencaId, ativo_id: ativoId });
    expect(r2.ok).toBe(false);
    expect(r2.error).toBe("ALREADY_ALLOCATED");
  });

  it("deve garantir integridade em caso de condição de corrida (múltiplas requisições paralelas)", async () => {
    const { data: ativoRace } = await supabaseAdmin.from("ativos").insert({
      hostname: `VITEST-RACE-${Date.now()}`,
      status_ciclo_vida: "estoque"
    }).select("id").single();

    const promessas = Array.from({ length: 10 }).map(() => 
      criarAlocacao({ licenca_id: licencaId, ativo_id: ativoRace!.id })
    );

    const resultados = await Promise.all(promessas);
    const sucessos = resultados.filter(r => r.ok).length;
    const falhas = resultados.filter(r => !r.ok);
    
    expect(sucessos).toBe(1);
    expect(falhas.length).toBe(9);
    expect(falhas.every(f => f.error === "ALREADY_ALLOCATED")).toBe(true);
  });

  it("deve permitir reatribuir após encerrar a alocação anterior", async () => {
    const { data: aloc } = await supabaseAdmin.from("alocacoes")
      .select("id")
      .eq("ativo_id", ativoId)
      .eq("licenca_id", licencaId)
      .is("data_fim", null)
      .single();

    await encerrarAlocacao(aloc!.id);

    const r = await criarAlocacao({ licenca_id: licencaId, ativo_id: ativoId });
    expect(r.ok).toBe(true);
  });
});
