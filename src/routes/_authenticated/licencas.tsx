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
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/licencas")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Licenças — ITAM/SAM" },
      { name: "description", content: "Blocos de licenças por produto e contrato." },
    ],
  }),
});

type Row = {
  id: string;
  produto_id: string | null;
  contrato_id: string | null;
  quantidade: number;
  chave_ativacao: string | null;
  data_expiracao: string | null;
  produtos_catalogo?: { nome_oficial: string } | null;
  contratos?: { fornecedor: string; numero_contrato: string | null } | null;
};

const initial = { produto_id: "", contrato_id: null as string | null, quantidade: 1, chave_ativacao: "", data_expiracao: "" };

function Page() {
  const { canWrite } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState(initial);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["licencas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("licencas")
        .select("*, produtos_catalogo(nome_oficial), contratos(fornecedor, numero_contrato)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Row[];
    },
  });
  const { data: produtos } = useQuery({
    queryKey: ["produtos-lite"],
    queryFn: async () => (await supabase.from("produtos_catalogo").select("id, nome_oficial").order("nome_oficial")).data ?? [],
  });
  const { data: contratos } = useQuery({
    queryKey: ["contratos-lite"],
    queryFn: async () => (await supabase.from("contratos").select("id, fornecedor, numero_contrato").order("fornecedor")).data ?? [],
  });

  const filtered = useFilteredList(rows, q, ["chave_ativacao"]);

  function openNew() { setEditing(null); setForm(initial); setOpen(true); }
  function openEdit(r: Row) {
    setEditing(r);
    setForm({
      produto_id: r.produto_id ?? "",
      contrato_id: r.contrato_id,
      quantidade: r.quantidade,
      chave_ativacao: r.chave_ativacao ?? "",
      data_expiracao: r.data_expiracao ?? "",
    });
    setOpen(true);
  }
  async function save() {
    if (!form.produto_id) return toast.error("Selecione o produto");
    const payload = {
      produto_id: form.produto_id,
      contrato_id: form.contrato_id,
      quantidade: Number(form.quantidade) || 1,
      chave_ativacao: form.chave_ativacao || null,
      data_expiracao: form.data_expiracao || null,
    };
    const { error } = editing
      ? await supabase.from("licencas").update(payload).eq("id", editing.id)
      : await supabase.from("licencas").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    qc.invalidateQueries({ queryKey: ["licencas"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }
  async function remove(id: string) {
    if (!confirm("Excluir licença?")) return;
    const { error } = await supabase.from("licencas").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["licencas"] });
  }

  return (
    <>
      <PageHeader
        title="Licenças"
        description="Cada linha representa um bloco de licenças de um produto/contrato."
        actions={canWrite ? <Button size="sm" onClick={openNew}>Nova licença</Button> : undefined}
      />
      <ListToolbar query={q} onQueryChange={setQ} />
      <DataTable
        columns={["Produto", "Contrato", "Qtd", "Chave", "Expiração", "Ações"]}
        empty={isLoading ? "Carregando…" : "Nenhuma licença."}
        rows={filtered.map((r) => [
          <span key="p" className="font-medium">{r.produtos_catalogo?.nome_oficial ?? "—"}</span>,
          r.contratos ? `${r.contratos.fornecedor}${r.contratos.numero_contrato ? " · " + r.contratos.numero_contrato : ""}` : "—",
          <span key="q" className="font-mono">{r.quantidade}</span>,
          r.chave_ativacao ? <span key="k" className="font-mono text-xs">{r.chave_ativacao.slice(0, 12)}…</span> : "—",
          r.data_expiracao ?? "—",
          <div key="a" className="flex gap-1">
            {canWrite && <>
              <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
            </>}
          </div>,
        ])}
      />
      <CrudDialog title={editing ? "Editar licença" : "Nova licença"} open={open} onOpenChange={setOpen} onSubmit={save} trigger={null}>
        <div>
          <Label>Produto *</Label>
          <Select value={form.produto_id} onValueChange={(v) => setForm({ ...form, produto_id: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
            <SelectContent>{(produtos ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.nome_oficial}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Contrato</Label>
          <Select value={form.contrato_id ?? "none"} onValueChange={(v) => setForm({ ...form, contrato_id: v === "none" ? null : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Nenhum —</SelectItem>
              {(contratos ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.fornecedor}{c.numero_contrato ? " · " + c.numero_contrato : ""}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Quantidade</Label><Input type="number" min={1} value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: Number(e.target.value) })} /></div>
          <div><Label>Expiração</Label><Input type="date" value={form.data_expiracao} onChange={(e) => setForm({ ...form, data_expiracao: e.target.value })} /></div>
        </div>
        <div><Label>Chave de ativação</Label><Input value={form.chave_ativacao} onChange={(e) => setForm({ ...form, chave_ativacao: e.target.value })} /></div>
      </CrudDialog>
    </>
  );
}
