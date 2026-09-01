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

type TipoLicenca = "OEM" | "Retail" | "Volume" | "CSP";
type StatusLicenca = "disponivel" | "alocada" | "expirada";

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
  ativos?: { hostname: string } | null;
  usuarios?: { nome: string } | null;
};

const TIPOS: TipoLicenca[] = ["OEM", "Retail", "Volume", "CSP"];
const STATUS_LABEL: Record<StatusLicenca, string> = {
  disponivel: "Disponível",
  alocada: "Alocada",
  expirada: "Expirada",
};

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
    queryFn: async () => {
      const { data, error } = await supabase
        .from("licenses")
        .select(
          "id, software, chave_ativacao, tipo_licenca, status, ativo_id, usuario_id, data_alocacao, data_expiracao, ativos(hostname), usuarios(nome)",
        )
        .order("software", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as LicenseRow[];
    },
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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Chaves de Licença"
        description="Inventário de chaves de ativação vinculadas a ativos e colaboradores."
        actions={
          isAdmin ? (
            <div className="flex flex-wrap gap-2">
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
            </div>
          ) : undefined
        }
      />

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
                    <TableHead>Chave</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Alocação</TableHead>
                    <TableHead>Expiração</TableHead>
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
            onDone={() => void qc.invalidateQueries({ queryKey: ["licenses"] })}
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
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const [software, setSoftware] = React.useState("");
  const [tipo, setTipo] = React.useState<TipoLicenca>("Volume");
  const [quantidade, setQuantidade] = React.useState("");
  const [chaves, setChaves] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const linhas = React.useMemo(
    () =>
      chaves
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean),
    [chaves],
  );
  const qtd = parseInt(quantidade, 10);

  function reset() {
    setSoftware("");
    setTipo("Volume");
    setQuantidade("");
    setChaves("");
  }

  async function salvar() {
    if (!software.trim()) return toast.error("Informe o software.");
    if (!Number.isFinite(qtd) || qtd <= 0) return toast.error("Informe uma quantidade válida.");
    if (linhas.length !== qtd)
      return toast.error(
        `A quantidade informada (${qtd}) não bate com o número de chaves coladas (${linhas.length}).`,
      );
    const unicas = new Set(linhas);
    if (unicas.size !== linhas.length)
      return toast.error("Existem chaves duplicadas no texto colado.");

    setSaving(true);
    const payload = linhas.map((chave) => ({
      software: software.trim(),
      chave_ativacao: chave,
      tipo_licenca: tipo,
      status: "disponivel" as const,
    }));
    const { error } = await supabase.from("licenses").insert(payload);
    setSaving(false);
    if (error) return toast.error(friendlyError(error));
    void logAction("BULK_UPDATE", "licenses", {
      operacao: "insercao_massa",
      software: software.trim(),
      tipo_licenca: tipo,
      total: payload.length,
    });
    toast.success(`${payload.length} licença(s) criada(s).`);
    reset();
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Inserção em massa de licenças</DialogTitle>
          <DialogDescription>
            Cole uma chave de ativação por linha. Todas serão criadas com status “Disponível”.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="bl-software">Software</Label>
              <Input
                id="bl-software"
                value={software}
                maxLength={120}
                onChange={(e) => setSoftware(e.target.value)}
                placeholder="Windows 11 Pro"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de licença</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoLicenca)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bl-qtd">Quantidade total</Label>
            <Input
              id="bl-qtd"
              type="number"
              min={1}
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              className="w-40 tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bl-chaves">Chaves de ativação (uma por linha)</Label>
            <Textarea
              id="bl-chaves"
              rows={8}
              className="font-mono text-xs"
              value={chaves}
              onChange={(e) => setChaves(e.target.value)}
              placeholder={"XXXXX-XXXXX-XXXXX\nYYYYY-YYYYY-YYYYY"}
            />
            <p className="text-xs text-muted-foreground">
              {linhas.length} chave(s) detectada(s)
              {Number.isFinite(qtd) && qtd > 0 && linhas.length !== qtd ? (
                <span className="text-destructive"> — esperado {qtd}</span>
              ) : null}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()} disabled={saving}>
            {saving ? "Salvando…" : "Criar licenças"}
          </Button>
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
