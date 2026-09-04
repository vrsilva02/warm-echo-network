import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/combobox";
import { toast } from "sonner";
import { fetchAll } from "@/lib/fetch-all";
import { alocarChavesEmLote, type Chave } from "@/lib/chaves-licenca";

type Ativo = { id: string; hostname: string; numero_patrimonio: string | null };

/**
 * Aloca N chaves disponíveis de uma licença a N ativos distintos de uma vez.
 * Todas as listas usam o dataset completo (sem limite de linhas).
 */
export function AlocacaoLoteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [licencaId, setLicencaId] = React.useState<string | null>(null);
  const [busca, setBusca] = React.useState("");
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [salvando, setSalvando] = React.useState(false);

  const { data: licencas = [] } = useQuery({
    queryKey: ["licencas-lite"],
    queryFn: async () =>
      (await fetchAll<any>("licencas", "id, quantidade, produtos_catalogo(id, nome_oficial)")).data,
  });

  const { data: ativos = [] } = useQuery({
    queryKey: ["ativos-lite"],
    queryFn: async () =>
      (await fetchAll<Ativo>("ativos", "id,hostname,numero_patrimonio", (q) => q.order("hostname"))).data,
  });

  const { data: chaves = [] } = useQuery({
    queryKey: ["chaves-disponiveis-alocacao"],
    queryFn: async () =>
      (
        await fetchAll<Chave>("licenses", "id, software, chave_ativacao, tipo_licenca, licenca_id, status", (q) =>
          q.eq("status", "disponivel").order("software"),
        )
      ).data,
  });

  const produtoNome =
    (licencas.find((l: any) => l.id === licencaId)?.produtos_catalogo?.nome_oficial ?? "").trim().toLowerCase();

  const disponiveis = React.useMemo(() => {
    if (!licencaId) return [];
    const porLicenca = chaves.filter((c) => c.licenca_id === licencaId);
    if (porLicenca.length > 0) return porLicenca;
    return produtoNome ? chaves.filter((c) => c.software.trim().toLowerCase() === produtoNome) : [];
  }, [chaves, licencaId, produtoNome]);

  const filtrados = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return ativos;
    return ativos.filter(
      (a) =>
        a.hostname.toLowerCase().includes(q) || (a.numero_patrimonio ?? "").toLowerCase().includes(q),
    );
  }, [ativos, busca]);

  function toggle(id: string) {
    setSel((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function alocar() {
    if (!licencaId) return toast.error("Selecione a licença.");
    if (sel.size === 0) return toast.error("Selecione ao menos um ativo.");
    if (sel.size > disponiveis.length) {
      return toast.error(
        `Só existem ${disponiveis.length} chave(s) disponível(is) para esta licença e você selecionou ${sel.size} ativo(s).`,
      );
    }
    setSalvando(true);
    const r = await alocarChavesEmLote({
      licencaId,
      chaveIds: disponiveis.map((c) => c.id),
      ativoIds: Array.from(sel),
    });
    setSalvando(false);
    if (r.alocadas > 0) toast.success(`${r.alocadas} chave(s) alocada(s).`);
    if (r.falhas.length > 0) toast.error(`${r.falhas.length} falha(s): ${r.falhas[0].motivo}`);
    setSel(new Set());
    onOpenChange(false);
    void qc.invalidateQueries({ queryKey: ["alocacoes"] });
    void qc.invalidateQueries({ queryKey: ["licenses"] });
    void qc.invalidateQueries({ queryKey: ["chaves-disponiveis-alocacao"] });
    void qc.invalidateQueries({ queryKey: ["chaves-saldo"] });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Alocação em lote</DialogTitle>
          <DialogDescription>
            Escolha a licença e marque os ativos: cada ativo recebe uma chave disponível diferente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Licença</Label>
            <Combobox
              placeholder="Selecione a licença…"
              searchPlaceholder="Buscar produto…"
              value={licencaId}
              onChange={(v) => setLicencaId(v)}
              options={licencas.map((l: any) => ({
                value: l.id,
                label: l.produtos_catalogo?.nome_oficial ?? l.id.slice(0, 8),
                hint: `${l.quantidade ?? 0} licença(s) adquirida(s)`,
              }))}
            />
            {licencaId && (
              <p className="text-xs text-muted-foreground mt-1">
                {disponiveis.length} chave(s) disponível(is) · {sel.size} ativo(s) selecionado(s)
              </p>
            )}
          </div>

          <div>
            <Label>Ativos ({ativos.length} cadastrados)</Label>
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por hostname ou patrimônio…"
            />
            <div className="mt-2 max-h-64 overflow-auto rounded-md border divide-y">
              {filtrados.map((a) => (
                <label key={a.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer">
                  <Checkbox checked={sel.has(a.id)} onCheckedChange={() => toggle(a.id)} />
                  <span className="font-medium">{a.hostname}</span>
                  {a.numero_patrimonio && (
                    <span className="text-xs text-muted-foreground">{a.numero_patrimonio}</span>
                  )}
                </label>
              ))}
              {filtrados.length === 0 && (
                <p className="px-3 py-4 text-sm text-muted-foreground">Nenhum ativo encontrado.</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void alocar()} disabled={salvando}>
            {salvando ? "Alocando…" : `Alocar ${sel.size} chave(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
