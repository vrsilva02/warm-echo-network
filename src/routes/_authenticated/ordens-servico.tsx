import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/combobox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ShieldCheck, Wrench, Plus, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/ordens-servico")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Ordens de serviço — GestoraIT" },
      { name: "description", content: "Painel Kanban de reparo e manutenção de ativos." },
    ],
  }),
});

type StatusOS = "aberta" | "em_andamento" | "aguardando_peca" | "concluida" | "cancelada";
type OS = {
  id: string; numero: number; ativo_id: string; descricao_defeito: string;
  prioridade: "baixa" | "media" | "alta" | "critica"; status: StatusOS;
  data_abertura: string; data_conclusao: string | null; custo_total: number | null;
  aberto_por: string | null;
  ativos?: { hostname: string; tipo: string; setor: string | null } | null;
};

const COLS: { key: StatusOS; title: string; tone: string }[] = [
  { key: "aberta", title: "Aberta", tone: "bg-[color:var(--info)]/10 border-[color:var(--info)]/30" },
  { key: "em_andamento", title: "Em andamento", tone: "bg-[color:var(--warning)]/10 border-[color:var(--warning)]/30" },
  { key: "aguardando_peca", title: "Aguardando peça", tone: "bg-destructive/10 border-destructive/30" },
  { key: "concluida", title: "Concluída", tone: "bg-[color:var(--success)]/10 border-[color:var(--success)]/30" },
];

const PRIO_TONE: Record<OS["prioridade"], string> = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-[color:var(--info)]/15 text-[color:var(--info)] border-[color:var(--info)]/30",
  alta: "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30",
  critica: "bg-destructive/15 text-destructive border-destructive/30",
};

