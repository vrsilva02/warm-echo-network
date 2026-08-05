import { supabase } from "@/integrations/supabase/client";
import { logAction } from "@/lib/audit";

/**
 * Encerra uma alocação preservando histórico completo (seta data_fim = agora).
 * Nunca apaga o registro.
 */
export async function encerrarAlocacao(
  alocacaoId: string,
  motivo?: string,
): Promise<{ ok: boolean; error?: string }> {
  const now = new Date().toISOString();
  
  // No backend, a trigger ou RLS cuidará da auditoria se necessário, 
  // mas mantemos o logAction para consistência na UI.
  const { error } = await supabase
    .from("alocacoes")
    .update({
      data_fim: now,
      observacao: motivo ? `${motivo}` : undefined,
    })
    .eq("id", alocacaoId)
    .is("data_fim", null);
    
  if (error) return { ok: false, error: error.message };
  
  void logAction("BULK_UPDATE", "alocacoes", {
    operacao: "desvincular",
    id: alocacaoId,
    motivo: motivo ?? null,
  });
  
  return { ok: true };
}

export async function encerrarAlocacoes(
  ids: string[],
  motivo?: string,
): Promise<{ ok: boolean; total: number; error?: string }> {
  if (ids.length === 0) return { ok: true, total: 0 };
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("alocacoes")
    .update({ data_fim: now })
    .in("id", ids)
    .is("data_fim", null);
    
  if (error) return { ok: false, total: 0, error: error.message };
  
  void logAction("BULK_UPDATE", "alocacoes", {
    operacao: "desvincular_massa",
    ids,
    total: ids.length,
    motivo: motivo ?? null,
  });
  
  return { ok: true, total: ids.length };
}

/**
 * Cria uma alocação com validações robustas.
 */
export async function criarAlocacao(input: {
  licenca_id: string;
  ativo_id: string;
  usuario_id?: string | null;
  observacao?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  
  // 1. Validar se o ativo já possui esta licença (Frontend check, backend has UNIQUE index)
  const { data: existente, error: errExistente } = await supabase
    .from("alocacoes")
    .select("id")
    .eq("ativo_id", input.ativo_id)
    .eq("licenca_id", input.licenca_id)
    .is("data_fim", null)
    .maybeSingle();

  if (errExistente) return { ok: false, error: "Erro ao validar duplicidade." };
  if (existente) return { ok: false, error: "Este ativo já possui esta licença atribuída." };

  // 2. Verificar disponibilidade
  const { data: indicador, error: errInd } = await supabase
    .from("vw_licencas_indicadores")
    .select("disponiveis")
    .eq("licenca_id", input.licenca_id)
    .single();

  if (errInd) return { ok: false, error: "Erro ao validar disponibilidade." };
  if ((indicador?.disponiveis ?? 0) <= 0) {
    return { ok: false, error: "Não existem licenças disponíveis." };
  }

  // 3. Inserir alocação
  const { error, data } = await supabase
    .from("alocacoes")
    .insert({
      licenca_id: input.licenca_id,
      ativo_id: input.ativo_id,
      usuario_id: input.usuario_id ?? null,
      observacao: input.observacao ?? null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false, error: "ALREADY_ALLOCATED" };
    return { ok: false, error: error.message };
  }

  void logAction(
    "BULK_UPDATE",
    "alocacoes",
    {
      operacao: "vincular",
      licenca_id: input.licenca_id,
      ativo_id: input.ativo_id,
      alocacao_id: data?.id,
    },
    data?.id ?? null
  );

  return { ok: true };
}
