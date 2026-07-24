import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/alertas")({
  component: () => (
    <>
      <PageHeader title="Alertas" description="Contratos vencendo, déficit de licenças e ociosidade." />
      <EmptyState title="Módulo em desenvolvimento" description="Alertas consolidados serão gerados a partir das views vw_contratos_vencendo, vw_elp e vw_licencas_ociosas." />
    </>
  ),
  head: () => ({ meta: [{ title: "Alertas — ITAM/SAM" }, { name: "description", content: "Central de alertas de compliance." }] }),
});
