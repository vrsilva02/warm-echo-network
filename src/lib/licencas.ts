import { supabase } from "@/integrations/supabase/client";
import { logAction } from "@/lib/audit";

/**
 * Encerra uma alocação preservando histórico completo (seta data_fim = agora).
 * Nunca apaga o registro. Usado tanto na tela de Licenças quanto na ficha do Ativo.
 */
export async function encerrarAlocacao(
  alocacaoId: string,
  motivo?: string,
): Promise<{ ok: boolean; error?: string }> {
  const now = new Date().toISOString();
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
 * Cria uma alocação. Se saldo < 0 após, o log de auditoria registra "deficit_gerado".
 */
export async function criarAlocacao(input: {
  licenca_id: string;
  ativo_id?: string | null;
  usuario_id?: string | null;
  observacao?: string | null;
  saldoAntes: number;
}): Promise<{ ok: boolean; error?: string; deficit: boolean }> {
  const { error, data } = await supabase
    .from("alocacoes")
    .insert({
      licenca_id: input.licenca_id,
      ativo_id: input.ativo_id ?? null,
      usuario_id: input.usuario_id ?? null,
      observacao: input.observacao ?? null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message, deficit: false };
  const deficit = input.saldoAntes <= 0;
  if (deficit) {
    void logAction(
      "BULK_UPDATE",
      "alocacoes",
      {
        operacao: "vincular_com_deficit",
        licenca_id: input.licenca_id,
        ativo_id: input.ativo_id ?? null,
        usuario_id: input.usuario_id ?? null,
        saldo_antes: input.saldoAntes,
        alocacao_id: data?.id,
      },
      data?.id ?? null,
    );
  }
  return { ok: true, deficit };
}
