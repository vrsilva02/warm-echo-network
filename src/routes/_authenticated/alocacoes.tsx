import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { AdvancedTable, type Column, type SavedView } from "@/components/advanced-table";
import { CrudDialog } from "@/components/crud-dialog";
import { EmptyState } from "@/components/empty-state";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/combobox";
import { Trash2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { useConfirm } from "@/components/confirm-dialog";
import { MaskedKey } from "@/components/masked-key";
import { isChaveIndividualRequired } from "@/routes/_authenticated/licencas";

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
  chave_individual: string | null;
  licencas?: {
    id: string;
    chave_ativacao: string | null;
    produtos_catalogo?: {
      id: string;
      nome_oficial: string;
      modelo_licenciamento: string | null;
      tipo_licenciamento: string | null;
    } | null;
  } | null;
  usuarios?: { nome: string } | null;
  ativos?: { hostname: string } | null;
};

const initial = {
  licenca_id: "",
  usuario_id: null as string | null,
  ativo_id: null as string | null,
  data_inicio: new Date().toISOString().slice(0, 10),
  data_fim: "",
  chave_individual: "",
  observacao: "",
};

function Page() {
  const { canWrite } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial);
  const [fProduto, setFProduto] = useState<string | null>(null);
  const [fAtivo, setFAtivo] = useState<string | null>(null);
  const [fChave, setFChave] = useState("");
  const [fStatus, setFStatus] = useState<"todas" | "ativa" | "encerrada">("todas");
  const [fDataInicio, setFDataInicio] = useState("");
  const [fDataFim, setFDataFim] = useState("");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["alocacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alocacoes")
        .select(
          "*, licencas(id, chave_ativacao, produtos_catalogo(id, nome_oficial, modelo_licenciamento, tipo_licenciamento)), usuarios(nome), ativos(hostname)",
        )
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data as unknown as Row[];
    },
  });
  const { data: licencas } = useQuery({
    queryKey: ["licencas-lite"],
    queryFn: async () =>
      (await supabase
        .from("licencas")
        .select("id, produtos_catalogo(id, nome_oficial, modelo_licenciamento, tipo_licenciamento)")
      ).data ?? [],
  });
  const { data: usuarios } = useQuery({
    queryKey: ["usuarios-lite"],
    queryFn: async () => (await supabase.from("usuarios").select("id,nome").eq("status", "ativo").order("nome")).data ?? [],
  });
  const { data: ativos } = useQuery({
    queryKey: ["ativos-lite"],
    queryFn: async () => (await supabase.from("ativos").select("id,hostname").neq("status_ciclo_vida", "baixado").order("hostname")).data ?? [],
  });

  const licencaSel = (licencas ?? []).find((l: any) => l.id === form.licenca_id) as any | undefined;
  const chaveObrigatoria = isChaveIndividualRequired(licencaSel?.produtos_catalogo ?? null);

  function openNew() { setForm(initial); setOpen(true); }
  async function save() {
    if (!form.licenca_id) return toast.error("Selecione a licença");
    if (!form.usuario_id && !form.ativo_id) return toast.error("Vincule a um colaborador ou ativo");
    if (chaveObrigatoria && !form.chave_individual.trim()) {
      return toast.error("Produto OEM/Retail: informe a chave individual desta alocação.");
    }
    const { error } = await supabase.from("alocacoes").insert({
      licenca_id: form.licenca_id,
      usuario_id: form.usuario_id,
      ativo_id: form.ativo_id,
      data_inicio: form.data_inicio,
      data_fim: form.data_fim || null,
      chave_individual: form.chave_individual.trim() || null,
      observacao: form.observacao || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Alocação criada");
    qc.invalidateQueries({ queryKey: ["alocacoes"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }
  async function encerrar(row: Row) {
    const ok = await confirm({
      title: "Encerrar alocação?",
      description: "A licença ficará livre para reuso a partir de hoje.",
      tone: "warn",
      impact: [
        { label: "Produto", value: row.licencas?.produtos_catalogo?.nome_oficial ?? "—" },
        { label: "Vínculo", value: row.usuarios?.nome ?? row.ativos?.hostname ?? "—" },
        { label: "Licenças liberadas", value: "+1", tone: "warn" },
      ],
      confirmLabel: "Encerrar",
    });
    if (!ok) return;
    const { error } = await supabase.from("alocacoes").update({ data_fim: new Date().toISOString().slice(0, 10) }).eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Alocação encerrada");
    qc.invalidateQueries({ queryKey: ["alocacoes"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }
  async function bulkEncerrar(sel: Row[], clear: () => void) {
    const ativas = sel.filter((r) => !r.data_fim);
    if (ativas.length === 0) return toast.info("Nenhuma alocação ativa na seleção");
    const ok = await confirm({
      title: `Encerrar ${ativas.length} alocação(ões)?`,
      description: "As licenças correspondentes ficarão livres para reuso.",
      tone: "warn",
      impact: [
        { label: "Alocações a encerrar", value: ativas.length },
        { label: "Alocações já encerradas ignoradas", value: sel.length - ativas.length },
        { label: "Seats liberados", value: `+${ativas.length}`, tone: "warn" },
      ],
      confirmLabel: "Encerrar todas",
    });
    if (!ok) return;
    const today = new Date().toISOString().slice(0, 10);
    const ids = ativas.map((r) => r.id);
    const { error } = await supabase.from("alocacoes").update({ data_fim: today }).in("id", ids);
    if (error) return toast.error(error.message);
    void logAction("BULK_UPDATE", "alocacoes", { operacao: "encerrar", ids, total: ids.length, data_fim: today });
    toast.success(`${ativas.length} encerrada(s)`);
    clear();
    qc.invalidateQueries({ queryKey: ["alocacoes"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const columns: Column<Row>[] = [
    {
      id: "produto", header: "Produto",
      accessor: (r) => <span className="font-medium">{r.licencas?.produtos_catalogo?.nome_oficial ?? "—"}</span>,
      sortValue: (r) => r.licencas?.produtos_catalogo?.nome_oficial ?? "",
      searchValue: (r) => r.licencas?.produtos_catalogo?.nome_oficial,
      exportValue: (r) => r.licencas?.produtos_catalogo?.nome_oficial,
    },
    {
      id: "colab", header: "Colaborador",
      accessor: (r) => r.usuarios?.nome ?? "—",
      sortValue: (r) => r.usuarios?.nome ?? "",
      searchValue: (r) => r.usuarios?.nome, exportValue: (r) => r.usuarios?.nome,
    },
    {
      id: "ativo", header: "Ativo",
      accessor: (r) => r.ativos?.hostname ?? "—",
      sortValue: (r) => r.ativos?.hostname ?? "",
      searchValue: (r) => r.ativos?.hostname, exportValue: (r) => r.ativos?.hostname,
    },
    {
      id: "chave", header: "Chave",
      accessor: (r) => {
        const usaIndividual = isChaveIndividualRequired(r.licencas?.produtos_catalogo ?? null);
        const chave = usaIndividual ? r.chave_individual : r.licencas?.chave_ativacao ?? null;
        if (!chave) return <span className="text-muted-foreground text-xs">—</span>;
        return (
          <MaskedKey
            value={chave}
            context={{
              tabela: usaIndividual ? "alocacoes" : "licencas",
              registroId: usaIndividual ? r.id : (r.licencas?.id ?? r.licenca_id ?? r.id),
              metadata: {
                origem: usaIndividual ? "chave_individual" : "chave_ativacao",
                alocacao_id: r.id,
                licenca_id: r.licenca_id,
                produto_id: r.licencas?.produtos_catalogo?.id ?? null,
                produto: r.licencas?.produtos_catalogo?.nome_oficial ?? null,
                ativo_id: r.ativo_id,
                ativo_hostname: r.ativos?.hostname ?? null,
                usuario_id: r.usuario_id,
              },
            }}
          />
        );
      },
      searchValue: () => undefined,
      exportValue: () => "(protegida)",
    },
    {
      id: "inicio", header: "Início",
      accessor: (r) => r.data_inicio ?? "—",
      sortValue: (r) => r.data_inicio ?? "", exportValue: (r) => r.data_inicio,
    },
    {
      id: "fim", header: "Fim",
      accessor: (r) => r.data_fim ?? "—",
      sortValue: (r) => r.data_fim ?? "", exportValue: (r) => r.data_fim,
    },
    {
      id: "status", header: "Status",
      accessor: (r) => <Badge variant={!r.data_fim ? "default" : "secondary"}>{!r.data_fim ? "ativa" : "encerrada"}</Badge>,
      sortValue: (r) => (!r.data_fim ? 0 : 1),
      searchValue: (r) => (!r.data_fim ? "ativa" : "encerrada"),
      exportValue: (r) => (!r.data_fim ? "ativa" : "encerrada"),
    },
    {
      id: "obs", header: "Observação", defaultHidden: true,
      accessor: (r) => r.observacao ?? "—",
      searchValue: (r) => r.observacao, exportValue: (r) => r.observacao,
    },
    {
      id: "acoes", header: "Ações", alwaysVisible: true,
      accessor: (r) => (
        <div className="flex gap-1">
          {canWrite && !r.data_fim && (
            <Button size="icon" variant="ghost" onClick={() => encerrar(r)} title="Encerrar">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const views: SavedView<Row>[] = [
    { id: "ativas", label: "Ativas", filter: (rs) => rs.filter((r) => !r.data_fim) },
    { id: "encerradas", label: "Encerradas", filter: (rs) => rs.filter((r) => !!r.data_fim) },
    { id: "sem_ativo", label: "Só colaborador", filter: (rs) => rs.filter((r) => !r.ativo_id && r.usuario_id) },
  ];

  const produtosOpts = Array.from(
    new Map(
      (rows ?? [])
        .filter((r) => r.licencas?.produtos_catalogo)
        .map((r) => [r.licencas!.produtos_catalogo!.id, r.licencas!.produtos_catalogo!.nome_oficial]),
    ).entries(),
  ).sort((a, b) => a[1].localeCompare(b[1]));

  const filteredRows = (rows ?? []).filter((r) => {
    if (fProduto && r.licencas?.produtos_catalogo?.id !== fProduto) return false;
    if (fAtivo && r.ativo_id !== fAtivo) return false;
    if (fStatus === "ativa" && r.data_fim) return false;
    if (fStatus === "encerrada" && !r.data_fim) return false;
    if (fChave.trim()) {
      const q = fChave.trim().toLowerCase();
      const chave = (r.chave_individual ?? r.licencas?.chave_ativacao ?? "").toLowerCase();
      if (!chave.includes(q)) return false;
    }
    if (fDataInicio || fDataFim) {
      const alocInicio = r.data_inicio ?? "";
      const alocFim = r.data_fim ?? new Date().toISOString().slice(0, 10);
      if (fDataInicio && alocFim < fDataInicio) return false;
      if (fDataFim && alocInicio > fDataFim) return false;
    }
    return true;
  });

  const hasFilter = !!fProduto || !!fAtivo || !!fChave.trim() || fStatus !== "todas" || !!fDataInicio || !!fDataFim;

  return (
    <>
      <PageHeader
        title="Alocações"
        description="Cada vínculo consome um seat efetivo do produto até ser encerrado."
        actions={canWrite ? <Button size="sm" onClick={openNew}>Nova alocação</Button> : undefined}
      />
      <div className="grid gap-3 md:grid-cols-6 mb-4">
        <div>
          <Label className="text-xs">Produto</Label>
          <Combobox
            placeholder="Todos"
            searchPlaceholder="Buscar produto…"
            value={fProduto}
            onChange={setFProduto}
            options={produtosOpts.map(([id, nome]) => ({ value: id, label: nome }))}
          />
        </div>
        <div>
          <Label className="text-xs">Ativo</Label>
          <Combobox
            placeholder="Todos"
            searchPlaceholder="Buscar hostname…"
            value={fAtivo}
            onChange={setFAtivo}
            options={(ativos ?? []).map((a) => ({ value: a.id, label: a.hostname }))}
          />
        </div>
        <div>
          <Label className="text-xs">Chave</Label>
          <Input
            value={fChave}
            onChange={(e) => setFChave(e.target.value)}
            placeholder="Trecho da chave…"
          />
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={fStatus} onValueChange={(v) => setFStatus(v as typeof fStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="ativa">Ativas</SelectItem>
              <SelectItem value="encerrada">Encerradas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Início a partir de</Label>
          <Input type="date" value={fDataInicio} onChange={(e) => setFDataInicio(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Fim até</Label>
          <Input type="date" value={fDataFim} onChange={(e) => setFDataFim(e.target.value)} />
        </div>
        {hasFilter && (
          <div className="md:col-span-6">
            <Button size="sm" variant="ghost" onClick={() => { setFProduto(null); setFAtivo(null); setFChave(""); setFStatus("todas"); setFDataInicio(""); setFDataFim(""); }}>
              Limpar filtros
            </Button>
          </div>
        )}
      </div>
      <AdvancedTable<Row>
        storageKey="alocacoes"
        rows={filteredRows}
        isLoading={isLoading}
        columns={columns}
        getRowId={(r) => r.id}
        savedViews={views}
        exportFilename="alocacoes"
        emptyState={
          <EmptyState
            icon={<Link2 className="h-6 w-6" />}
            title="Nenhuma alocação"
            description="Vincule licenças a colaboradores ou ativos para consumir seats."
            action={canWrite ? <Button size="sm" onClick={openNew}>Nova alocação</Button> : undefined}
          />
        }
        bulkActions={canWrite ? (sel, clear) => (
          <Button size="sm" variant="outline" onClick={() => bulkEncerrar(sel, clear)}>Encerrar selecionadas</Button>
        ) : undefined}
      />
      <CrudDialog title="Nova alocação" open={open} onOpenChange={setOpen} onSubmit={save} trigger={null}>
        <div>
          <Label>Licença *</Label>
          <Combobox
            placeholder="Selecione uma licença…"
            searchPlaceholder="Buscar produto…"
            clearable={false}
            value={form.licenca_id || null}
            onChange={(v) => setForm({ ...form, licenca_id: v ?? "" })}
            options={(licencas ?? []).map((l: any) => ({
              value: l.id,
              label: l.produtos_catalogo?.nome_oficial ?? l.id.slice(0, 8),
              hint: l.id.slice(0, 8),
            }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Colaborador</Label>
            <Combobox
              placeholder="Nenhum"
              searchPlaceholder="Buscar colaborador…"
              value={form.usuario_id}
              onChange={(v) => setForm({ ...form, usuario_id: v })}
              options={(usuarios ?? []).map((u) => ({ value: u.id, label: u.nome }))}
            />
          </div>
          <div>
            <Label>Ativo</Label>
            <Combobox
              placeholder="Nenhum"
              searchPlaceholder="Buscar hostname…"
              value={form.ativo_id}
              onChange={(v) => setForm({ ...form, ativo_id: v })}
              options={(ativos ?? []).map((a) => ({ value: a.id, label: a.hostname }))}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Início</Label><Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} /></div>
          <div><Label>Fim (opcional)</Label><Input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} /></div>
        </div>
        <div>
          <Label>
            Chave individual {chaveObrigatoria && <span className="text-destructive">*</span>}
            {!chaveObrigatoria && <span className="text-muted-foreground text-xs"> (opcional)</span>}
          </Label>
          <Input
            value={form.chave_individual}
            onChange={(e) => setForm({ ...form, chave_individual: e.target.value })}
            placeholder={chaveObrigatoria ? "Obrigatório para produtos OEM/Retail" : "Somente se este ativo tem chave própria"}
            autoComplete="off"
          />
          {chaveObrigatoria && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Produto OEM/Retail: cada ativo recebe uma chave própria. Ela ficará mascarada e cada revelação é registrada no log de auditoria.
            </p>
          )}
        </div>
        <div><Label>Observação</Label><Textarea value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} /></div>
      </CrudDialog>
    </>
  );
}
