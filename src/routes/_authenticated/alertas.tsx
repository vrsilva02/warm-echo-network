import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/data-table";
import { AlertTriangle, FileWarning, Snowflake, XCircle, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/alertas")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Alertas — Gestorait" },
      { name: "description", content: "Central de alertas: contratos vencendo, déficit de compliance e licenças ociosas." },
    ],
  }),
});

type Sev = "critico" | "alto" | "medio";
type Alerta = {
  id: string;
  tipo: "contrato" | "compliance" | "ocioso";
  severidade: Sev;
  titulo: string;
  descricao: string;
  detalhe: string;
  acaoLink?: string;
  acaoLabel?: string;
};

function useAlertas() {
  return useQuery({
    queryKey: ["alertas"],
    queryFn: async () => {
      const [vc, elp, oc] = await Promise.all([
        supabase.from("vw_contratos_vencendo").select("*"),
        supabase.from("vw_elp").select("*"),
        supabase.from("vw_licencas_ociosas").select("*"),
      ]);
      const alertas: Alerta[] = [];

      // Contratos
      for (const c of (vc.data ?? []) as any[]) {
        const dias = c.dias_para_vencer;
        if (dias == null || dias > 90) continue;
        const sev: Sev = dias < 0 ? "critico" : dias <= 30 ? "critico" : dias <= 60 ? "alto" : "medio";
        alertas.push({
          id: `c-${c.id}`,
          tipo: "contrato",
          severidade: sev,
          titulo: `${c.fornecedor} — ${c.numero_contrato ?? "sem número"}`,
          descricao: dias < 0 ? `Vencido há ${Math.abs(dias)} dia(s)` : `Vence em ${dias} dia(s) (${c.data_fim})`,
          detalhe: `Tipo ${c.tipo_contrato ?? "—"} · ${c.quantidade_seats} seats`,
          acaoLink: "/contratos",
          acaoLabel: "Ver contratos",
        });
      }

      // Compliance (déficit ELP)
      for (const p of (elp.data ?? []) as any[]) {
        if (p.status_compliance !== "deficit") continue;
        const excesso = Number(p.licencas_alocadas) - Number(p.licencas_compradas);
        alertas.push({
          id: `d-${p.produto_id}`,
          tipo: "compliance",
          severidade: excesso > 10 ? "critico" : "alto",
          titulo: `Déficit em ${p.nome_oficial}`,
          descricao: `${excesso} licença(s) alocadas além do adquirido`,
          detalhe: `${p.licencas_alocadas} alocadas / ${p.licencas_compradas} compradas · ${p.categoria}`,
          acaoLink: "/licencas",
          acaoLabel: "Revisar licenças",
        });
      }

      // Ociosidade
      for (const o of (oc.data ?? []) as any[]) {
        alertas.push({
          id: `o-${o.licenca_id}`,
          tipo: "ocioso",
          severidade: "medio",
          titulo: `${o.nome_oficial} ocioso`,
          descricao: `Quantidade ${o.quantidade} sem alocação há +90 dias`,
          detalhe: o.ultima_desalocacao ? `Última desalocação: ${new Date(o.ultima_desalocacao).toLocaleDateString("pt-BR")}` : "Sem histórico de alocação",
          acaoLink: "/alocacoes",
          acaoLabel: "Ver alocações",
        });
      }

      return alertas;
    },
  });
}

const SEV_ORDER: Record<Sev, number> = { critico: 0, alto: 1, medio: 2 };

