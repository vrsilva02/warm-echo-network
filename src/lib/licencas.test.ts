import { supabase } from "@/integrations/supabase/client";
import { criarAlocacao, encerrarAlocacao } from "./licencas";

/**
 * Script de teste para validar regras de negócio de licenças.
 * Pode ser executado via Playwright ou chamado em um fluxo de debug.
 */
export async function testLicenseRules() {
  console.log("Iniciando testes de regras de licença...");
  
  // 1. Criar um ativo de teste
  const { data: ativo } = await supabase.from("ativos").insert({
    hostname: `TEST-ATV-${Date.now()}`,
    status_ciclo_vida: "estoque"
  }).select("id").single();
  
  if (!ativo) throw new Error("Falha ao criar ativo de teste");
  
  // 2. Criar um produto e licença de teste
  const { data: fabricante } = await supabase.from("fabricantes").select("id").limit(1).single();
  const { data: produto } = await supabase.from("produtos_catalogo").insert({
    nome_oficial: `TEST-PROD-${Date.now()}`,
    fabricante_id: fabricante?.id,
    categoria: "Software"
  }).select("id").single();
  
  if (!produto) throw new Error("Falha ao criar produto de teste");
  
  const { data: licenca } = await supabase.from("licencas").insert({
    produto_id: produto.id,
    quantidade: 1,
    status: "ativo"
  }).select("id").single();
  
  if (!licenca) throw new Error("Falha ao criar licença de teste");

  try {
    // 3. Teste Atribuição Válida
    console.log("Teste: Atribuição válida");
    const r1 = await criarAlocacao({ licenca_id: licenca.id, ativo_id: ativo.id });
    if (!r1.ok) throw new Error(`Falha na atribuição válida: ${r1.error}`);

    // 4. Teste Duplicidade (UNIQUE asset_id, license_id)
    console.log("Teste: Bloqueio de duplicidade");
    const r2 = await criarAlocacao({ licenca_id: licenca.id, ativo_id: ativo.id });
    if (r2.ok) throw new Error("Permitiu duplicidade indevidamente");
    console.log("OK: Duplicidade bloqueada");

    // 5. Teste Saldo Negativo
    console.log("Teste: Bloqueio de saldo insuficiente");
    const { data: ativo2 } = await supabase.from("ativos").insert({
      hostname: `TEST-ATV-2-${Date.now()}`,
      status_ciclo_vida: "estoque"
    }).select("id").single();
    
    const r3 = await criarAlocacao({ licenca_id: licenca.id, ativo_id: ativo2!.id });
    if (r3.ok) throw new Error("Permitiu atribuição sem saldo");
    console.log("OK: Saldo insuficiente bloqueado");

    // 6. Teste Remoção
    console.log("Teste: Remoção e devolução de saldo");
    const { data: aloc } = await supabase.from("alocacoes").select("id").eq("ativo_id", ativo.id).is("data_fim", null).single();
    const r4 = await encerrarAlocacao(aloc!.id);
    if (!r4.ok) throw new Error("Falha ao encerrar alocação");
    
    // Validar se o saldo voltou
    const r5 = await criarAlocacao({ licenca_id: licenca.id, ativo_id: ativo2!.id });
    if (!r5.ok) throw new Error("Saldo não foi devolvido corretamente após remoção");
    console.log("OK: Remoção e devolução de saldo funcionando");

    console.log("TESTES CONCLUÍDOS COM SUCESSO!");
    return { ok: true };
  } finally {
    // Cleanup opcional: no ambiente real, preferimos deixar os logs para auditoria
  }
}
