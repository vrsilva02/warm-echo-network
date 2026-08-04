import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AppRole = "admin" | "gestor_ti" | "padrao" | "visitante";

type InviteInput = {
  email: string;
  nome?: string;
  roles: AppRole[];
  redirectTo?: string;
};

/**
 * Só aceitamos caminhos internos no redirectTo do convite.
 * Isso evita "open redirect": um atacante não consegue fazer o e-mail de convite
 * apontar para um domínio externo de phishing.
 */
function safeRedirectPath(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  try {
    const url = new URL(value, "http://localhost");
    // Rejeita URLs absolutas para outro host e caminhos protocol-relative (//evil.com)
    if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("//")) return undefined;
    if (url.pathname.length > 512) return undefined;
    return `${url.pathname}${url.search}`;
  } catch {
    return undefined;
  }
}

function validate(input: unknown): InviteInput {
  const v = input as Partial<InviteInput> | undefined;
  const email = (v?.email ?? "").trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail inválido");
  const allowed: AppRole[] = ["admin", "gestor_ti", "padrao", "visitante"];
  const roles = Array.isArray(v?.roles)
    ? Array.from(new Set((v!.roles as AppRole[]).filter((r) => allowed.includes(r))))
    : [];
  if (roles.length === 0) throw new Error("Selecione ao menos um perfil");
  let nome = typeof v?.nome === "string" ? v!.nome.trim().replace(/[\u0000-\u001f<>]/g, "") : undefined;
  if (nome && nome.length > 120) nome = nome.slice(0, 120);
  if (nome === "") nome = undefined;
  const redirectTo = safeRedirectPath(v?.redirectTo);
  return { email, nome, roles, redirectTo };
}

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }) => {
    console.log(`[inviteUser] Invocado por ${context.userId} para o e-mail: ${data.email}`);
    
    const { data: isAdmin, error: rerr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    
    if (rerr) {
      console.error("[inviteUser] Erro ao validar permissões:", rerr);
      throw new Error("Não foi possível validar suas permissões.");
    }
    
    if (!isAdmin) {
      console.warn(`[inviteUser] Usuário ${context.userId} tentou convidar sem ser admin.`);
      throw new Error("Apenas administradores podem convidar usuários.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Usa o redirectTo fornecido ou tenta pegar do ambiente se não for localhost
    let redirectTo: string | undefined = data.redirectTo;
    if (redirectTo) {
      const { getRequestUrl } = await import("@tanstack/react-start/server");
      const url = getRequestUrl();
      const origin = url.origin.includes('localhost') ? 'https://gestorait.mtr2tech.com.br' : url.origin;
      redirectTo = `${origin}${data.redirectTo}`;
    }

    console.log(`[inviteUser] Enviando convite via Supabase com redirectTo: ${redirectTo}`);
    const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: data.nome ? { nome: data.nome } : undefined,
      redirectTo,
    });
    
    if (error) {
      console.error("[inviteUser] Erro no convite do Supabase:", error);
      throw new Error(error.message);
    }
    const newUserId = invited.user?.id;
    if (!newUserId) throw new Error("Falha ao criar usuário convidado.");

    // handle_new_user trigger cria profile + role default 'visitante'. Ajusta para as roles escolhidas.
    const { error: derr } = await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    if (derr) throw new Error("Convite criado, mas falhou ao ajustar os perfis do usuário.");
    const { error: ierr } = await supabaseAdmin
      .from("user_roles")
      .insert(data.roles.map((role) => ({ user_id: newUserId, role })));
    if (ierr) throw new Error("Convite criado, mas falhou ao aplicar os perfis do usuário.");

    if (data.nome) {
      await supabaseAdmin.from("profiles").update({ nome: data.nome }).eq("id", newUserId);
    }


    return { ok: true, userId: newUserId, email: data.email };
  });
