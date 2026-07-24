import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/relatorios")({
  component: () => (
    <>
      <PageHeader title="Relatórios" description="Exportação de compliance, ELP e inventário." />
      <EmptyState title="Módulo em desenvolvimento" description="Exportações CSV/PDF por fabricante e categoria virão na próxima fase." />
    </>
  ),
  head: () => ({ meta: [{ title: "Relatórios — ITAM/SAM" }, { name: "description", content: "Exportações de compliance e ELP." }] }),
});
