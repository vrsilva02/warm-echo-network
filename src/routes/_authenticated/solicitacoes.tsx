import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { AdvancedTable, type Column } from "@/components/advanced-table";
import { CrudDialog } from "@/components/crud-dialog";
import { EmptyState } from "@/components/empty-state";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/combobox";
import { StatusPill, type StatusTone } from "@/components/status-pill";
import { ClipboardList, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useConfirm } from "@/components/confirm-dialog";
import { logAction } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/solicitacoes")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Solicitações — Gestorait" },
      { name: "description", content: "Workflow de aprovação de solicitações de licenças." },
    ],
  }),
});

type Row = {
  id: string;
  solicitante_id: string;
  produto_id: string;
  quantidade: number;
  justificativa: string;
  status: "pendente" | "aprovada" | "rejeitada" | "cancelada";
  aprovador_id: string | null;
  decidido_em: string | null;
  motivo_decisao: string | null;
  created_at: string;
  produtos_catalogo?: { nome_oficial: string } | null;
};

const STATUS_TONE: Record<Row["status"], StatusTone> = {
  pendente: "warn",
  aprovada: "ok",
  rejeitada: "critical",
  cancelada: "neutral",
};

function Page() {
  const { user, isAdmin, isGestor } = useAuth();
  const canApprove = isAdmin || isGestor;
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ produto_id: "", quantidade: 1, justificativa: "" });

  const { data: rows, isLoading } = useQuery({
    queryKey: ["solicitacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitacoes_licenca")
        .select("*, produtos_catalogo(nome_oficial)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Row[];
    },
  });
  const { data: produtos } = useQuery({
    queryKey: ["produtos-lite"],
    queryFn: async () =>
      (await supabase.from("produtos_catalogo").select("id, nome_oficial").order("nome_oficial")).data ?? [],
  });
  const { data: profiles } = useQuery({
    queryKey: ["profiles-lite"],
    queryFn: async () => (await supabase.from("profiles").select("id, nome, email")).data ?? [],
  });
  const nomeOf = (id: string | null) => {
    if (!id) return "—";
    const p = profiles?.find((x) => x.id === id);
    return p?.nome ?? p?.email ?? id.slice(0, 8);
  };

  async function submit() {
    if (!user) return;
    if (!form.produto_id) return toast.error("Selecione o produto");
    if (!form.justificativa.trim()) return toast.error("Descreva a justificativa");
    const { error } = await supabase.from("solicitacoes_licenca").insert({
      solicitante_id: user.id,
      produto_id: form.produto_id,
      quantidade: form.quantidade,
      justificativa: form.justificativa.trim(),
    });
    if (error) return toast.error(error.message);
    toast.success("Solicitação enviada");
    setForm({ produto_id: "", quantidade: 1, justificativa: "" });
    qc.invalidateQueries({ queryKey: ["solicitacoes"] });
  }

  async function decidir(row: Row, aprovar: boolean) {
    const ok = await confirm({
      title: aprovar ? "Aprovar solicitação?" : "Rejeitar solicitação?",
      description: aprovar
        ? "A solicitação será marcada como aprovada. Registre a licença correspondente em seguida."
        : "A solicitação será marcada como rejeitada.",
      tone: aprovar ? "default" : "danger",
      impact: [
        { label: "Produto", value: row.produtos_catalogo?.nome_oficial ?? "—" },
        { label: "Quantidade", value: row.quantidade },
        { label: "Solicitante", value: nomeOf(row.solicitante_id) },
      ],
      confirmLabel: aprovar ? "Aprovar" : "Rejeitar",
    });
    if (!ok || !user) return;
    const { error } = await supabase
      .from("solicitacoes_licenca")
      .update({
        status: aprovar ? "aprovada" : "rejeitada",
        aprovador_id: user.id,
        decidido_em: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    void logAction("BULK_UPDATE", "solicitacoes_licenca", { id: row.id, decisao: aprovar ? "aprovada" : "rejeitada" });
    toast.success(aprovar ? "Aprovada" : "Rejeitada");
    qc.invalidateQueries({ queryKey: ["solicitacoes"] });
  }

  async function cancelar(row: Row) {
    const ok = await confirm({ title: "Cancelar solicitação?", tone: "warn", confirmLabel: "Cancelar solicitação" });
    if (!ok) return;
    const { error } = await supabase
      .from("solicitacoes_licenca")
      .update({ status: "cancelada" })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["solicitacoes"] });
  }

  const columns: Column<Row>[] = [
    {
      id: "produto",
      header: "Produto",
      accessor: (r) => <span className="font-medium">{r.produtos_catalogo?.nome_oficial ?? "—"}</span>,
      sortValue: (r) => r.produtos_catalogo?.nome_oficial ?? "",
      searchValue: (r) => r.produtos_catalogo?.nome_oficial,
      exportValue: (r) => r.produtos_catalogo?.nome_oficial,
    },
    { id: "qtd", header: "Qtd", numeric: true, accessor: (r) => r.quantidade, sortValue: (r) => r.quantidade, exportValue: (r) => r.quantidade },
    {
      id: "solicitante",
      header: "Solicitante",
      accessor: (r) => nomeOf(r.solicitante_id),
      searchValue: (r) => nomeOf(r.solicitante_id),
      exportValue: (r) => nomeOf(r.solicitante_id),
    },
    {
      id: "justificativa",
      header: "Justificativa",
      accessor: (r) => <span className="text-xs text-muted-foreground line-clamp-2">{r.justificativa}</span>,
      searchValue: (r) => r.justificativa,
      exportValue: (r) => r.justificativa,
    },
    {
      id: "status",
      header: "Status",
      accessor: (r) => <StatusPill tone={STATUS_TONE[r.status]}>{r.status}</StatusPill>,
      sortValue: (r) => r.status,
      exportValue: (r) => r.status,
    },
    {
      id: "aprovador",
      header: "Decidido por",
      defaultHidden: true,
      accessor: (r) => (r.aprovador_id ? nomeOf(r.aprovador_id) : "—"),
      exportValue: (r) => (r.aprovador_id ? nomeOf(r.aprovador_id) : ""),
    },
    {
      id: "data",
      header: "Data",
      accessor: (r) => new Date(r.created_at).toLocaleDateString("pt-BR"),
      sortValue: (r) => r.created_at,
      exportValue: (r) => r.created_at,
    },
    {
      id: "acoes",
      header: "Ações",
      alwaysVisible: true,
      accessor: (r) => (
        <div className="flex gap-1">
          {r.status === "pendente" && canApprove && (
            <>
              <Button size="icon" variant="ghost" title="Aprovar" onClick={() => decidir(r, true)}>
                <Check className="h-4 w-4 text-[color:var(--success)]" />
              </Button>
              <Button size="icon" variant="ghost" title="Rejeitar" onClick={() => decidir(r, false)}>
                <X className="h-4 w-4 text-destructive" />
              </Button>
            </>
          )}
          {r.status === "pendente" && r.solicitante_id === user?.id && !canApprove && (
            <Button size="sm" variant="ghost" onClick={() => cancelar(r)}>
              Cancelar
            </Button>
          )}
        </div>
      ),
    },
  ];

  const pendentes = (rows ?? []).filter((r) => r.status === "pendente").length;

  return (
    <>
      <PageHeader
        title="Solicitações de Licença"
        description={pendentes > 0 ? `${pendentes} solicitação(ões) pendente(s) de aprovação.` : "Workflow de solicitação e aprovação."}
        actions={<Button size="sm" onClick={() => setOpen(true)}>Nova solicitação</Button>}
      />
      <AdvancedTable<Row>
        storageKey="solicitacoes"
        rows={rows}
        isLoading={isLoading}
        columns={columns}
        getRowId={(r) => r.id}
        exportFilename="solicitacoes"
        savedViews={[
          { id: "pendentes", label: "Pendentes", filter: (rs) => rs.filter((r) => r.status === "pendente") },
          { id: "minhas", label: "Minhas", filter: (rs) => rs.filter((r) => r.solicitante_id === user?.id) },
          { id: "aprovadas", label: "Aprovadas", filter: (rs) => rs.filter((r) => r.status === "aprovada") },
        ]}
        emptyState={
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title="Nenhuma solicitação"
            description="Solicite licenças adicionais para produtos do catálogo."
            action={<Button size="sm" onClick={() => setOpen(true)}>Nova solicitação</Button>}
          />
        }
      />
      <CrudDialog title="Nova solicitação de licença" open={open} onOpenChange={setOpen} onSubmit={submit} trigger={null}>
        <div>
          <Label>Produto *</Label>
          <Combobox
            placeholder="Selecione…"
            searchPlaceholder="Buscar produto…"
            clearable={false}
            value={form.produto_id || null}
            onChange={(v) => setForm({ ...form, produto_id: v ?? "" })}
            options={(produtos ?? []).map((p) => ({ value: p.id, label: p.nome_oficial }))}
          />
        </div>
        <div>
          <Label>Quantidade *</Label>
          <Input
            type="number"
            min={1}
            value={form.quantidade}
            onChange={(e) => setForm({ ...form, quantidade: Math.max(1, Number(e.target.value) || 1) })}
          />
        </div>
        <div>
          <Label>Justificativa *</Label>
          <Textarea
            rows={4}
            placeholder="Por que essa licença é necessária?"
            value={form.justificativa}
            onChange={(e) => setForm({ ...form, justificativa: e.target.value })}
          />
        </div>
      </CrudDialog>
    </>
  );
}
