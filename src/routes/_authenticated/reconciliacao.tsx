import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/page-header";

function make(path: string, title: string, desc: string) {
  return createFileRoute(path as any)({
    component: () => (
      <>
        <PageHeader title={title} description={desc} />
        <EmptyState title="Módulo em desenvolvimento" description="Disponível na próxima fase (Reconciliação, Alertas, Auditoria, Relatórios)." />
      </>
    ),
    head: () => ({ meta: [{ title: `${title} — ITAM/SAM` }, { name: "description", content: desc }] }),
  });
}

export const Route = make("/_authenticated/reconciliacao", "Reconciliação", "Importação de inventário e cruzamento com o catálogo.");
