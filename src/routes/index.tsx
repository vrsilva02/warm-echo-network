/**
 * Execute esta instrucao no projeto: Quero que você refatore completamente a lógica do módulo de Gestão de Licenças do meu sistema de Asset Management (ITAM), mantendo o layout atual e alterando apenas a lógica de negócio, validações e persistência de dados.
 * O objetivo é transformar este módulo em um sistema robusto de controle de licenças, garantindo integridade dos dados, atualização automática dos indicadores e impedindo inconsistências.
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
