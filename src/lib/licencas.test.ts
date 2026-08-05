import { describe, it, expect, beforeAll } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { criarAlocacao, encerrarAlocacao } from "./licencas";

describe("Regras de Negócio de Licenças", () => {
  let fabricanteId: string;
  let produtoId: string;
  let licencaId: string;
  let ativoId: string;

  beforeAll(async () => {
    // 1. Obter um fabricante existente
    const { data: fabricante } = await supabase.from("fabricantes").select("id").limit(1).single();
    if (!fabricante) throw new Error("Falha ao obter fabricante para testes");
    fabricanteId = fabricante.id;

    // 2. Criar um produto de teste
    const { data: produto } = await supabase.from("produtos_catalogo").insert({
      nome_oficial: `VITEST-PROD-${Date.now()}`,
      fabricante_id: fabricanteId,
      categoria: "Software",
      modelo_licenciamento: "por_dispositivo",
      tipo_licenciamento: "perpetuo"
    }).select("id").single();
    if (!produto) throw new Error("Falha ao criar produto de teste");
    produtoId = produto.id;

    // 3. Criar uma licença de teste
    const { data: licenca } = await supabase.from("licencas").insert({
      produto_id: produtoId,
      quantidade: 5
    }).select("id").single();
    if (!licenca) throw new Error("Falha ao criar licença de teste");
    licencaId = licenca.id;

    // 4. Criar um ativo de teste
    const { data: ativo } = await supabase.from("ativos").insert({
      hostname: `VITEST-ATV-${Date.now()}`,
      status_ciclo_vida: "estoque"
    }).select("id").single();
    if (!ativo) throw new Error("Falha ao criar ativo de teste");
    ativoId = ativo.id;
  });

  it("deve permitir uma atribuição válida", async () => {
    const r = await criarAlocacao({ licenca_id: licencaId, ativo_id: ativoId });
    expect(r.ok).toBe(true);
  });

  it("não deve permitir duplicidade (mesma licença para o mesmo ativo)", async () => {
    const r = await criarAlocacao({ licenca_id: licencaId, ativo_id: ativoId });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("ALREADY_ALLOCATED");
  });

  it("não deve permitir atribuição sem saldo disponível", async () => {
    // Criar licença com 1 seat e ocupar
    const { data: prodExtra } = await supabase.from("produtos_catalogo").insert({
      nome_oficial: `VITEST-PROD-LOW-${Date.now()}`,
      fabricante_id: fabricanteId,
      categoria: "Software",
      modelo_licenciamento: "por_dispositivo",
      tipo_licenciamento: "perpetuo"
    }).select("id").single();

    const { data: licLow } = await supabase.from("licencas").insert({
      produto_id: prodExtra!.id,
      quantidade: 1
    }).select("id").single();

    // Primeira alocação (ok)
    await criarAlocacao({ licenca_id: licLow!.id, ativo_id: ativoId });

    // Segunda alocação (erro de saldo)
    const { data: ativo2 } = await supabase.from("ativos").insert({
      hostname: `VITEST-ATV-2-${Date.now()}`,
      status_ciclo_vida: "estoque"
    }).select("id").single();

    const r = await criarAlocacao({ licenca_id: licLow!.id, ativo_id: ativo2!.id });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("Não existem licenças disponíveis.");
  });

  it("deve garantir integridade em caso de múltiplas requisições paralelas (condição de corrida)", async () => {
    const { data: ativoRace } = await supabase.from("ativos").insert({
      hostname: `VITEST-RACE-${Date.now()}`,
      status_ciclo_vida: "estoque"
    }).select("id").single();

    // Criar nova licença com saldo
    const { data: licRace } = await supabase.from("licencas").insert({
      produto_id: produtoId,
      quantidade: 10
    }).select("id").single();

    // Disparar 5 tentativas simultâneas
    const promessas = Array.from({ length: 5 }).map(() => 
      criarAlocacao({ licenca_id: licRace!.id, ativo_id: ativoRace!.id })
    );

    const resultados = await Promise.all(promessas);
    const sucessos = resultados.filter(r => r.ok).length;
    
    // O banco de dados DEVE garantir que apenas 1 vença
    expect(sucessos).toBe(1);
    
    const falhas = resultados.filter(r => !r.ok);
    expect(falhas.every(f => f.error === "ALREADY_ALLOCATED")).toBe(true);
  });

  it("deve permitir reatribuição após encerramento da alocação anterior", async () => {
    // Encerrar a alocação do primeiro teste
    const { data: aloc } = await supabase.from("alocacoes")
      .select("id")
      .eq("ativo_id", ativoId)
      .eq("licenca_id", licencaId)
      .is("data_fim", null)
      .single();

    await encerrarAlocacao(aloc!.id);

    // Tentar alocar novamente
    const r = await criarAlocacao({ licenca_id: licencaId, ativo_id: ativoId });
    expect(r.ok).toBe(true);
  });
});
