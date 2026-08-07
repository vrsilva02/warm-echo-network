{/* Execute esta instrucao no projeto: em relatórios, preciso que os relatório abaixo sejam sincronizados para gerar o relatório. Neste momento estes relatórios estão em branco

Relatório de ordens de serviço
Ativos sem Cobertura de EDR
Custo por licença ociosa por periodo */}
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
