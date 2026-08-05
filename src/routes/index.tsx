/**
 * Execute esta instrucao no projeto: Garanta que os indicadores e badges de alerta de cada licença/ativo sejam atualizados em tempo real em todas as telas sem recarregar a página.
 * Implemente uma página e filtros de auditoria para eu acompanhar todas as movimentações (licença atribuída/removida/alteração de quantidade) com usuário, data e hora.
 * Adicione testes automatizados de integração cobrindo atribuição/remoção, validação de duplicidade UNIQUE(asset_id, license_id), bloqueio de saldo negativo e transações atômicas.
 * Implemente uma opção para eu exportar em CSV ou PDF um relatório com totais, atribuídas, disponíveis, percentual utilizado e alertas por status.
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
