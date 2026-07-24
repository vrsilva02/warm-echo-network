import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AppRole = "admin" | "gestor_ti" | "auditoria";

type InviteInput = {
  email: string;
  nome?: string;
  roles: AppRole[];
  redirectTo?: string;
};

function validate(input: unknown): InviteInput {
  const v = input as Partial<InviteInput> | undefined;
  const email = (v?.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail inválido");
  const allowed: AppRole[] = ["admin", "gestor_ti", "auditoria"];
  const roles = Array.isArray(v?.roles) ? (v!.roles as AppRole[]).filter((r) => allowed.includes(r)) : [];
  if (roles.length === 0) throw new Error("Selecione ao menos um perfil");
  const nome = typeof v?.nome === "string" ? v!.nome.trim() : undefined;
  const redirectTo = typeof v?.redirectTo === "string" ? v!.redirectTo : undefined;
  return { email, nome, roles, redirectTo };
}

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: rerr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (rerr) throw new Error(rerr.message);
    if (!isAdmin) throw new Error("Apenas administradores podem convidar usuários.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: data.nome ? { nome: data.nome } : undefined,
      redirectTo: data.redirectTo,
    });
    if (error) throw new Error(error.message);
    const newUserId = invited.user?.id;
    if (!newUserId) throw new Error("Falha ao criar usuário convidado.");

    // handle_new_user trigger cria profile + role default 'auditoria'. Ajusta para as roles escolhidas.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    const { error: ierr } = await supabaseAdmin
      .from("user_roles")
      .insert(data.roles.map((role) => ({ user_id: newUserId, role })));
    if (ierr) throw new Error(ierr.message);

    if (data.nome) {
      await supabaseAdmin.from("profiles").update({ nome: data.nome }).eq("id", newUserId);
    }

    return { ok: true, userId: newUserId, email: data.email };
  });
