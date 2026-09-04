import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Copy,
  Check,
  KeyRound,
  Plus,
  Trash2,
  AlertTriangle,
  Download,
  ClipboardCopy,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { logAction } from "@/lib/audit";
import { downloadCSV, downloadPDF, toCSV } from "@/lib/export";
import { Combobox } from "@/components/combobox";
import { fetchAll } from "@/lib/fetch-all";
import {
  fetchChaves,
  inserirChavesEmLote,
  desvincularChave,
  STATUS_CHAVE_LABEL,
  TIPOS_LICENCA,
  type LinhaLote,
  type RelatorioLote,
  type StatusChave,
  type TipoLicenca,
} from "@/lib/chaves-licenca";

export const Route = createFileRoute("/_authenticated/chaves-licenca")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Chaves de Licença — GestoraIT" },
      {
        name: "description",
        content:
          "Inventário de chaves de ativação de software com vínculo a ativos e colaboradores.",
      },
      { property: "og:title", content: "Chaves de Licença — GestoraIT" },
      {
        property: "og:description",
        content: "Gestão de chaves de ativação, inserção e exclusão em massa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type StatusLicenca = StatusChave;

type LicenseRow = {
  id: string;
  software: string;
  chave_ativacao: string;
  tipo_licenca: TipoLicenca;
  status: StatusLicenca;
  ativo_id: string | null;
  usuario_id: string | null;
  data_alocacao: string | null;
  data_expiracao: string | null;
  licenca_id: string | null;
  ativos?: { hostname: string } | null;
  usuarios?: { nome: string } | null;
};

const TIPOS = TIPOS_LICENCA;
const STATUS_LABEL = STATUS_CHAVE_LABEL;

/** Exibe apenas os 5 últimos caracteres da chave. */
function maskTail(key: string): string {
  const clean = (key ?? "").trim();
  if (clean.length <= 5) return clean;
  return `${"•".repeat(Math.min(12, clean.length - 5))}${clean.slice(-5)}`;
}

function CopyKeyButton({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className="h-6 w-6"
      title="Copiar chave"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
          toast.success("Chave copiada");
        } catch {
          toast.error("Não foi possível copiar");
        }
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

function Page() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();

  const [software, setSoftware] = React.useState("todos");
  const [status, setStatus] = React.useState("todos");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [wipeOpen, setWipeOpen] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["licenses"],
    queryFn: async () => (await fetchChaves()) as unknown as LicenseRow[],
  });

  const { data: licencasRef = [] } = useQuery({
    queryKey: ["licencas-lite"],
    queryFn: async () =>
      (await fetchAll<any>("licencas", "id, quantidade, produtos_catalogo(id, nome_oficial)")).data,
  });

  const { data: saldos = [] } = useQuery({
    queryKey: ["chaves-saldo"],
    queryFn: async () => (await fetchAll<any>("vw_licencas_chaves_saldo", "*")).data,
  });

  const rows = data ?? [];
  const softwares = React.useMemo(
    () => Array.from(new Set(rows.map((r) => r.software))).sort(),
    [rows],
  );
  const filtered = React.useMemo(
    () =>
      rows.filter(
        (r) =>
          (software === "todos" || r.software === software) &&
          (status === "todos" || r.status === status),
      ),
    [rows, software, status],
  );

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function licencaLabel(licencaId: string | null): string {
    if (!licencaId) return "—";
    const l = licencasRef.find((x: any) => x.id === licencaId);
    return l?.produtos_catalogo?.nome_oficial ?? licencaId.slice(0, 8);
  }

  async function desvincular(r: LicenseRow) {
    const res = await desvincularChave(r.id);
    if (!res.ok) return toast.error(res.error ?? "Não foi possível desvincular.");
    toast.success("Chave desvinculada e disponível novamente.");
    await qc.invalidateQueries({ queryKey: ["licenses"] });
    void qc.invalidateQueries({ queryKey: ["chaves-saldo"] });
    void qc.invalidateQueries({ queryKey: ["alocacoes"] });
    void qc.invalidateQueries({ queryKey: ["chaves-disponiveis-alocacao"] });
  }

  async function excluirSelecionadas() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const { error } = await supabase.from("licenses").delete().in("id", ids);
    if (error) return toast.error(friendlyError(error));
    void logAction("BULK_DELETE", "licenses", { total: ids.length, ids });
    setSelected(new Set());
    await qc.invalidateQueries({ queryKey: ["licenses"] });
    toast.success(`${ids.length} licença(s) excluída(s).`);
  }

  const EXPORT_COLS = [
    "Software",
    "Chave",
    "Tipo",
    "Status",
    "Ativo",
    "Colaborador",
    "Alocação",
    "Expiração",
  ];

  function exportRows(): (string | number | null)[][] {
    return filtered.map((r) => [
      r.software,
      maskTail(r.chave_ativacao),
      r.tipo_licenca,
      STATUS_LABEL[r.status],
      r.ativos?.hostname ?? "—",
      r.usuarios?.nome ?? "—",
      r.data_alocacao ?? "—",
      r.data_expiracao ?? "—",
    ]);
  }

  const filtroResumo = [
    software === "todos" ? "Todos os softwares" : software,
    status === "todos" ? "Todos os status" : STATUS_LABEL[status as StatusLicenca],
  ].join(" · ");

  function exportarCSV() {
    if (filtered.length === 0) return toast.error("Nenhuma licença para exportar.");
    downloadCSV(`chaves-licenca-${new Date().toISOString().slice(0, 10)}`, EXPORT_COLS, exportRows());
    void logAction("EXPORT", "licenses", { formato: "csv", total: filtered.length, filtroResumo });
    toast.success(`${filtered.length} licença(s) exportada(s) em CSV.`);
  }

  async function exportarPDF() {
    if (filtered.length === 0) return toast.error("Nenhuma licença para exportar.");
    await downloadPDF({
      filename: `chaves-licenca-${new Date().toISOString().slice(0, 10)}.pdf`,
      title: "Chaves de Licença",
      subtitle: `${filtered.length} registro(s) · ${filtroResumo}`,
      columns: EXPORT_COLS,
      rows: exportRows(),
    });
    void logAction("EXPORT", "licenses", { formato: "pdf", total: filtered.length, filtroResumo });
    toast.success(`${filtered.length} licença(s) exportada(s) em PDF.`);
  }

  async function copiarLista() {
    if (filtered.length === 0) return toast.error("Nenhuma licença para copiar.");
    try {
      await navigator.clipboard.writeText(toCSV(EXPORT_COLS, exportRows()));
      toast.success(`${filtered.length} linha(s) copiada(s) para a área de transferência.`);
    } catch {
      toast.error("Não foi possível copiar a lista.");
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Chaves de Licença"
        description="Inventário de chaves de ativação vinculadas a ativos e colaboradores."
        actions={
          <div className="flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Download className="h-4 w-4" /> Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  {filtered.length} registro(s) · chave mascarada
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => exportarCSV()}>
                  <Download className="h-4 w-4" /> Exportar CSV
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void exportarPDF()}>
                  <Download className="h-4 w-4" /> Exportar PDF
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void copiarLista()}>
                  <ClipboardCopy className="h-4 w-4" /> Copiar lista
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {isAdmin ? (
              <>
                <Button size="sm" onClick={() => setBulkOpen(true)}>
                  <Plus className="h-4 w-4" /> Inserção em massa
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={selected.size === 0}
                  onClick={() => void excluirSelecionadas()}
                >
                  <Trash2 className="h-4 w-4" /> Excluir selecionadas ({selected.size})
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setWipeOpen(true)}>
                  <AlertTriangle className="h-4 w-4" /> Excluir todas as licenças
                </Button>
              </>
            ) : null}
          </div>
        }
      />


      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Chaves cadastradas", value: rows.length },
          { label: "Disponíveis", value: rows.filter((r) => r.status === "disponivel").length },
          { label: "Alocadas", value: rows.filter((r) => r.status === "alocada").length },
          {
            label: "Licenças adquiridas",
            value: saldos.reduce((a: number, s: any) => a + (s.quantidade ?? 0), 0),
          },
          {
            label: "Pendentes de cadastro",
            value: saldos.reduce((a: number, s: any) => a + (s.chaves_pendentes ?? 0), 0),
          },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className="text-2xl font-semibold tabular-nums">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Licenças ({filtered.length})
          </CardTitle>
          <div className="flex flex-wrap gap-2 pt-2">
            <Select value={software} onValueChange={setSoftware}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Software" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os softwares</SelectItem>
                {softwares.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="disponivel">Disponível</SelectItem>
                <SelectItem value="alocada">Alocada</SelectItem>
                <SelectItem value="expirada">Expirada</SelectItem>
                <SelectItem value="revogada">Revogada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<KeyRound className="h-6 w-6" />}
              title="Nenhuma licença encontrada"
              description="Ajuste os filtros ou faça uma inserção em massa de chaves."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(v) =>
                          setSelected(v ? new Set(filtered.map((r) => r.id)) : new Set())
                        }
                        aria-label="Selecionar todas"
                      />
                    </TableHead>
                    <TableHead>Software</TableHead>
                    <TableHead>Licença (produto)</TableHead>
                    <TableHead>Chave</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Alocação</TableHead>
                    <TableHead>Expiração</TableHead>
                    <TableHead className="w-28">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(r.id)}
                          onCheckedChange={() => toggle(r.id)}
                          aria-label="Selecionar linha"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{r.software}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {licencaLabel(r.licenca_id)}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1">
                          <span className="font-mono text-xs tabular-nums">
                            {maskTail(r.chave_ativacao)}
                          </span>
                          <CopyKeyButton value={r.chave_ativacao} />
                        </span>
                      </TableCell>
                      <TableCell>{r.tipo_licenca}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            r.status === "disponivel"
                              ? "secondary"
                              : r.status === "alocada"
                                ? "default"
                                : "destructive"
                          }
                        >
                          {STATUS_LABEL[r.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.ativos?.hostname ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.usuarios?.nome ?? "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">{r.data_alocacao ?? "—"}</TableCell>
                      <TableCell className="tabular-nums">{r.data_expiracao ?? "—"}</TableCell>
                      <TableCell>
                        {r.status === "alocada" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void desvincular(r)}
                            title="Devolver a chave para o pool de disponíveis"
                          >
                            Desvincular
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <>
          <BulkInsertDialog
            open={bulkOpen}
            onOpenChange={setBulkOpen}
            licencas={licencasRef}
            onDone={() => {
              void qc.invalidateQueries({ queryKey: ["licenses"] });
              void qc.invalidateQueries({ queryKey: ["chaves-saldo"] });
            }}
          />
          <WipeDialog
            open={wipeOpen}
            onOpenChange={setWipeOpen}
            total={rows.length}
            onDone={() => {
              setSelected(new Set());
              void qc.invalidateQueries({ queryKey: ["licenses"] });
            }}
          />
        </>
      )}
    </div>
  );
}

