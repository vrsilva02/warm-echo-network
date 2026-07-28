import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/combobox";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { AlertTriangle, CheckCircle2, Package, Trash2, Clock, DollarSign } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ordens-servico_/$id")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Ordem de serviço — GestoraIT" },
      { name: "description", content: "Detalhe da OS, peças utilizadas e resumo do reparo." },
    ],
  }),
});

type OSDetail = {
  id: string; numero: number; ativo_id: string; descricao_defeito: string;
  prioridade: string; status: string; aberto_em: string; fechado_em: string | null;
  custo_total: number | null; observacoes_tecnicas: string | null;
  ativos?: { hostname: string; tipo: string; setor: string | null; modelo?: string | null } | null;
};
type PecaUsada = {
  id: string; peca_id: string; quantidade: number; custo_unitario: number | null;
  created_at: string; pecas_catalogo?: { nome: string } | null;
};
type Sugestao = { peca_id: string; nome: string; saldo: number; custo_unitario: number | null };

function Page() {
  const { canOperateOS, user } = useAuth();
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const { data: os } = useQuery({
    queryKey: ["os", id],
    queryFn: async () => ((await (supabase as any).from("ordens_servico").select("*, ativos(hostname, tipo, setor)").eq("id", id).maybeSingle()).data) as OSDetail | null,
  });
  const { data: pecas } = useQuery({
    queryKey: ["os_pecas", id],
    queryFn: async () => ((await (supabase as any).from("ordens_servico_pecas").select("*, pecas_catalogo(nome)").eq("ordem_servico_id", id).order("created_at")).data ?? []) as PecaUsada[],
  });

  async function mudarStatus(novo: string) {
    const { error } = await (supabase as any).from("ordens_servico").update({ status: novo }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Status atualizado");
    qc.invalidateQueries({ queryKey: ["os", id] });
    qc.invalidateQueries({ queryKey: ["ordens_servico"] });
    qc.invalidateQueries({ queryKey: ["ativos"] });
  }
  async function removerPeca(pid: string) {
    const { error } = await (supabase as any).from("ordens_servico_pecas").delete().eq("id", pid);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["os_pecas", id] });
    qc.invalidateQueries({ queryKey: ["vw_estoque_saldo"] });
  }

  const totalPecas = (pecas ?? []).reduce((s, p) => s + p.quantidade * Number(p.custo_unitario ?? 0), 0);
  const tempoMin = os?.fechado_em && os.aberto_em
    ? Math.round((new Date(os.fechado_em).getTime() - new Date(os.aberto_em).getTime()) / 60000)
    : null;

  if (!os) return <PageHeader title="OS não encontrada" />;

  return (
    <>
      <PageHeader
        title={`OS #${os.numero}`}
        description={<Link to="/ativos/$id" params={{ id: os.ativo_id }} className="hover:text-primary">{os.ativos?.hostname}</Link>}
       
        actions={
          canOperateOS && os.status !== "concluida" && os.status !== "cancelada" ? (
            <div className="flex gap-2">
              {os.status !== "em_andamento" && <Button size="sm" variant="outline" onClick={() => mudarStatus("em_andamento")}>Iniciar</Button>}
              {os.status !== "aguardando_peca" && <Button size="sm" variant="outline" onClick={() => mudarStatus("aguardando_peca")}>Aguardar peça</Button>}
              <Button size="sm" onClick={() => mudarStatus("concluida")}><CheckCircle2 className="h-4 w-4 mr-1" /> Concluir</Button>
            </div>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              Defeito reportado
              <Badge variant="outline">{os.prioridade}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-sm whitespace-pre-wrap">{os.descricao_defeito}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Resumo</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge>{os.status}</Badge></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Aberta em</span><span className="tabular-nums">{new Date(os.aberto_em).toLocaleString("pt-BR")}</span></div>
            {os.fechado_em && <div className="flex justify-between"><span className="text-muted-foreground">Fechada em</span><span className="tabular-nums">{new Date(os.fechado_em).toLocaleString("pt-BR")}</span></div>}
            {tempoMin != null && (
              <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Tempo total</span>
                <span className="tabular-nums">{Math.floor(tempoMin / 60)}h {tempoMin % 60}min</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2 mt-2">
              <span className="text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Custo em peças</span>
              <span className="tabular-nums font-semibold">R$ {totalPecas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4" /> Peças utilizadas</CardTitle>
          {canOperateOS && os.status !== "concluida" && os.status !== "cancelada" && (
            <Button size="sm" onClick={() => setAddOpen(true)}>Adicionar peça</Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Peça</TableHead>
                <TableHead className="text-right">Qtde.</TableHead>
                <TableHead className="text-right">Custo un.</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead>Registrada em</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(pecas ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">Nenhuma peça utilizada.</TableCell></TableRow>
              ) : pecas!.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.pecas_catalogo?.nome ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.quantidade}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.custo_unitario != null ? `R$ ${Number(p.custo_unitario).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">R$ {(p.quantidade * Number(p.custo_unitario ?? 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-xs">{new Date(p.created_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">
                    {canOperateOS && os.status !== "concluida" && (
                      <Button size="icon" variant="ghost" onClick={() => removerPeca(p.id)}><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AnexosCard osId={id} canOperate={canOperateOS} uploaderId={user?.id ?? null} />

      <AddPecaDialog open={addOpen} onOpenChange={setAddOpen} osId={id} ativoTipo={os.ativos?.tipo ?? null} onWaitPart={() => mudarStatus("aguardando_peca")} />
    </>
  );
}

function AddPecaDialog({ open, onOpenChange, osId, ativoTipo, onWaitPart }: {
  open: boolean; onOpenChange: (v: boolean) => void; osId: string; ativoTipo: string | null; onWaitPart: () => void;
}) {
  const qc = useQueryClient();
  const [pecaId, setPecaId] = useState<string | null>(null);
  const [qtd, setQtd] = useState(1);

  const { data: sugestoes } = useQuery({
    queryKey: ["pecas-sugeridas", ativoTipo], enabled: open,
    queryFn: async () => {
      const { data } = await (supabase as any).from("vw_estoque_saldo").select("peca_id, nome, saldo, custo_unitario, modelos_compativeis, categoria").order("nome");
      return (data ?? []) as Array<Sugestao & { modelos_compativeis: string[]; categoria: string }>;
    },
  });
  const compat = useMemo(() => {
    if (!ativoTipo) return sugestoes ?? [];
    return (sugestoes ?? []).filter((s) => (s.modelos_compativeis ?? []).some((m) => m.toLowerCase().includes(ativoTipo.toLowerCase())));
  }, [sugestoes, ativoTipo]);
  const opts = useMemo(() => (sugestoes ?? []).map((s) => ({
    value: s.peca_id, label: s.nome, hint: `saldo ${s.saldo}`,
  })), [sugestoes]);

  const selected = (sugestoes ?? []).find((s) => s.peca_id === pecaId);
  const semEstoque = selected && selected.saldo <= 0;

  function reset() { setPecaId(null); setQtd(1); }
  async function salvar() {
    if (!pecaId || !qtd) return toast.error("Selecione a peça e a quantidade.");
    if (semEstoque) return toast.error("Peça sem saldo em estoque.");
    const { error } = await (supabase as any).from("ordens_servico_pecas").insert({
      ordem_servico_id: osId, peca_id: pecaId, quantidade: Number(qtd),
      custo_unitario: selected?.custo_unitario ?? null,
    });
    if (error) return toast.error(error.message);
    toast.success("Peça adicionada — baixa automática de estoque");
    qc.invalidateQueries({ queryKey: ["os_pecas", osId] });
    qc.invalidateQueries({ queryKey: ["vw_estoque_saldo"] });
    reset(); onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Adicionar peça à OS</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {compat.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Peças compatíveis com este ativo:</p>
              <div className="flex flex-wrap gap-1">
                {compat.slice(0, 6).map((s) => (
                  <Badge key={s.peca_id} variant="outline"
                    className={`cursor-pointer ${s.saldo > 0 ? "hover:bg-primary/10" : "opacity-60"}`}
                    onClick={() => setPecaId(s.peca_id)}>
                    {s.nome} · saldo {s.saldo}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <div>
            <Label>Peça *</Label>
            <Combobox value={pecaId} onChange={setPecaId} options={opts} placeholder="Selecionar peça…" searchPlaceholder="Buscar…" />
          </div>
          {selected && (
            <div className="text-xs text-muted-foreground">
              Saldo atual: <strong className={selected.saldo <= 0 ? "text-destructive" : ""}>{selected.saldo}</strong>
              {selected.custo_unitario != null && <> · Custo un.: R$ {Number(selected.custo_unitario).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</>}
            </div>
          )}
          {semEstoque && (
            <Alert className="border-destructive/40 bg-destructive/10">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="text-sm">Peça sem estoque</AlertTitle>
              <AlertDescription className="text-xs">
                Marque a OS como "aguardando peça" enquanto compra a reposição.
                <Button size="sm" variant="outline" className="mt-2" onClick={() => { onWaitPart(); onOpenChange(false); }}>
                  Marcar como aguardando peça
                </Button>
              </AlertDescription>
            </Alert>
          )}
          <div>
            <Label>Quantidade *</Label>
            <Input type="number" min={1} value={qtd} onChange={(e) => setQtd(Number(e.target.value))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={!!semEstoque}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AnexosCard({ osId, canOperate, uploaderId }: { osId: string; canOperate: boolean; uploaderId: string | null }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [descricao, setDescricao] = useState("");

  const { data: anexos } = useQuery({
    queryKey: ["os_anexos", osId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("ordens_servico_anexos")
        .select("*")
        .eq("ordem_servico_id", osId)
        .order("created_at", { ascending: false });
      return (data ?? []) as Array<{
        id: string; storage_path: string; nome_arquivo: string;
        mime_type: string | null; tamanho_bytes: number | null;
        descricao: string | null; created_at: string;
      }>;
    },
  });

  async function upload(file: File) {
    if (!uploaderId) return toast.error("Sessão inválida.");
    if (file.size > 20 * 1024 * 1024) return toast.error("Arquivo maior que 20 MB.");
    setBusy(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${osId}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage
        .from("os-evidencias")
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (upErr) throw upErr;
      const { error: insErr } = await (supabase as any).from("ordens_servico_anexos").insert({
        ordem_servico_id: osId,
        storage_path: path,
        nome_arquivo: file.name,
        mime_type: file.type || null,
        tamanho_bytes: file.size,
        descricao: descricao || null,
        uploaded_by: uploaderId,
      });
      if (insErr) throw insErr;
      toast.success("Evidência anexada");
      setDescricao("");
      qc.invalidateQueries({ queryKey: ["os_anexos", osId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no upload");
    } finally {
      setBusy(false);
    }
  }

  async function baixar(path: string, nome: string) {
    const { data, error } = await supabase.storage.from("os-evidencias").createSignedUrl(path, 60);
    if (error || !data) return toast.error("Não foi possível abrir o arquivo");
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = nome;
    a.target = "_blank";
    a.rel = "noopener";
    a.click();
  }

  async function remover(id: string, path: string) {
    if (!confirm("Remover esta evidência?")) return;
    await supabase.storage.from("os-evidencias").remove([path]);
    const { error } = await (supabase as any).from("ordens_servico_anexos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["os_anexos", osId] });
  }

  function fmtSize(n: number | null) {
    if (!n) return "—";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
  }

  return (
    <Card className="mt-4">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">Evidências (fotos / documentos)</CardTitle>
        {canOperate && (
          <div className="flex items-center gap-2">
            <Input
              placeholder="Descrição (opcional)"
              className="h-8 w-56"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
            <label>
              <input
                type="file"
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
                  e.target.value = "";
                }}
              />
              <Button size="sm" asChild disabled={busy}>
                <span>{busy ? "Enviando…" : "Anexar arquivo"}</span>
              </Button>
            </label>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Arquivo</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Tamanho</TableHead>
              <TableHead>Enviado em</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(anexos ?? []).length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">Nenhuma evidência anexada.</TableCell></TableRow>
            ) : anexos!.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <button className="text-left font-medium hover:text-primary" onClick={() => baixar(a.storage_path, a.nome_arquivo)}>
                    {a.nome_arquivo}
                  </button>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{a.descricao ?? "—"}</TableCell>
                <TableCell className="text-xs">{a.mime_type ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums text-xs">{fmtSize(a.tamanho_bytes)}</TableCell>
                <TableCell className="text-xs">{new Date(a.created_at).toLocaleString("pt-BR")}</TableCell>
                <TableCell className="text-right">
                  {canOperate && (
                    <Button size="icon" variant="ghost" onClick={() => remover(a.id, a.storage_path)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
