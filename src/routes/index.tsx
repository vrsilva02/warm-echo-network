{/* Execute esta instrucao no projeto: esta direcionando para o lovable, lembrando que não pode ter nada direcionando ao lovable deve fazer todo o fluxo direto no gestorait, devido a autenticidade do sistema nada pode interligar com o lovable, tudo deve ser integrado diretamente para o o gestorait. valide todo fluxo do cadastro ate o novo cadastro do usuário sem aparecer o lovable indo direto para validação de novo usuário ou esqueci a senha no gestorait. */}
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  component: IndexRedirect,
  head: () => ({
    meta: [
      { title: "GestoraIT — Painel" },
      { name: "description", content: "Acesso ao painel do sistema GestoraIT." },
    ],
  }),
});

function IndexRedirect() {
  const { loading, session } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return <Navigate to={session ? "/dashboard" : "/auth"} replace />;
}
