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
 * Verifica se uma chave individual já está vinculada a outro ativo em alocação ativa.
 * Retorna dados do conflito ou null quando livre.
 */
export async function chaveIndividualEmUso(
  chave: string,
  opts?: { ignoreAlocacaoId?: string; ignoreAtivoId?: string | null },
): Promise<{ alocacao_id: string; ativo_id: string | null; hostname: string | null } | null> {
  const trimmed = chave.trim();
  if (!trimmed) return null;
  const { data, error } = await supabase
    .from("alocacoes")
    .select("id, ativo_id, ativos(hostname)")
    .eq("chave_individual", trimmed)
    .is("data_fim", null);
  if (error || !data) return null;
  const conflito = data.find(
    (a: any) =>
      a.id !== opts?.ignoreAlocacaoId &&
      a.ativo_id &&
      a.ativo_id !== (opts?.ignoreAtivoId ?? null),
  ) as any;
  if (!conflito) return null;
  return {
    alocacao_id: conflito.id,
    ativo_id: conflito.ativo_id,
    hostname: conflito.ativos?.hostname ?? null,
  };
}

/**
 * Cria uma alocação. Se saldo < 0 após, o log de auditoria registra "deficit_gerado".
 */
export async function criarAlocacao(input: {
  licenca_id: string;
  ativo_id?: string | null;
  usuario_id?: string | null;
  chave_individual?: string | null;
  observacao?: string | null;
  saldoAntes: number;
}): Promise<{ ok: boolean; error?: string; deficit: boolean }> {
  if (input.chave_individual && input.chave_individual.trim()) {
    const conflito = await chaveIndividualEmUso(input.chave_individual, {
      ignoreAtivoId: input.ativo_id ?? null,
    });
    if (conflito) {
      return {
        ok: false,
        deficit: false,
        error: `Esta chave de licença já está em uso no ativo "${conflito.hostname ?? conflito.ativo_id}". Encerre a alocação anterior antes de reutilizá-la.`,
      };
    }
  }
  const { error, data } = await supabase
    .from("alocacoes")
    .insert({
      licenca_id: input.licenca_id,
      ativo_id: input.ativo_id ?? null,
      usuario_id: input.usuario_id ?? null,
      chave_individual: input.chave_individual ?? null,
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
