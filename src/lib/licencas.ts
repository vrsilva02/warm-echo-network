import { supabase } from "@/integrations/supabase/client";
import { logAction } from "@/lib/audit";

/**
 * Libera uma chave do módulo Chaves de Licença quando uma alocação é encerrada.
 * Para licenças multi-seat (ex.: Office 2019), só marca como 'disponivel'
 * quando não há mais nenhuma alocação ativa referenciando esta chave.
 */
async function liberarChave(chaveId: string) {
  // Conta quantas alocações ativas ainda usam esta chave
  const { count, error: errCount } = await supabase
    .from("alocacoes")
    .select("id", { count: "exact", head: true })
    .eq("chave_id", chaveId)
    .is("data_fim", null);

  if (errCount) {
    console.warn("Não foi possível verificar alocações restantes da chave:", errCount.message);
    return;
  }

  // Só libera a chave se não houver mais nenhuma alocação ativa para ela
  if ((count ?? 0) > 0) {
    // Ainda há outros ativos usando esta chave — não libera
    return;
  }

  const { error } = await supabase
    .from("licenses")
    .update({
      status: "disponivel",
      ativo_id: null,
      usuario_id: null,
      data_alocacao: null,
    })
    .eq("id", chaveId);

  if (error) {
    console.warn("Não foi possível liberar a chave de licença após encerrar a alocação:", error.message);
  }
}

/**
 * Encerra uma alocação preservando histórico completo (seta data_fim = agora).
 * Nunca apaga o registro. Se a alocação usava uma chave do módulo Chaves de
 * Licença, ela também é devolvida para o pool de chaves disponíveis.
 */
export async function encerrarAlocacao(
  alocacaoId: string,
  motivo?: string,
): Promise<{ ok: boolean; error?: string }> {
  const now = new Date().toISOString();

  const { data: aloc, error: errSel } = await supabase
    .from("alocacoes")
    .select("*")
    .eq("id", alocacaoId)
    .is("data_fim", null)
    .maybeSingle();

  if (errSel) return { ok: false, error: errSel.message };
  if (!aloc) return { ok: false, error: "Alocação não encontrada ou já encerrada." };

  const observacaoAtual = (aloc as { observacao?: string | null } | null)?.observacao ?? null;
  const chaveId = (aloc as { chave_id?: string | null } | null)?.chave_id ?? null;
  const proximaObservacao = motivo
    ? observacaoAtual
      ? `${observacaoAtual} · ${motivo}`
      : motivo
    : undefined;

  const { error } = await supabase
    .from("alocacoes")
    .update({
      data_fim: now,
      observacao: proximaObservacao,
    })
    .eq("id", alocacaoId)
    .is("data_fim", null);

  if (error) return { ok: false, error: error.message };

  if (chaveId) {
    await liberarChave(chaveId);
  }

  void logAction("BULK_UPDATE", "alocacoes", {
    operacao: "desvincular",
    id: alocacaoId,
    motivo: motivo ?? null,
    chave_id: chaveId,
  });

  return { ok: true };
}

/**
 * Encerra várias alocações de uma vez. Todas as chaves de licença vinculadas
 * às alocações que estavam ativas são devolvidas automaticamente.
 */
export async function encerrarAlocacoes(
  ids: string[],
  motivo?: string,
): Promise<{ ok: boolean; total: number; error?: string }> {
  if (ids.length === 0) return { ok: true, total: 0 };

  const { data: abertas, error: errSel } = await supabase
    .from("alocacoes")
    .select("*")
    .in("id", ids)
    .is("data_fim", null);

  if (errSel) return { ok: false, total: 0, error: errSel.message };

  const idsReais = (abertas ?? []).map((r) => (r as { id: string }).id);
  if (idsReais.length === 0) return { ok: true, total: 0 };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("alocacoes")
    .update({ data_fim: now })
    .in("id", idsReais)
    .is("data_fim", null);

  if (error) return { ok: false, total: 0, error: error.message };

  const chavesParaLiberar = (abertas ?? [])
    .map((r) => (r as { chave_id?: string | null }).chave_id)
    .filter((v): v is string => !!v);

  if (chavesParaLiberar.length > 0) {
    await Promise.all(chavesParaLiberar.map((chaveId) => liberarChave(chaveId)));
  }

  void logAction("BULK_UPDATE", "alocacoes", {
    operacao: "desvincular_massa",
    ids: idsReais,
    total: idsReais.length,
    motivo: motivo ?? null,
    chaves_liberadas: chavesParaLiberar.length,
  });

  return { ok: true, total: idsReais.length };
}

