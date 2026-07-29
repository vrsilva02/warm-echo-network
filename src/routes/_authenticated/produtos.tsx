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
import { Pencil, Trash2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useConfirm } from "@/components/confirm-dialog";
import { Combobox } from "@/components/combobox";

export const Route = createFileRoute("/_authenticated/produtos")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Catálogo — GestoraIT" },
      { name: "description", content: "Catálogo de produtos e fabricantes com aliases de reconciliação." },
    ],
  }),
});

type Produto = {
  id: string;
  nome_oficial: string;
  categoria: string;
  fabricante_id: string | null;
  modelo_licenciamento: string;
  tipo_licenciamento: string;
  fabricantes?: { nome: string } | null;
};

const CATEGORIAS = ["Windows", "Office", "EDR", "Outro"];
const MODELOS = ["dispositivo", "usuario", "core", "concorrente"];
const TIPOS = ["OEM", "Volume", "Retail", "Assinatura", "Perpetua"];

const initial = { nome_oficial: "", categoria: "Office", fabricante_id: null as string | null, modelo_licenciamento: "usuario", tipo_licenciamento: "Assinatura" };

function Page() {
  const { canWrite } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Produto | null>(null);
  const [form, setForm] = useState(initial);
  const [fabOpen, setFabOpen] = useState(false);
  const [novoFab, setNovoFab] = useState("");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["produtos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos_catalogo").select("*, fabricantes(nome)").order("nome_oficial");
      if (error) throw error;
      return data as unknown as Produto[];
    },
  });
  const { data: fabricantes } = useQuery({
    queryKey: ["fabricantes"],
    queryFn: async () => (await supabase.from("fabricantes").select("*").order("nome")).data ?? [],
  });

  const filtered = useFilteredList(rows, q, ["nome_oficial", "categoria", "modelo_licenciamento"]);

  function openNew() { setEditing(null); setForm(initial); setOpen(true); }
  function openEdit(r: Produto) {
    setEditing(r);
    setForm({
      nome_oficial: r.nome_oficial,
      categoria: r.categoria,
      fabricante_id: r.fabricante_id,
      modelo_licenciamento: r.modelo_licenciamento,
      tipo_licenciamento: r.tipo_licenciamento,
    });
    setOpen(true);
  }
  async function save() {
    const payload = { ...form, nome_oficial: form.nome_oficial.trim() };
    const { error } = editing
      ? await supabase.from("produtos_catalogo").update(payload).eq("id", editing.id)
      : await supabase.from("produtos_catalogo").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    qc.invalidateQueries({ queryKey: ["produtos"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }
  async function remove(row: Produto) {
    const [{ count: licCount }, { count: aliasCount }] = await Promise.all([
      supabase.from("licencas").select("id", { count: "exact", head: true }).eq("produto_id", row.id),
      supabase.from("produtos_aliases").select("id", { count: "exact", head: true }).eq("produto_id", row.id),
    ]);
    const ok = await confirm({
      title: "Excluir produto do catálogo?",
      description: "Licenças e aliases vinculados serão afetados. Ação irreversível.",
      tone: "danger",
      impact: [
        { label: "Produto", value: row.nome_oficial },
        { label: "Blocos de licenças", value: licCount ?? 0, tone: (licCount ?? 0) > 0 ? "danger" : "default" },
        { label: "Aliases de reconciliação", value: aliasCount ?? 0 },
      ],
      confirmLabel: "Excluir",
    });
    if (!ok) return;
    const { error } = await supabase.from("produtos_catalogo").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["produtos"] });
  }
  async function addFab() {
    if (!novoFab.trim()) return;
    const { error } = await supabase.from("fabricantes").insert({ nome: novoFab.trim() });
    if (error) return toast.error(error.message);
    toast.success("Fabricante criado");
    setNovoFab("");
    setFabOpen(false);
    qc.invalidateQueries({ queryKey: ["fabricantes"] });
  }

  return (
    <>
      <PageHeader
        title="Catálogo de Produtos"
        description="Normalize nomes oficiais de software para reconciliação e cálculo de ELP."
        actions={canWrite ? (
          <>
            <Dialog open={fabOpen} onOpenChange={setFabOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Building2 className="h-4 w-4" /> Fabricantes</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Fabricantes</DialogTitle></DialogHeader>
                <div className="space-y-2 max-h-60 overflow-auto">
                  {(fabricantes ?? []).map((f) => (
                    <div key={f.id} className="text-sm border rounded px-3 py-2">{f.nome}</div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Novo fabricante" value={novoFab} onChange={(e) => setNovoFab(e.target.value)} />
                  <Button onClick={addFab}>Adicionar</Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button size="sm" onClick={openNew}>Novo produto</Button>
          </>
        ) : undefined}
      />
      <ListToolbar query={q} onQueryChange={setQ} />
      <DataTable
        columns={["Produto", "Fabricante", "Categoria", "Modelo", "Tipo", "Ações"]}
        empty={isLoading ? "Carregando…" : "Nenhum produto."}
        rows={filtered.map((r) => [
          <span key="n" className="font-medium">{r.nome_oficial}</span>,
          r.fabricantes?.nome ?? "—",
          <Badge key="c" variant="outline">{r.categoria}</Badge>,
          r.modelo_licenciamento,
          r.tipo_licenciamento,
          <div key="a" className="flex gap-1">
            {canWrite && <>
              <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button>
            </>}
          </div>,
        ])}
      />
      <CrudDialog title={editing ? "Editar produto" : "Novo produto"} open={open} onOpenChange={setOpen} onSubmit={save} trigger={null}>
        <div><Label>Nome oficial</Label><Input required value={form.nome_oficial} onChange={(e) => setForm({ ...form, nome_oficial: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Categoria</Label>
            <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fabricante</Label>
            <Combobox
              placeholder="Nenhum"
              searchPlaceholder="Buscar fabricante…"
              value={form.fabricante_id}
              onChange={(v) => setForm({ ...form, fabricante_id: v })}
              options={(fabricantes ?? []).map((f) => ({ value: f.id, label: f.nome }))}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Modelo</Label>
            <Select value={form.modelo_licenciamento} onValueChange={(v) => setForm({ ...form, modelo_licenciamento: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MODELOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={form.tipo_licenciamento} onValueChange={(v) => setForm({ ...form, tipo_licenciamento: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </CrudDialog>
    </>
  );
}
