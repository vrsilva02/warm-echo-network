import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const concluirSchema = z.object({
  token: z.string().uuid(),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
});

export const getConviteByToken = createServerFn({ method: "GET" })
  .inputValidator((token: unknown) => z.string().uuid().parse(token))
  .handler(async ({ data: token }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data: convite, error } = await supabaseAdmin
      .from("convites")
      .select("id, email, nome, status, expira_em, aceito_em")
      .eq("token", token)
      .single();

    if (error || !convite) {
      return { valid: false, error: "Convite inválido." };
    }

    if (convite.aceito_em || convite.status === "aceito") {
      return { valid: false, error: "Este convite já foi utilizado." };
    }

    const expiraEm = convite.expira_em ? new Date(convite.expira_em as string) : null;
    if (expiraEm && expiraEm < new Date()) {
      return { valid: false, error: "Este convite expirou. Solicite um novo convite ao administrador." };
    }

    return { valid: true, email: convite.email, nome: convite.nome };
  });

export const finalizarCadastro = createServerFn({ method: "POST" })
  .inputValidator((data) => concluirSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // 1. Valida o convite novamente no server
    const { data: convite, error: cerr } = await supabaseAdmin
      .from("convites")
      .select("*")
      .eq("token", data.token)
      .single();

    if (cerr || !convite) throw new Error("Convite inválido.");
    if (convite.aceito_em) throw new Error("Convite já utilizado.");
    
    const expiraEm = convite.expira_em ? new Date(convite.expira_em as string) : null;
    if (expiraEm && expiraEm < new Date()) throw new Error("Convite expirado.");

    // 2. Busca o ID do usuário pelo e-mail (usuário criado no invite)
    const { data: userData, error: uerr } = await supabaseAdmin.auth.admin.listUsers();
    if (uerr) throw new Error("Falha ao processar cadastro.");
    
    const user = userData.users.find(u => u.email === convite.email);
    if (!user) throw new Error("Usuário não encontrado.");

    // 3. Atualiza a senha do usuário
    const { error: perr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: data.password,
      email_confirm: true 
    });
    if (perr) throw new Error("Erro ao definir senha: " + perr.message);

    // 4. Marca convite como aceito
    const agora = new Date().toISOString();
    await supabaseAdmin
      .from("convites")
      .update({ 
        status: "aceito", 
        aceito_em: agora,
        updated_at: agora 
      })
      .eq("id", convite.id);

    // 5. Auditoria
    await supabaseAdmin.from("auditoria_convites").insert({
      convite_id: convite.id,
      evento: "aceito",
      detalhes: { user_id: user.id }
    });

    // 6. Atualiza perfil
    await supabaseAdmin
      .from("profiles")
      .update({ updated_at: agora })
      .eq("id", user.id);

    return { success: true };
  });
