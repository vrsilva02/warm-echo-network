import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { DataTable, ListToolbar, useFilteredList } from "@/components/data-table";
import { CrudDialog } from "@/components/crud-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, FileStack } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useConfirm } from "@/components/confirm-dialog";
import { AditivosDialog } from "@/components/aditivos-dialog";
import { Combobox } from "@/components/combobox";

export const Route = createFileRoute("/_authenticated/contratos")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Contratos — GestoraIT" },
      { name: "description", content: "Gestão de contratos de licenciamento e renovações." },
    ],
  }),
});

type Row = {
  id: string;
  fornecedor: string;
  numero_contrato: string | null;
  tipo_contrato: string | null;
  data_inicio: string;
  data_fim: string | null;
  quantidade_seats: number;
  valor_total: number | null;
  unidade_id: string | null;
  centro_custo_id: string | null;
  cliente_id: string | null;
  clientes?: { nome: string } | null;
};

const TIPOS = ["EA", "MPSA", "Open Value", "NCE", "Perpetua", "SaaS", "Outro"];
const initial = { fornecedor: "", numero_contrato: "", tipo_contrato: "SaaS", data_inicio: "", data_fim: "", quantidade_seats: 0, valor_total: "", unidade_id: null as string | null, centro_custo_id: null as string | null, cliente_id: null as string | null };

function urgencyBadge(dataFim: string | null) {
  if (!dataFim) return <Badge variant="outline">sem vencimento</Badge>;
  const d = Math.floor((new Date(dataFim).getTime() - Date.now()) / 86400000);
  if (d < 0) return <Badge variant="destructive">vencido</Badge>;
  if (d <= 30) return <Badge className="bg-destructive/15 text-destructive border-destructive/30" variant="outline">{d}d — crítico</Badge>;
  if (d <= 90) return <Badge className="bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30" variant="outline">{d}d</Badge>;
  return <Badge variant="outline">{d}d</Badge>;
}

