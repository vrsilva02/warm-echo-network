/**
 * Execute esta instrucao no projeto: Verificar se o link do convite funciona corretamente em diferentes clientes de e-mail e dispositivos, garantindo que sempre leve para a página de cadastro de senha (/auth/concluir).
 * Adicionar testes automatizados de integração para o fluxo completo de convite, validação de token na rota /auth/concluir e verificação de que o usuário vê a tela de cadastro de senha.
 */
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
