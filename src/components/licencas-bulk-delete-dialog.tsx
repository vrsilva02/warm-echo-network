import * as React from "react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { AdvancedTable, type Column } from "@/components/advanced-table";
import { useConfirm } from "@/components/confirm-dialog";
import { supabase } from "@/integrations/supabase/client";
import { logAction } from "@/lib/audit";
import { friendlyError } from "@/lib/errors";
import { KeyRound, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

type LicencaRow = {
  id: string;
  nome_oficial: string;
  fabricante: string | null;
  categoria: string;
  subtipo: string | null;
  total: number;
  atribuidas: number;
  saldo: number;
  vencimento: string | null;
};

function mapRow(raw: any): LicencaRow | null {
  if (!raw?.licenca_id) return null;
  return {
    id: raw.licenca_id,
    nome_oficial: raw.nome ?? "Sem nome",
    fabricante: raw.fabricante ?? null,
    categoria: raw.categoria ?? "Outro",
    subtipo: raw.tipo_licenca ?? null,
    total: raw.total ?? 0,
    atribuidas: raw.atribuidas ?? 0,
    saldo: raw.disponiveis ?? 0,
    vencimento: raw.data_vencimento ?? null,
  };
}

export function LicencasBulkDeleteDialog({
  open,
  onOpenChange,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDeleted?: () => void;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [deleting, setDeleting] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["licencas-indicadores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_licencas_indicadores")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []).flatMap((r: any) => {
        const mapped = mapRow(r);
        return mapped ? [mapped] : [];
      });
    },
    enabled: open,
    staleTime: 10_000,
  });

  const hoje = new Date().toISOString().slice(0, 10);

  const columns: Column<LicencaRow>[] = [
    {
      id: "produto",
      header: "Produto",
      accessor: (r) => (
        <div className="min-w-0">
          <div className="font-medium truncate max-w-[220px]">{r.nome_oficial}</div>
          {r.subtipo && (
            <div className="text-xs text-muted-foreground truncate max-w-[220px]">{r.subtipo}</div>
          )}
        </div>
      ),
      searchValue: (r) => `${r.nome_oficial} ${r.fabricante ?? ""} ${r.subtipo ?? ""}`,
      sortValue: (r) => r.nome_oficial,
      exportValue: (r) => r.nome_oficial,
    },
    {
      id: "fabricante",
      header: "Fabricante",
      accessor: (r) => (
        <span className="text-muted-foreground">{r.fabricante ?? "—"}</span>
      ),
      searchValue: (r) => r.fabricante ?? "",
      sortValue: (r) => r.fabricante ?? "",
      exportValue: (r) => r.fabricante ?? "",
    },
    {
      id: "categoria",
      header: "Categoria",
      accessor: (r) => <Badge variant="secondary">{r.categoria}</Badge>,
      searchValue: (r) => r.categoria,
      sortValue: (r) => r.categoria,
      exportValue: (r) => r.categoria,
    },
    {
      id: "total",
      header: "Total",
      accessor: (r) => <span className="tabular-nums">{r.total}</span>,
      numeric: true,
      sortValue: (r) => r.total,
      exportValue: (r) => r.total,
    },
    {
      id: "atribuidas",
      header: "Atribuídas",
      accessor: (r) => <span className="tabular-nums">{r.atribuidas}</span>,
      numeric: true,
      sortValue: (r) => r.atribuidas,
      exportValue: (r) => r.atribuidas,
    },
    {
      id: "disponiveis",
      header: "Disponíveis",
      accessor: (r) => (
        <span className={`tabular-nums ${r.saldo < 0 ? "text-destructive" : ""}`}>{r.saldo}</span>
      ),
      numeric: true,
      sortValue: (r) => r.saldo,
      exportValue: (r) => r.saldo,
    },
    {
      id: "vencimento",
      header: "Vencimento",
      accessor: (r) => {
        if (!r.vencimento) return <span className="text-muted-foreground">—</span>;
        const vencido = r.vencimento < hoje;
        return (
          <span className={`tabular-nums ${vencido ? "text-destructive" : ""}`}>
            {new Date(r.vencimento).toLocaleDateString("pt-BR")}
          </span>
        );
      },
      sortValue: (r) => r.vencimento ?? "",
      exportValue: (r) => r.vencimento ?? "",
    },
  ];

  async function deletarLicenca(row: LicencaRow): Promise<{ ok: boolean; error?: string }> {
    try {
      const [blocosRes, ativasRes, historicoRes] = await Promise.all([
        supabase.from("licencas").select("id, quantidade").eq("produto_id", row.id),
        supabase
          .from("alocacoes")
          .select("id, licencas!inner(produto_id)", { count: "exact", head: true })
          .eq("licencas.produto_id", row.id)
          .is("data_fim", null),
        supabase
          .from("alocacoes")
          .select("id, licencas!inner(produto_id)", { count: "exact", head: true })
          .eq("licencas.produto_id", row.id)
          .not("data_fim", "is", null),
      ]);

      const blocos = blocosRes.data ?? [];
      const seatsTotais = blocos.reduce((s, b: any) => s + (b.quantidade ?? 0), 0);
      const atribuidas = ativasRes.count ?? row.atribuidas;
      const historico = historicoRes.count ?? 0;

      const { error } = await supabase.from("licencas").delete().eq("id", row.id);
      if (error) {
        if (error.message.includes("possui ativos vinculados")) {
          return { ok: false, error: "Possui atribuições ativas — desvincule antes de excluir." };
        }
        return { ok: false, error: friendlyError(error, "Não foi possível excluir esta licença.") };
      }

      void logAction(
        "BULK_DELETE",
        "licencas",
        {
          id: row.id,
          nome: row.nome_oficial,
          seats_totais: seatsTotais,
          atribuicoes_ativas: atribuidas,
          atribuicoes_historico: historico,
        },
        row.id,
      );
      return { ok: true };
    } catch {
      return { ok: false, error: "Erro inesperado ao excluir." };
    }
  }

  async function apagarSelecionadas(selected: LicencaRow[], clear: () => void) {
    if (selected.length === 0) return;

    const seatsTotais = selected.reduce((s, r) => s + (r.total ?? 0), 0);
    const atribuidas = selected.reduce((s, r) => s + (r.atribuidas ?? 0), 0);

    const ok = await confirm({
      title: "Excluir licenças em massa?",
      description:
        "As licenças selecionadas e todo o histórico vinculado a elas serão removidos definitivamente. Licenças com atribuições ativas serão preservadas até que você as desvincule primeiro.",
      tone: "danger",
      impact: [
        { label: "Licenças / SKUs", value: selected.length, tone: selected.length > 1 ? "warn" : "default" },
        { label: "Seats totais", value: seatsTotais, tone: seatsTotais > 0 ? "warn" : "default" },
        { label: "Atribuições ativas", value: atribuidas, tone: atribuidas > 0 ? "danger" : "default" },
      ],
      confirmLabel: `Excluir ${selected.length} licença(s) definitivamente`,
    });
    if (!ok) return;

    setDeleting(true);
    const erros: { nome: string; motivo: string }[] = [];
    let excluidas = 0;

    for (const row of selected) {
      const res = await deletarLicenca(row);
      if (res.ok) excluidas += 1;
      else erros.push({ nome: row.nome_oficial, motivo: res.error ?? "Erro desconhecido" });
    }

    setDeleting(false);

    if (erros.length === 0) {
      toast.success(`${excluidas} licença(s) excluída(s) definitivamente.`);
    } else {
      toast.error(
        `${excluidas} excluída(s), ${erros.length} com erro. ${erros
          .slice(0, 3)
          .map((e) => `${e.nome}: ${e.motivo}`)
          .join("; ")}${erros.length > 3 ? "…" : ""}`,
      );
    }

    void qc.invalidateQueries({ queryKey: ["licencas-indicadores"] });
    void qc.invalidateQueries({ queryKey: ["licencas-produtos-agg"] });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
    onDeleted?.();
    clear();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!deleting) onOpenChange(v); }}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Apagar licenças em massa
          </DialogTitle>
          <DialogDescription>
            Marque as licenças que deseja apagar e use o botão Excluir selecionadas. A exclusão é irreversível.
          </DialogDescription>
        </DialogHeader>

        <AdvancedTable<LicencaRow>
          storageKey="licencas-bulk-delete"
          rows={rows}
          isLoading={isLoading}
          columns={columns}
          getRowId={(r) => r.id}
          searchPlaceholder="Buscar produto, fabricante, categoria ou SKU…"
          exportFilename="licencas-para-excluir"
          bulkActions={(selected, clear) => (
            <Button
              size="sm"
              variant="destructive"
              disabled={deleting}
              onClick={() => void apagarSelecionadas(selected, clear)}
              className="gap-1"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Excluir {selected.length} selecionada{selected.length > 1 ? "s" : ""}
            </Button>
          )}
          emptyState={
            <EmptyState
              icon={<KeyRound className="h-6 w-6" />}
              title="Nenhuma licença para exibir"
              description="Cadastre licenças antes de usar esta ação."
            />
          }
        />
      </DialogContent>
    </Dialog>
  );
}