/**
 * Cria uma alocação com validações robustas.
 *
 * Quando a alocação referencia uma chave do módulo Chaves de Licença
 * (tabela licenses), a chave é marcada como alocada, com o ativo e/ou
 * colaborador escolhidos — é assim que a chave “sobe” para aquele ativo.
 */
export async function criarAlocacao(input: {
  licenca_id: string;
  ativo_id?: string | null;
  usuario_id?: string | null;
  observacao?: string | null;
  chave_id?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  // 1. Validar duplicidade apenas quando a alocação está vinculada a um ativo.
  if (input.ativo_id) {
    const { data: existente, error: errExistente } = await supabase
      .from("alocacoes")
      .select("id, chave_id")
      .eq("ativo_id", input.ativo_id)
      .eq("licenca_id", input.licenca_id)
      .is("data_fim", null)
      .maybeSingle();

    if (errExistente) return { ok: false, error: "Erro ao validar duplicidade." };
    if (existente) {
      if (!existente.chave_id && input.chave_id) {
        // O ativo já tem a licença, mas sem chave. Vamos apenas atualizar a alocação existente para incluir a chave!
        const { error: errUpdate } = await supabase
          .from("alocacoes")
          .update({ chave_id: input.chave_id })
          .eq("id", existente.id);
        
        if (errUpdate) return { ok: false, error: "Erro ao atualizar alocação existente com a nova chave." };
        
        // E também marca a chave como alocada na tabela licenses
        const hoje = new Date().toISOString().slice(0, 10);
        await supabase
          .from("licenses")
          .update({
            status: "alocada",
            licenca_id: input.licenca_id,
            ativo_id: input.ativo_id,
            usuario_id: input.usuario_id ?? null,
            data_alocacao: hoje,
          })
          .eq("id", input.chave_id);
          
        return { ok: true };
      }
      return { ok: false, error: "Este ativo já possui esta licença atribuída." };
    }
  }

  if (!input.ativo_id && !input.usuario_id) {
    return { ok: false, error: "Vincule a alocação a um ativo ou colaborador." };
  }

  // 2. Verificar disponibilidade de seat do produto.
  const { data: indicador, error: errInd } = await supabase
    .from("vw_licencas_indicadores")
    .select("disponiveis")
    .eq("licenca_id", input.licenca_id)
    .single();

  if (errInd) return { ok: false, error: "Erro ao validar disponibilidade." };
  if ((indicador?.disponiveis ?? 0) <= 0) {
    return { ok: false, error: "Não existem licenças disponíveis." };
  }

  // 3. Inserir a alocação.
  const payload: Record<string, unknown> = {
    licenca_id: input.licenca_id,
    ativo_id: input.ativo_id ?? null,
    usuario_id: input.usuario_id ?? null,
    observacao: input.observacao ?? null,
  };
  if (input.chave_id) payload.chave_id = input.chave_id;

  const { error, data } = await supabase
    .from("alocacoes")
    .insert(payload as never)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false, error: "ALREADY_ALLOCATED" };
    if (error.code === "23503") {
      return { ok: false, error: "A chave selecionada não existe mais ou deixou de estar disponível." };
    }
    return { ok: false, error: error.message };
  }

  // 4. Associar a chave do módulo Chaves de Licença ao ativo/colaborador.
  // Para licenças multi-seat (Office 2019): a chave permanece com status 'alocada'
  // após a primeira alocação. Só tentamos marcar 'alocada' se ainda estiver 'disponivel'.
  // Se já estiver 'alocada' (outra alocação anterior), simplesmente não tocamos no status.
  if (input.chave_id) {
    const hoje = new Date().toISOString().slice(0, 10);
    // Tenta marcar como 'alocada' apenas se ainda estiver 'disponivel'
    await supabase
      .from("licenses")
      .update({
        status: "alocada",
        licenca_id: input.licenca_id,
        ativo_id: input.ativo_id ?? null,
        usuario_id: input.usuario_id ?? null,
        data_alocacao: hoje,
      })
      .eq("id", input.chave_id)
      .eq("status", "disponivel"); // Só atualiza se ainda estiver disponivel; se já 'alocada' para multi-seat, ok silencioso
  }

  void logAction(
    "BULK_UPDATE",
    "alocacoes",
    {
      operacao: "vincular",
      licenca_id: input.licenca_id,
      ativo_id: input.ativo_id,
      alocacao_id: data?.id,
      chave_id: input.chave_id ?? null,
    },
    data?.id ?? null,
  );

  return { ok: true };
}