function BulkInsertDialog({
  open,
  onOpenChange,
  onDone,
  licencas,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
  licencas: any[];
}) {
  const [software, setSoftware] = React.useState("");
  const [tipo, setTipo] = React.useState<TipoLicenca>("Volume");
  const [licencaId, setLicencaId] = React.useState<string | null>(null);
  const [texto, setTexto] = React.useState("");
  const [salvando, setSalvando] = React.useState(false);
  const [rep, setRep] = React.useState<RelatorioLote | null>(null);

  const licenca = licencas.find((l: any) => l.id === licencaId);
  const limite: number | null = licenca?.quantidade ?? null;

  const linhas: LinhaLote[] = React.useMemo(() => {
    return texto
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        // aceita CSV: chave;software;tipo;expiracao (separadores , ou ;)
        const p = l.split(/[;,\t]/).map((x) => x.trim());
        return {
          chave: p[0],
          software: p[1] || null,
          tipo_licenca: p[2] || null,
          data_expiracao: p[3] || null,
        };
      })
      .filter((r) => r.chave && r.chave.toLowerCase() !== "chave" && r.chave.toLowerCase() !== "chave_ativacao");
  }, [texto]);

  async function onFile(f: File | null) {
    if (!f) return;
    setTexto(await f.text());
  }

  async function salvar() {
    if (linhas.length === 0) return toast.error("Cole ao menos uma chave.");
    if (!software.trim() && !licencaId) return toast.error("Informe o software ou selecione a licença.");
    setSalvando(true);
    const r = await inserirChavesEmLote({
      licencaId,
      softwarePadrao: software.trim() || licenca?.produtos_catalogo?.nome_oficial || "",
      tipoPadrao: tipo,
      linhas,
    });
    setSalvando(false);
    setRep(r);
    if (r.inseridas > 0) toast.success(`${r.inseridas} chave(s) cadastrada(s).`);
    if (r.falhas.length > 0) toast.error(`${r.falhas.length} linha(s) não importada(s).`);
    onDone();
  }

  function fechar() {
    onOpenChange(false);
    setRep(null);
    setTexto("");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : fechar())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Inserir chaves em lote</DialogTitle>
          <DialogDescription>
            Cole uma chave por linha (ou envie um CSV com chave;software;tipo;expiração). A importação é
            parcial: linhas inválidas são reportadas e as demais são gravadas.
          </DialogDescription>
        </DialogHeader>

        {rep ? (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Linhas enviadas</p>
                <p className="text-xl font-semibold tabular-nums">{rep.total}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Cadastradas</p>
                <p className="text-xl font-semibold tabular-nums">{rep.inseridas}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Saldo de chaves: {rep.saldoDepois}
              {rep.limite != null ? ` de ${rep.limite} · ${Math.max(0, rep.limite - rep.saldoDepois)} pendente(s)` : ""}
            </p>
            {rep.falhas.length > 0 && (
              <div className="rounded-md border p-2 max-h-56 overflow-auto">
                <div className="font-medium mb-1">Não importadas</div>
                <ul className="space-y-1 text-xs">
                  {rep.falhas.map((f, i) => (
                    <li key={i}>
                      <span className="font-mono">{f.chave}</span> —{" "}
                      <span className="text-destructive">{f.motivo}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Licença do produto (opcional)</Label>
                <Combobox
                  placeholder="Sem vínculo"
                  searchPlaceholder="Buscar produto…"
                  clearable
                  value={licencaId}
                  onChange={(v) => setLicencaId(v)}
                  options={licencas.map((l: any) => ({
                    value: l.id,
                    label: l.produtos_catalogo?.nome_oficial ?? l.id.slice(0, 8),
                    hint: `${l.quantidade ?? 0} licença(s)`,
                  }))}
                />
              </div>
              <div>
                <Label>Tipo de licença</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as TipoLicenca)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Software</Label>
              <Input
                value={software}
                onChange={(e) => setSoftware(e.target.value)}
                placeholder={licenca?.produtos_catalogo?.nome_oficial ?? "Ex.: Windows 11 Pro"}
              />
            </div>
            <div>
              <Label>Chaves</Label>
              <Textarea
                rows={8}
                className="font-mono text-xs"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={"XXXXX-XXXXX-XXXXX\nYYYYY-YYYYY-YYYYY"}
              />
              <div className="mt-2 flex items-center gap-3">
                <Input
                  type="file"
                  accept=".csv,.txt"
                  className="max-w-xs"
                  onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
                />
                <span className="text-xs text-muted-foreground">
                  {linhas.length} chave(s) detectada(s)
                  {limite != null ? ` · limite da licença: ${limite}` : ""}
                </span>
              </div>
            </div>
            {linhas.length > 0 && (
              <div className="rounded-md border max-h-40 overflow-auto p-2 text-xs font-mono space-y-0.5">
                {linhas.slice(0, 30).map((l, i) => (
                  <div key={i}>{l.chave}</div>
                ))}
                {linhas.length > 30 && <div className="text-muted-foreground">…</div>}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={fechar}>{rep ? "Fechar" : "Cancelar"}</Button>
          {!rep && (
            <Button onClick={() => void salvar()} disabled={salvando}>
              {salvando ? "Cadastrando…" : `Cadastrar ${linhas.length} chave(s)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WipeDialog({
  open,
  onOpenChange,
  total,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  total: number;
  onDone: () => void;
}) {
  const [texto, setTexto] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function excluirTudo() {
    setSaving(true);
    const { error } = await supabase
      .from("licenses")
      .delete()
      .not("id", "is", null);
    setSaving(false);
    if (error) return toast.error(friendlyError(error));
    void logAction("BULK_DELETE", "licenses", { operacao: "excluir_todas", total });
    toast.success("Todas as licenças foram excluídas.");
    setTexto("");
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir todas as licenças</DialogTitle>
          <DialogDescription>
            Esta ação remove permanentemente as {total} licença(s) cadastradas. Digite
            <span className="font-mono font-semibold"> EXCLUIR </span> para confirmar.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="EXCLUIR"
          autoComplete="off"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={texto !== "EXCLUIR" || saving}
            onClick={() => void excluirTudo()}
          >
            {saving ? "Excluindo…" : "Excluir tudo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
