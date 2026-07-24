import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { DataTable, ListToolbar, useFilteredList } from "@/components/data-table";
import { CrudDialog } from "@/components/crud-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/alocacoes")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Alocações — ITAM/SAM" },
      { name: "description", content: "Vínculo de licenças a colaboradores e ativos." },
    ],
  }),
});

type Row = {
  id: string;
  licenca_id: string | null;
  usuario_id: string | null;
  ativo_id: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  observacao: string | null;
  licencas?: { produtos_catalogo?: { nome_oficial: string } | null } | null;
  usuarios?: { nome: string } | null;
  ativos?: { hostname: string } | null;
};

const initial = {
  licenca_id: "",
  usuario_id: null as string | null,
  ativo_id: null as string | null,
  data_inicio: new Date().toISOString().slice(0, 10),
  data_fim: "",
  observacao: "",
};

function Page() {
  const { canWrite } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["alocacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alocacoes")
        .select("*, licencas(produtos_catalogo(nome_oficial)), usuarios(nome), ativos(hostname)")
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data as unknown as Row[];
    },
  });
  const { data: licencas } = useQuery({
    queryKey: ["licencas-lite"],
    queryFn: async () => (await supabase.from("licencas").select("id, produtos_catalogo(nome_oficial)")).data ?? [],
  });
  const { data: usuarios } = useQuery({
    queryKey: ["usuarios-lite"],
    queryFn: async () => (await supabase.from("usuarios").select("id,nome").eq("status", "ativo").order("nome")).data ?? [],
  });
  const { data: ativos } = useQuery({
    queryKey: ["ativos-lite"],
    queryFn: async () => (await supabase.from("ativos").select("id,hostname").neq("status_ciclo_vida", "baixado").order("hostname")).data ?? [],
  });

  const filtered = useFilteredList(rows, q, ["observacao"]);

  function openNew() { setForm(initial); setOpen(true); }
  async function save() {
    if (!form.licenca_id) return toast.error("Selecione a licença");
    if (!form.usuario_id && !form.ativo_id) return toast.error("Vincule a um colaborador ou ativo");
    const { error } = await supabase.from("alocacoes").insert({
      licenca_id: form.licenca_id,
      usuario_id: form.usuario_id,
      ativo_id: form.ativo_id,
      data_inicio: form.data_inicio,
      data_fim: form.data_fim || null,
      observacao: form.observacao || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Alocação criada");
    qc.invalidateQueries({ queryKey: ["alocacoes"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }
  async function encerrar(id: string) {
    if (!confirm("Encerrar esta alocação (liberar a licença)?")) return;
    const { error } = await supabase.from("alocacoes").update({ data_fim: new Date().toISOString().slice(0, 10) }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Alocação encerrada");
    qc.invalidateQueries({ queryKey: ["alocacoes"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  return (
    <>
      <PageHeader
        title="Alocações"
        description="Cada vínculo consome um seat efetivo do produto até ser encerrado."
        actions={canWrite ? <Button size="sm" onClick={openNew}>Nova alocação</Button> : undefined}
      />
      <ListToolbar query={q} onQueryChange={setQ} />
      <DataTable
        columns={["Produto", "Colaborador", "Ativo", "Início", "Fim", "Status", "Ações"]}
        empty={isLoading ? "Carregando…" : "Nenhuma alocação."}
        rows={filtered.map((r) => {
          const ativo = !r.data_fim;
          return [
            r.licencas?.produtos_catalogo?.nome_oficial ?? "—",
            r.usuarios?.nome ?? "—",
            r.ativos?.hostname ?? "—",
            r.data_inicio ?? "—",
            r.data_fim ?? "—",
            <Badge key="s" variant={ativo ? "default" : "secondary"}>{ativo ? "ativa" : "encerrada"}</Badge>,
            <div key="a" className="flex gap-1">
              {canWrite && ativo && (
                <Button size="icon" variant="ghost" onClick={() => encerrar(r.id)} title="Encerrar">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>,
          ];
        })}
      />
      <CrudDialog title="Nova alocação" open={open} onOpenChange={setOpen} onSubmit={save} trigger={null}>
        <div>
          <Label>Licença *</Label>
          <Select value={form.licenca_id} onValueChange={(v) => setForm({ ...form, licenca_id: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
            <SelectContent>
              {(licencas ?? []).map((l: any) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.produtos_catalogo?.nome_oficial ?? l.id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Colaborador</Label>
            <Select value={form.usuario_id ?? "none"} onValueChange={(v) => setForm({ ...form, usuario_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Nenhum —</SelectItem>
                {(usuarios ?? []).map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ativo</Label>
            <Select value={form.ativo_id ?? "none"} onValueChange={(v) => setForm({ ...form, ativo_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Nenhum —</SelectItem>
                {(ativos ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.hostname}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Início</Label><Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} /></div>
          <div><Label>Fim (opcional)</Label><Input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} /></div>
        </div>
        <div><Label>Observação</Label><Textarea value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} /></div>
      </CrudDialog>
    </>
  );
}
