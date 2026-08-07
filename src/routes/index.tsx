{/* Execute esta instrucao no projeto: Exibir um status detalhado da sincronização (última atualização, duração e contagem de registros) diretamente na página de cada relatório. */}
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