function Page() {
  const { canWrite } = useAuth();
  const qc = useQueryClient();
  const [newOpen, setNewOpen] = useState(false);
  const [drag, setDrag] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: "todos",
    periodoInicio: "",
    periodoFim: "",
  });

  const { data: rows } = useQuery({
    queryKey: ["ordens_servico", filters],
    queryFn: async () => {
      let q = (supabase as any).from("ordens_servico").select("*, ativos(hostname, tipo, setor)");
      if (filters.status !== "todos") q = q.eq("status", filters.status);
      if (filters.periodoInicio) q = q.gte("data_abertura", filters.periodoInicio);
      if (filters.periodoFim) q = q.lte("data_abertura", filters.periodoFim);
      
      const { data, error } = await q.order("data_abertura", { ascending: false });
      if (error) throw error;
      return data as OS[];
    },
  });

  const grouped = useMemo(() => {
    const g: Record<StatusOS, OS[]> = { aberta: [], em_andamento: [], aguardando_peca: [], concluida: [], cancelada: [] };
    (rows ?? []).forEach((r) => { if (g[r.status]) g[r.status].push(r); });
    return g;
  }, [rows]);

  async function moveTo(id: string, novo: StatusOS) {
    const patch: any = { status: novo };
    // trigger no banco lida com data_fim + status do ativo
    const { error } = await (supabase as any).from("ordens_servico").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Status atualizado");
    qc.invalidateQueries({ queryKey: ["ordens_servico"] });
    qc.invalidateQueries({ queryKey: ["ativos"] });
  }

  return (
    <>
      <PageHeader
        title="Ordens de serviço"
        description="Kanban de reparos. Ao abrir uma OS, o ativo entra em manutenção automaticamente; ao concluir, volta ao status anterior."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 mr-4">
              <Input 
                type="date" 
                className="h-8 w-32 text-xs" 
                value={filters.periodoInicio} 
                onChange={e => setFilters(f => ({ ...f, periodoInicio: e.target.value }))} 
              />
              <span className="text-muted-foreground text-xs">até</span>
              <Input 
                type="date" 
                className="h-8 w-32 text-xs" 
                value={filters.periodoFim} 
                onChange={e => setFilters(f => ({ ...f, periodoFim: e.target.value }))} 
              />
              <Select value={filters.status} onValueChange={v => setFilters(f => ({ ...f, status: v }))}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos status</SelectItem>
                  <SelectItem value="aberta">Aberta</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="aguardando_peca">Aguardando peça</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {canWrite && <Button size="sm" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4 mr-1" /> Nova OS</Button>}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {COLS.map((c) => (
          <div
            key={c.key}
            onDragOver={(e) => { if (canWrite) e.preventDefault(); }}
            onDrop={() => { if (drag && canWrite) { moveTo(drag, c.key); setDrag(null); } }}
            className={`rounded-lg border p-2 min-h-[400px] ${c.tone}`}
          >
            <div className="flex items-center justify-between px-1 pb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide">{c.title}</h3>
              <Badge variant="outline" className="text-[10px]">{grouped[c.key].length}</Badge>
            </div>
            <div className="space-y-2">
              {grouped[c.key].map((os) => (
                <Card
                  key={os.id}
                  draggable={canWrite}
                  onDragStart={() => setDrag(os.id)}
                  onDragEnd={() => setDrag(null)}
                  className="cursor-grab active:cursor-grabbing hover:border-primary/60 transition"
                >
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to="/ordens-servico/$id"
                        params={{ id: os.id }}
                        className="text-sm font-semibold hover:text-primary flex items-center gap-1"
                      >
                        OS #{os.numero} <ChevronRight className="h-3 w-3" />
                      </Link>
                      <Badge variant="outline" className={`text-[10px] ${PRIO_TONE[os.prioridade]}`}>
                        {os.prioridade}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <div className="font-medium text-foreground">{os.ativos?.hostname ?? "—"}</div>
                      <div>{os.ativos?.setor ?? ""}</div>
                    </div>
                    <p className="text-xs line-clamp-2">{os.descricao_defeito}</p>
                    <div className="text-[10px] text-muted-foreground tabular-nums">
                      Aberta em {new Date(os.data_abertura).toLocaleDateString("pt-BR")}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {grouped[c.key].length === 0 && (
                <div className="text-[11px] text-muted-foreground text-center py-6">Vazio</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <NovaOSDialog open={newOpen} onOpenChange={setNewOpen} />
    </>
  );
}

type AtivoOpt = { id: string; hostname: string; tipo: string; setor: string | null; status_ciclo_vida: string; data_aquisicao: string | null; vida_util_meses: number | null };
function NovaOSDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [ativoId, setAtivoId] = useState<string | null>(null);
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState<OS["prioridade"]>("media");

  const { data: ativos } = useQuery({
    queryKey: ["ativos-lite"], enabled: open,
    queryFn: async () => ((await (supabase as any).from("ativos").select("id, hostname, tipo, setor, status_ciclo_vida, data_aquisicao, vida_util_meses").order("hostname")).data ?? []) as AtivoOpt[],
  });
  const opts = useMemo(() => (ativos ?? []).map((a) => ({ value: a.id, label: a.hostname, hint: a.tipo })), [ativos]);
  const ativo = (ativos ?? []).find((a) => a.id === ativoId) ?? null;

  const garantia = useMemo(() => {
    if (!ativo?.data_aquisicao || !ativo.vida_util_meses) return null;
    const d = new Date(ativo.data_aquisicao);
    d.setMonth(d.getMonth() + 12); // assume 12 meses de garantia padrão
    const emGarantia = d.getTime() > Date.now();
    return { data: d, emGarantia };
  }, [ativo]);

  function reset() { setAtivoId(null); setDescricao(""); setPrioridade("media"); }

  async function salvar() {
    if (!ativoId || !descricao.trim()) return toast.error("Selecione o ativo e descreva o defeito.");
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("ordens_servico").insert({
      ativo_id: ativoId, descricao_defeito: descricao.trim(),
      prioridade, status: "aberta", aberto_por: userRes.user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    toast.success("OS aberta — ativo movido para manutenção");
    qc.invalidateQueries({ queryKey: ["ordens_servico"] });
    qc.invalidateQueries({ queryKey: ["ativos"] });
    reset(); onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nova ordem de serviço</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Ativo *</Label>
            <Combobox value={ativoId} onChange={setAtivoId} options={opts} placeholder="Buscar por hostname…" searchPlaceholder="Digite o hostname…" />
          </div>
          {garantia && (
            <Alert className={garantia.emGarantia ? "border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10" : ""}>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle className="text-sm">
                {garantia.emGarantia ? "Ativo em garantia" : "Fora de garantia"}
              </AlertTitle>
              <AlertDescription className="text-xs">
                {garantia.emGarantia
                  ? `Cobertura estimada até ${garantia.data.toLocaleDateString("pt-BR")}. Considere acionar o fornecedor antes de usar peça de estoque.`
                  : "Reparo por conta própria — o consumo de peças reduzirá o estoque automaticamente."}
              </AlertDescription>
            </Alert>
          )}
          {ativo && ativo.status_ciclo_vida !== "em_uso" && (
            <Alert className="border-destructive/40 bg-destructive/10">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Ativo está com status <strong>{ativo.status_ciclo_vida}</strong>. Confirme antes de abrir a OS.
              </AlertDescription>
            </Alert>
          )}
          <div>
            <Label>Prioridade</Label>
            <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={prioridade} onChange={(e) => setPrioridade(e.target.value as any)}>
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
              <option value="critica">Crítica</option>
            </select>
          </div>
          <div>
            <Label>Descrição do defeito *</Label>
            <Textarea rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar}><Wrench className="h-4 w-4 mr-1" /> Abrir OS</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
