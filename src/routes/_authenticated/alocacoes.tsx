import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
import { Trash2, Link2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useConfirm } from "@/components/confirm-dialog";
import { MaskedKey } from "@/components/masked-key";
import { criarAlocacao, encerrarAlocacao, encerrarAlocacoes } from "@/lib/licencas";

export const Route = createFileRoute("/_authenticated/alocacoes")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Alocações — GestoraIT" },
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
  chave_id: string | null;
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

type ChaveDisponivel = {
  id: string;
  software: string;
  chave_ativacao: string;
  tipo_licenca: string | null;
};

type ChaveAssoc = {
  id: string;
  software: string;
  chave_ativacao: string;
};

const initial = {
  licenca_id: "",
  usuario_id: null as string | null,
  ativo_id: null as string | null,
  data_inicio: new Date().toISOString().slice(0, 10),
  data_fim: "",
  chave_id: null as string | null,
  observacao: "",
};

function mascaraChave(chave: string): string {
  const limpa = (chave ?? "").trim();
  if (limpa.length <= 8) return limpa;
  return `${"•".repeat(6)}${limpa.slice(-4)}`;
}

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

  const { data: chavesDisponiveis = [] } = useQuery({
    queryKey: ["chaves-disponiveis-alocacao"],
    queryFn: async () => {
      const { data } = await supabase
        .from("licenses")
        .select("id, software, chave_ativacao, tipo_licenca")
        .eq("status", "disponivel")
        .order("software", { ascending: true });
      return (data ?? []) as unknown as ChaveDisponivel[];
    },
  });

  const { data: usuarios } = useQuery({
    queryKey: ["usuarios-lite"],
    queryFn: async () => (await supabase.from("usuarios").select("id,nome").eq("status", "ativo").order("nome")).data ?? [],
  });

  const { data: ativos } = useQuery({
    queryKey: ["ativos-lite"],
    queryFn: async () => (await supabase.from("ativos").select("id,hostname").neq("status_ciclo_vida", "baixado").order("hostname")).data ?? [],
  });

  const licencaSelecionada = useMemo<{ produtos_catalogo?: { nome_oficial: string } | null } | undefined>(
    () => (licencas ?? []).find((l: any) => l.id === form.licenca_id) as any,
    [licencas, form.licenca_id],
  );

  const produtoSelecionado = licencaSelecionada?.produtos_catalogo?.nome_oficial?.trim().toLowerCase() ?? "";

  const chavesCompativeis = useMemo(
    () =>
      produtoSelecionado
        ? chavesDisponiveis.filter((c) => c.software.trim().toLowerCase() === produtoSelecionado)
        : [],
    [chavesDisponiveis, produtoSelecionado],
  );

  const chaveIds = useMemo(() => {
    const set = new Set<string>();
    (rows ?? []).forEach((r) => {
      if (r.chave_id) set.add(r.chave_id);
    });
    return Array.from(set);
  }, [rows]);

  const { data: chavesAssociadas = [] } = useQuery({
    queryKey: ["licenses-assoc", chaveIds],
    queryFn: async () => {
      if (chaveIds.length === 0) return [];
      const { data } = await supabase
        .from("licenses")
        .select("id, software, chave_ativacao")
        .in("id", chaveIds);
      return (data ?? []) as unknown as ChaveAssoc[];
    },
    enabled: chaveIds.length > 0,
  });

  const chavesById = useMemo(
    () => new Map(chavesAssociadas.map((c) => [c.id, c])),
    [chavesAssociadas],
  );

  function openNew() {
    setForm({ ...initial });
    setOpen(true);
  }

  async function save() {
    if (!form.licenca_id) return toast.error("Selecione a licença");
    if (!form.usuario_id && !form.ativo_id) return toast.error("Vincule a um colaborador ou ativo");

    const r = await criarAlocacao({
      licenca_id: form.licenca_id,
      ativo_id: form.ativo_id ?? null,
      usuario_id: form.usuario_id,
      observacao: form.observacao,
      chave_id: form.chave_id,
    });

    if (!r.ok) {
      if (r.error === "ALREADY_ALLOCATED") {
        return toast.error("Este ativo já possui esta licença atribuída.");
      }
      return toast.error(r.error || "Erro ao criar alocação");
    }

    toast.success(form.chave_id ? "Alocação criada com a chave vinculada ao ativo" : "Alocação criada");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["alocacoes"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    if (form.chave_id) {
      qc.invalidateQueries({ queryKey: ["chaves-disponiveis-alocacao"] });
      qc.invalidateQueries({ queryKey: ["licenses"] });
      qc.invalidateQueries({ queryKey: ["licenses-assoc"] });
    }
  }

  async function encerrar(row: Row) {
    const ok = await confirm({
      title: "Encerrar alocação?",
      description: "A licença ficará livre para reuso a partir de hoje. Se houver chave vinculada, ela volta para as chaves disponíveis.",
      tone: "warn",
      impact: [
        { label: "Produto", value: row.licencas?.produtos_catalogo?.nome_oficial ?? "—" },
        { label: "Vínculo", value: row.usuarios?.nome ?? row.ativos?.hostname ?? "—" },
        { label: "Licenças liberadas", value: "+1", tone: "warn" },
      ],
      confirmLabel: "Encerrar",
    });
    if (!ok) return;

    const r = await encerrarAlocacao(row.id, "Encerrado via módulo de Alocações");
    if (!r.ok) return toast.error(r.error || "Erro ao encerrar");
    toast.success("Alocação encerrada");
    qc.invalidateQueries({ queryKey: ["alocacoes"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["licenses"] });
    qc.invalidateQueries({ queryKey: ["licenses-assoc"] });
    qc.invalidateQueries({ queryKey: ["chaves-disponiveis-alocacao"] });
  }

  async function bulkEncerrar(sel: Row[], clear: () => void) {
    const ativas = sel.filter((r) => !r.data_fim);
    if (ativas.length === 0) return toast.info("Nenhuma alocação ativa na seleção");
    const ok = await confirm({
      title: `Encerrar ${ativas.length} alocação(ões)?`,
      description: "As licenças correspondentes ficarão livres para reuso. Chaves vinculadas voltam automaticamente para disponíveis.",
      tone: "warn",
      impact: [
        { label: "Alocações a encerrar", value: ativas.length },
        { label: "Alocações já encerradas ignoradas", value: sel.length - ativas.length },
        { label: "Licenças liberadas", value: `+${ativas.length}`, tone: "warn" },
      ],
      confirmLabel: "Encerrar todas",
    });
    if (!ok) return;

    const ids = ativas.map((r) => r.id);
    const r = await encerrarAlocacoes(ids, "Encerrado em massa pelo módulo de Alocações");
    if (!r.ok) return toast.error(r.error || "Erro ao encerrar");

    toast.success(`${r.total} encerrada(s)`);
    clear();
    qc.invalidateQueries({ queryKey: ["alocacoes"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["licenses"] });
    qc.invalidateQueries({ queryKey: ["licenses-assoc"] });
    qc.invalidateQueries({ queryKey: ["chaves-disponiveis-alocacao"] });
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
        const regAssoc = r.chave_id ? chavesById.get(r.chave_id) : undefined;
        const chave = r.chave_id
          ? (regAssoc?.chave_ativacao ?? null)
          : r.chave_individual ?? r.licencas?.chave_ativacao ?? null;
        if (!chave) return <span className="text-muted-foreground text-xs">—</span>;
        const usaChaveModule = !!r.chave_id && !!regAssoc;
        const usaIndividual = !r.chave_id && !!r.chave_individual;
        const tabelaOrigem = usaChaveModule
          ? "licenses"
          : usaIndividual
            ? "alocacoes"
            : "licencas";
        const origem = usaChaveModule ? "licenses" : usaIndividual ? "chave_individual" : "chave_ativacao";
        return (
          <MaskedKey
            value={chave}
            context={{
              tabela: tabelaOrigem,
              registroId: usaChaveModule ? r.chave_id : usaIndividual ? r.id : (r.licencas?.id ?? r.licenca_id ?? r.id),
              metadata: {
                origem,
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
      searchValue: (r) => {
        const regAssoc = r.chave_id ? chavesById.get(r.chave_id) : undefined;
        return r.chave_id
          ? (regAssoc?.chave_ativacao ?? "")
          : (r.chave_individual ?? r.licencas?.chave_ativacao ?? "");
      },
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
      const regAssoc = r.chave_id ? chavesById.get(r.chave_id) : undefined;
      const chave = (r.chave_id
        ? (regAssoc?.chave_ativacao ?? "")
        : (r.chave_individual ?? r.licencas?.chave_ativacao ?? "")
      ).toLowerCase();
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
        description="Cada vínculo consome uma licença efetiva do produto até ser encerrado. Use Chaves de Licença para alocar a chave exata ao ativo."
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
            description="Vincule licenças a colaboradores ou ativos para consumir o saldo contratado. Com o módulo Chaves de Licença é possível escolher a chave exata do ativo."
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
            onChange={(v) => setForm({ ...form, licenca_id: v ?? "", chave_id: null })}
            options={(licencas ?? []).map((l: any) => ({
              value: l.id,
              label: l.produtos_catalogo?.nome_oficial ?? l.id.slice(0, 8),
              hint: l.id.slice(0, 8),
            }))}
          />
        </div>

        {form.licenca_id && (
          <div>
            <Label>Chave (módulo Chaves de Licença)</Label>
            <Combobox
              placeholder="Sem chave individual"
              searchPlaceholder="Buscar chave…"
              clearable
              value={form.chave_id}
              onChange={(v) => setForm({ ...form, chave_id: v ?? null })}
              options={chavesCompativeis.map((c) => ({
                value: c.id,
                label: mascaraChave(c.chave_ativacao),
                hint: `${c.software} · ${c.tipo_licenca ?? "—"}`,
              }))}
            />
            {chavesCompativeis.length > 0 ? (
              <p className="text-[11px] text-muted-foreground mt-1">
                Ao salvar, esta chave será marcada como alocada para o ativo/colaborador no módulo Chaves de Licença.
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground mt-1">
                Nenhuma chave disponível no Chaves de Licença com o software “{licencaSelecionada?.produtos_catalogo?.nome_oficial ?? form.licenca_id.slice(0, 8)}”. Você ainda pode salvar o vínculo de licença, ou cadastrar uma chave disponível lá primeiro.
              </p>
            )}
          </div>
        )}

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
        <div><Label>Observação</Label><Textarea value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} /></div>
      </CrudDialog>
      <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <KeyRound className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          Para alocar uma licença a um ativo usando uma chave específica, selecione o produto acima e escolha a chave disponível do módulo Chaves de Licença. A alocação criada também registra a chave como alocada para o ativo.
        </span>
      </div>
    </>
  );
}
