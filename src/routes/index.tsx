/**
 * Execute esta instrucao no projeto: Implemente que cada card do Dashboard sobre licenças abra uma visão detalhada de licenças e ativos associados, com os mesmos filtros e período do resumo.
 * Inclua no Dashboard gráficos e badges para conformidade de licenças por status (ok, risco, não conforme) e permita filtrar o resumo por esses status.
 * Crie filtros avançados e salvos para a página de Licenças, permitindo buscas por status, fabricante, categoria e percentual de uso.
 * Implemente atualização automática do dashboard com refresh periódico e gráficos de tendências de compliance e uso das licenças.
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
