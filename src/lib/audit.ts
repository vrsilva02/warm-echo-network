import { supabase } from "@/integrations/supabase/client";

export type AuditAction = "EXPORT" | "BULK_UPDATE" | "BULK_DELETE" | "VIEW" | "LOGIN";

/**
 * Registra uma ação da aplicação no log de auditoria.
 * Usa a função SECURITY DEFINER `fn_log_action` — usuário e horário
 * são preenchidos automaticamente pelo servidor.
 */
export async function logAction(
  acao: AuditAction,
  tabela: string,
  metadata: Record<string, unknown>,
  registroId: string | null = null,
) {
  try {
    await supabase.rpc("fn_log_action", {
      p_acao: acao,
      p_tabela: tabela,
      p_registro_id: registroId,
      p_metadata: metadata as any,
    });
  } catch (err) {
    // Não interrompe a operação principal em caso de falha do log.
    console.warn("audit log failed", err);
  }
}
