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

    // Registra o início do convite
    const token = crypto.randomUUID();
    const { data: convite, error: cerr } = await supabaseAdmin
      .from("convites")
      .insert({
        email: data.email,
        nome: data.nome,
        roles: data.roles,
        status: "enfileirado",
        enviado_por: context.userId,
        token: token,
        expira_em: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();

    if (cerr) {
      console.error("[inviteUser] Erro ao registrar convite:", cerr);
    } else {
      await supabaseAdmin.from("auditoria_convites").insert({
        convite_id: convite.id,
        evento: "criado",
        detalhes: { roles: data.roles }
      });
    }

    try {
      // Redirecionamos para a nova tela de conclusão de cadastro passando o token
      const officialDomain = "https://gestorait.mtr2tech.com.br";
      const inviteUrl = `${officialDomain}/auth/concluir?token=${token}`;

      console.log(`[inviteUser] Enviando convite via Supabase com redirectTo: ${inviteUrl}`);
      const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
        data: data.nome ? { nome: data.nome } : undefined,
        redirectTo: inviteUrl,
      });
      
      if (error) {
        if (convite) {
          await supabaseAdmin
            .from("convites")
            .update({ status: "falhou", erro: error.message })
            .eq("id", convite.id);
        }
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

      // Atualiza o status para enviado
      if (convite) {
        await supabaseAdmin
          .from("convites")
          .update({ status: "enviado", updated_at: new Date().toISOString() })
          .eq("id", convite.id);
        
        await supabaseAdmin.from("auditoria_convites").insert({
          convite_id: convite.id,
          evento: "enviado"
        });
      }

      console.log(`[inviteUser] Convite finalizado com sucesso para ${data.email}`);
      return { ok: true, userId: newUserId, email: data.email };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      if (convite) {
        await supabaseAdmin
          .from("convites")
          .update({ status: "falhou", erro: msg })
          .eq("id", convite.id);
      }
      throw e;
    }
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((id: unknown) => {
    if (typeof id !== "string" || !id) throw new Error("ID de usuário inválido");
    return id;
  })
  .handler(async ({ data: userIdToDelete, context }) => {
    const { data: isAdmin, error: rerr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });

    if (rerr || !isAdmin) {
      throw new Error("Apenas administradores podem excluir usuários.");
    }

    if (userIdToDelete === context.userId) {
      throw new Error("Você não pode excluir sua própria conta.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userIdToDelete);
    if (error) {
      console.error("[deleteUser] Erro ao excluir usuário:", error);
      throw new Error(error.message);
    }

    return { ok: true };
  });