function Page() {
  const { canWrite } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [aditivo, setAditivo] = useState<Row | null>(null);
  const [form, setForm] = useState(initial);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["contratos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contratos").select("*, clientes(nome)").order("data_fim", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as unknown as Row[];
    },
  });
  const { data: unidades } = useQuery({
    queryKey: ["unidades-lite"],
    queryFn: async () => (await supabase.from("unidades").select("id, nome").eq("ativo", true).order("nome")).data ?? [],
  });
  const { data: centros } = useQuery({
    queryKey: ["centros_custo-lite"],
    queryFn: async () => (await supabase.from("centros_custo").select("id,nome").order("nome")).data ?? [],
  });
  const { data: clientes } = useQuery({
    queryKey: ["clientes-lite"],
    queryFn: async () => (await supabase.from("clientes").select("id,nome").eq("ativo", true).order("nome")).data ?? [],
  });
  const filtered = useFilteredList(rows, q, ["fornecedor", "numero_contrato", "tipo_contrato"]);

  function openNew() { setEditing(null); setForm(initial); setOpen(true); }
  function openEdit(r: Row) {
    setEditing(r);
    setForm({
      fornecedor: r.fornecedor,
      numero_contrato: r.numero_contrato ?? "",
      tipo_contrato: r.tipo_contrato ?? "SaaS",
      data_inicio: r.data_inicio,
      data_fim: r.data_fim ?? "",
      quantidade_seats: r.quantidade_seats,
      valor_total: r.valor_total?.toString() ?? "",
      unidade_id: r.unidade_id,
      centro_custo_id: r.centro_custo_id,
      cliente_id: r.cliente_id,
    });
    setOpen(true);
  }
  async function save() {
    const payload = {
      fornecedor: form.fornecedor.trim(),
      numero_contrato: form.numero_contrato || null,
      tipo_contrato: form.tipo_contrato || null,
      data_inicio: form.data_inicio,
      data_fim: form.data_fim || null,
      quantidade_seats: Number(form.quantidade_seats) || 0,
      valor_total: form.valor_total ? Number(form.valor_total) : null,
      unidade_id: form.unidade_id,
      centro_custo_id: form.centro_custo_id,
      cliente_id: form.cliente_id,
    };
    const { error } = editing
      ? await supabase.from("contratos").update(payload).eq("id", editing.id)
      : await supabase.from("contratos").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    qc.invalidateQueries({ queryKey: ["contratos"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }
  async function remove(row: Row) {
    const { count } = await supabase.from("licencas").select("id", { count: "exact", head: true }).eq("contrato_id", row.id);
    const ok = await confirm({
      title: "Excluir contrato?",
      description: "Licenças vinculadas ficarão sem contrato associado. Ação irreversível.",
      tone: "danger",
      impact: [
        { label: "Fornecedor", value: row.fornecedor },
        { label: "Contrato", value: row.numero_contrato ?? "—" },
        { label: "Seats contratados", value: row.quantidade_seats },
        { label: "Licenças vinculadas", value: count ?? 0, tone: (count ?? 0) > 0 ? "danger" : "default" },
      ],
      confirmLabel: "Excluir",
    });
    if (!ok) return;
    const { error } = await supabase.from("contratos").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["contratos"] });
  }

  return (
    <>
      <PageHeader
        title="Contratos"
        description="Fornecedores, seats contratados e datas de renovação."
        actions={canWrite ? <Button size="sm" onClick={openNew}>Novo contrato</Button> : undefined}
      />
      <ListToolbar query={q} onQueryChange={setQ} />
      <DataTable
        columns={["Fornecedor", "Cliente", "Nº", "Tipo", "Início", "Fim", "Seats", "Valor", "Vencimento", "Ações"]}
        empty={isLoading ? "Carregando…" : "Nenhum contrato."}
        rows={filtered.map((r) => [
          <span key="f" className="font-medium">{r.fornecedor}</span>,
          r.clientes?.nome ?? "—",
          r.numero_contrato ?? "—",
          r.tipo_contrato ?? "—",
          r.data_inicio,
          r.data_fim ?? "—",
          r.quantidade_seats,
          r.valor_total ? `R$ ${r.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—",
          urgencyBadge(r.data_fim),
          <div key="a" className="flex gap-1">
            <Button size="icon" variant="ghost" title="Aditivos" onClick={() => setAditivo(r)}>
              <FileStack className="h-4 w-4" />
            </Button>
            {canWrite && <>
              <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button>
            </>}
          </div>,
        ])}
      />
      <CrudDialog title={editing ? "Editar contrato" : "Novo contrato"} open={open} onOpenChange={setOpen} onSubmit={save} trigger={null}>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Fornecedor</Label><Input required value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} /></div>
          <div><Label>Nº contrato</Label><Input value={form.numero_contrato} onChange={(e) => setForm({ ...form, numero_contrato: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo</Label>
            <Select value={form.tipo_contrato} onValueChange={(v) => setForm({ ...form, tipo_contrato: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Seats</Label><Input type="number" min={0} value={form.quantidade_seats} onChange={(e) => setForm({ ...form, quantidade_seats: Number(e.target.value) })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Início</Label><Input type="date" required value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} /></div>
          <div><Label>Fim</Label><Input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Valor total (R$)</Label><Input type="number" step="0.01" value={form.valor_total} onChange={(e) => setForm({ ...form, valor_total: e.target.value })} /></div>
          <div>
            <Label>Unidade</Label>
            <Combobox
              placeholder="Nenhuma"
              searchPlaceholder="Buscar unidade…"
              value={form.unidade_id}
              onChange={(v) => setForm({ ...form, unidade_id: v })}
              options={(unidades ?? []).map((u) => ({ value: u.id, label: u.nome }))}
            />
          </div>
        </div>
        <div>
          <Label>Centro de custo</Label>
          <Combobox
            placeholder="Nenhum"
            searchPlaceholder="Buscar centro…"
            value={form.centro_custo_id}
            onChange={(v) => setForm({ ...form, centro_custo_id: v })}
            options={(centros ?? []).map((c: any) => ({ value: c.id, label: c.nome }))}
          />
        </div>
        <div>
          <Label>Cliente</Label>
          <Combobox
            placeholder="Nenhum"
            searchPlaceholder="Buscar cliente…"
            value={form.cliente_id}
            onChange={(v) => setForm({ ...form, cliente_id: v })}
            options={(clientes ?? []).map((c: any) => ({ value: c.id, label: c.nome }))}
          />
        </div>
      </CrudDialog>
      <AditivosDialog
        contratoId={aditivo?.id ?? null}
        contratoLabel={aditivo ? `${aditivo.fornecedor}${aditivo.numero_contrato ? " · " + aditivo.numero_contrato : ""}` : ""}
        open={!!aditivo}
        onOpenChange={(v) => !v && setAditivo(null)}
      />
    </>
  );
}