function Page() {
  const { data, isLoading } = useAlertas();
  const [tab, setTab] = useState<"todos" | "contrato" | "compliance" | "ocioso">("todos");

  const alertas = useMemo(() => {
    const list = (data ?? []).slice().sort((a, b) => SEV_ORDER[a.severidade] - SEV_ORDER[b.severidade]);
    if (tab === "todos") return list;
    return list.filter((a) => a.tipo === tab);
  }, [data, tab]);

  const counts = useMemo(() => {
    const c = { total: 0, critico: 0, alto: 0, medio: 0, contrato: 0, compliance: 0, ocioso: 0 };
    (data ?? []).forEach((a) => {
      c.total++;
      c[a.severidade]++;
      c[a.tipo]++;
    });
    return c;
  }, [data]);

  return (
    <>
      <PageHeader title="Alertas" description="Regras automáticas com base em contratos, compliance ELP e licenças ociosas." />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <KpiCard title="Total" value={counts.total} icon={<ShieldCheck className="h-4 w-4" />} />
        <KpiCard title="Críticos" value={counts.critico} tone="destructive" icon={<XCircle className="h-4 w-4" />} />
        <KpiCard title="Altos" value={counts.alto} tone="warning" icon={<AlertTriangle className="h-4 w-4" />} />
        <KpiCard title="Médios" value={counts.medio} tone="muted" icon={<Snowflake className="h-4 w-4" />} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mb-4">
        <TabsList>
          <TabsTrigger value="todos">Todos ({counts.total})</TabsTrigger>
          <TabsTrigger value="contrato">
            <FileWarning className="h-3 w-3 mr-1" /> Contratos ({counts.contrato})
          </TabsTrigger>
          <TabsTrigger value="compliance">
            <XCircle className="h-3 w-3 mr-1" /> Compliance ({counts.compliance})
          </TabsTrigger>
          <TabsTrigger value="ocioso">
            <Snowflake className="h-3 w-3 mr-1" /> Ociosidade ({counts.ocioso})
          </TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <DataTable
            columns={["Severidade", "Tipo", "Alerta", "Detalhe", "Ação"]}
            empty={isLoading ? "Carregando…" : "Nenhum alerta no momento. Tudo em conformidade."}
            rows={alertas.map((a) => [
              <SevBadge key="s" sev={a.severidade} />,
              <TipoBadge key="t" tipo={a.tipo} />,
              <div key="a">
                <div className="font-medium">{a.titulo}</div>
                <div className="text-xs text-muted-foreground">{a.descricao}</div>
              </div>,
              <span key="d" className="text-sm text-muted-foreground">{a.detalhe}</span>,
              a.acaoLink ? (
                <Button key="ac" asChild size="sm" variant="outline">
                  <Link to={a.acaoLink}>{a.acaoLabel}</Link>
                </Button>
              ) : null,
            ])}
          />
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader><CardTitle className="text-sm">Regras aplicadas</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>· <strong className="text-foreground">Contrato crítico:</strong> vencido ou vence em até 30 dias.</p>
          <p>· <strong className="text-foreground">Contrato alto:</strong> vence entre 31 e 60 dias.</p>
          <p>· <strong className="text-foreground">Contrato médio:</strong> vence entre 61 e 90 dias.</p>
          <p>· <strong className="text-foreground">Compliance:</strong> qualquer produto com status <em>déficit</em> no ELP (alocado &gt; comprado).</p>
          <p>· <strong className="text-foreground">Ociosidade:</strong> licenças sem alocação ativa há mais de 90 dias.</p>
        </CardContent>
      </Card>
    </>
  );
}

function KpiCard({ title, value, icon, tone }: { title: string; value: number; icon: React.ReactNode; tone?: "destructive" | "warning" | "muted" }) {
  const cls = tone === "destructive" ? "text-destructive" : tone === "warning" ? "text-[color:var(--warning)]" : tone === "muted" ? "text-muted-foreground" : "";
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
        <span className={cls}>{icon}</span>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-semibold ${cls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function SevBadge({ sev }: { sev: Sev }) {
  if (sev === "critico") return <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30">Crítico</Badge>;
  if (sev === "alto") return <Badge variant="outline" className="bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30">Alto</Badge>;
  return <Badge variant="outline">Médio</Badge>;
}

function TipoBadge({ tipo }: { tipo: Alerta["tipo"] }) {
  const map = { contrato: "Contrato", compliance: "Compliance", ocioso: "Ociosidade" } as const;
  return <Badge variant="outline">{map[tipo]}</Badge>;
}
