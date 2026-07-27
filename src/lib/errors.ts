/** Traduz erros do Supabase/PostgREST para mensagens amigáveis em pt-BR. */
export function friendlyError(err: unknown, fallback = "Ocorreu um erro. Tente novamente."): string {
  const anyErr = err as { code?: string; message?: string; details?: string } | null;
  const code = anyErr?.code ?? "";
  const msg = (anyErr?.message ?? "").toLowerCase();

  if (
    code === "42501" ||
    msg.includes("permission denied") ||
    msg.includes("row-level security") ||
    msg.includes("row level security") ||
    msg.includes("violates row-level")
  ) {
    return "Você não tem permissão para executar esta ação. Solicite acesso a um administrador ou gestor de TI.";
  }
  if (code === "23503" || msg.includes("foreign key")) {
    return "Não é possível concluir: existem registros vinculados a este item.";
  }
  if (code === "23505" || msg.includes("duplicate key") || msg.includes("unique constraint")) {
    return "Já existe um registro com esses dados.";
  }
  if (msg.includes("jwt") || msg.includes("unauthorized")) {
    return "Sessão expirada. Faça login novamente.";
  }
  return anyErr?.message || fallback;
}
