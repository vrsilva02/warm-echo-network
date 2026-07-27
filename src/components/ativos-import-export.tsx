import * as React from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Download, Upload, FileSpreadsheet, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { downloadCSV } from "@/lib/export";
import { logAction } from "@/lib/audit";
import { friendlyError } from "@/lib/errors";

/**
 * Colunas do template de importação em massa de ativos.
 * A ordem aqui é a mesma usada no CSV de exportação e no arquivo de exemplo,
 * garantindo que um export possa ser re-importado sem edições estruturais.
 */
const COLUMNS = [
  "hostname",
  "tipo",
  "numero_patrimonio",
  "numero_serie",
  "setor",
  "status_ciclo_vida",
  "responsavel_email",
] as const;

type Col = (typeof COLUMNS)[number];
type RawRow = Partial<Record<Col, string>>;

const REQUIRED: Col[] = ["hostname", "tipo"];
const STATUS_VALIDOS = new Set(["em_estoque", "em_uso", "em_manutencao", "baixado", "solicitado"]);

function nz(v: string | undefined): string | null {
  const s = (v ?? "").trim();
  return s === "" ? null : s;
}

/* ------------------------ Exportar ------------------------ */

export async function exportAtivos() {
  const { data, error } = await supabase
    .from("ativos")
    .select("hostname, tipo, numero_patrimonio, numero_serie, setor, status_ciclo_vida, usuarios(email)")
    .order("hostname");
  if (error) {
    toast.error(friendlyError(error));
    return;
  }
  const rows = (data ?? []).map((a: any) => [
    a.hostname ?? "",
    a.tipo ?? "",
    a.numero_patrimonio ?? "",
    a.numero_serie ?? "",
    a.setor ?? "",
    a.status_ciclo_vida ?? "",
    a.usuarios?.email ?? "",
  ]);
  const fname = `ativos_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCSV(fname, COLUMNS as unknown as string[], rows);
  void logAction("EXPORT", "ativos", { formato: "csv", total: rows.length, arquivo: fname });
  toast.success(`${rows.length} ativo(s) exportado(s).`);
}

export function downloadTemplate() {
  const exemplo = [
    "NB-0001",
    "Notebook",
    "PAT-000123",
    "SN123456789",
    "Financeiro",
    "em_uso",
    "colaborador@empresa.com",
  ];
  const vazia = COLUMNS.map(() => "");
  downloadCSV("template_ativos.csv", COLUMNS as unknown as string[], [exemplo, vazia]);
  toast.success("Template baixado. Preencha e reimporte.");
}

/* ------------------------ Importar ------------------------ */

type Report = {
  total: number;
  inseridos: number;
  atualizados: number;
  responsaveisNaoEncontrados: number;
  erros: { linha: number; motivo: string }[];
};

async function importarLinhas(rows: RawRow[]): Promise<Report> {
  const rep: Report = { total: rows.length, inseridos: 0, atualizados: 0, responsaveisNaoEncontrados: 0, erros: [] };

  // Cache de usuários e ativos existentes para reduzir round-trips.
  const [{ data: usuarios }, { data: existentes }] = await Promise.all([
    supabase.from("usuarios").select("id, email").not("email", "is", null),
    supabase.from("ativos").select("id, hostname"),
  ]);
  const userByEmail = new Map<string, string>(
    (usuarios ?? []).filter((u: any) => u.email).map((u: any) => [u.email.toLowerCase(), u.id]),
  );
  const ativoByHost = new Map<string, string>(
    (existentes ?? []).map((a: any) => [a.hostname.toLowerCase(), a.id]),
  );

  for (let i = 0; i < rows.length; i++) {
    const linha = i + 2; // +1 header, +1 base 1
    const r = rows[i];

    // Validação de obrigatórios.
    for (const req of REQUIRED) {
      if (!nz(r[req])) {
        rep.erros.push({ linha, motivo: `Campo obrigatório vazio: ${req}` });
      }
    }
    if (rep.erros.at(-1)?.linha === linha) continue;

    const hostname = nz(r.hostname)!;
    const tipo = nz(r.tipo)!;
    const status = nz(r.status_ciclo_vida) ?? "em_estoque";
    if (!STATUS_VALIDOS.has(status)) {
      rep.erros.push({
        linha,
        motivo: `status_ciclo_vida inválido: ${status}. Use: ${Array.from(STATUS_VALIDOS).join(", ")}`,
      });
      continue;
    }

    // Responsável — vincula apenas se o email já existir.
    let responsavelId: string | null = null;
    const email = nz(r.responsavel_email);
    if (email) {
      const found = userByEmail.get(email.toLowerCase());
      if (found) responsavelId = found;
      else rep.responsaveisNaoEncontrados++;
    }

    const payload = {
      hostname,
      tipo,
      numero_patrimonio: nz(r.numero_patrimonio),
      numero_serie: nz(r.numero_serie),
      setor: nz(r.setor),
      status_ciclo_vida: status,
      usuario_responsavel_id: responsavelId,
    };

    // Upsert por hostname (case-insensitive).
    const existenteId = ativoByHost.get(hostname.toLowerCase());
    if (existenteId) {
      const { error } = await supabase.from("ativos").update(payload).eq("id", existenteId);
      if (error) { rep.erros.push({ linha, motivo: `Atualizar: ${friendlyError(error)}` }); continue; }
      rep.atualizados++;
    } else {
      const { data, error } = await supabase.from("ativos").insert(payload).select("id").single();
      if (error) { rep.erros.push({ linha, motivo: `Inserir: ${friendlyError(error)}` }); continue; }
      ativoByHost.set(hostname.toLowerCase(), data!.id);
      rep.inseridos++;
    }
  }

  void logAction("BULK_UPDATE", "ativos", {
    operacao: "importar_csv",
    total: rep.total,
    inseridos: rep.inseridos,
    atualizados: rep.atualizados,
    responsaveis_nao_encontrados: rep.responsaveisNaoEncontrados,
    erros: rep.erros.length,
  });
  return rep;
}

function ImportDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<RawRow[] | null>(null);
  const [parseErr, setParseErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [report, setReport] = React.useState<Report | null>(null);

  function reset() {
    setFile(null); setPreview(null); setParseErr(null); setBusy(false); setProgress(0); setReport(null);
  }

  function onPick(f: File | null) {
    reset();
    if (!f) return;
    setFile(f);
    Papa.parse<RawRow>(f, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => {
        const cols = res.meta.fields ?? [];
        const faltando = COLUMNS.filter((c) => !cols.includes(c));
        if (faltando.length > 0) {
          setParseErr(`Colunas ausentes: ${faltando.join(", ")}. Baixe o template para o formato correto.`);
          return;
        }
        const rows = (res.data as RawRow[]).filter((r) => Object.values(r).some((v) => (v ?? "").toString().trim() !== ""));
        setPreview(rows);
      },
      error: (err) => setParseErr(err.message),
    });
  }

  async function confirmar() {
    if (!preview || preview.length === 0) return;
    setBusy(true);
    setProgress(5);
    try {
      const rep = await importarLinhas(preview);
      setProgress(100);
      setReport(rep);
      if (rep.inseridos + rep.atualizados > 0) {
        toast.success(`${rep.inseridos} inserido(s), ${rep.atualizados} atualizado(s).`);
      }
      if (rep.erros.length > 0) toast.warning(`${rep.erros.length} linha(s) com erro. Verifique o relatório.`);
      onDone();
    } catch (e: any) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !busy) { reset(); onOpenChange(false); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar ativos</DialogTitle>
          <DialogDescription>
            Envie um CSV seguindo o template. Ativos existentes (mesmo hostname) são atualizados; novos são criados. O responsável é vinculado quando o e-mail já existe em Usuários.
          </DialogDescription>
        </DialogHeader>

        {!report && (
          <div className="space-y-3">
            <div className="rounded-md border p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm truncate">{file?.name ?? "Nenhum arquivo selecionado"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => downloadTemplate()}>
                  <Download className="h-4 w-4" /> Template
                </Button>
                <label>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => onPick(e.target.files?.[0] ?? null)}
                  />
                  <Button asChild size="sm">
                    <span><Upload className="h-4 w-4" /> Escolher CSV</span>
                  </Button>
                </label>
              </div>
            </div>

            {parseErr && <div className="text-sm text-destructive">{parseErr}</div>}

            {preview && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
                <div className="font-medium">Pré-visualização</div>
                <div className="text-muted-foreground">
                  {preview.length} linha(s) prontas para importar. Colunas obrigatórias validadas no envio.
                </div>
                <div className="max-h-48 overflow-auto mt-2 text-xs">
                  <table className="w-full">
                    <thead className="bg-background sticky top-0">
                      <tr>
                        {(["hostname", "tipo", "numero_patrimonio", "setor", "status_ciclo_vida"] as Col[]).map((c) => (
                          <th key={c} className="text-left font-medium px-2 py-1 border-b">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 10).map((r, i) => (
                        <tr key={i} className="odd:bg-muted/30">
                          <td className="px-2 py-1">{r.hostname}</td>
                          <td className="px-2 py-1">{r.tipo}</td>
                          <td className="px-2 py-1 font-mono">{r.numero_patrimonio}</td>
                          <td className="px-2 py-1">{r.setor}</td>
                          <td className="px-2 py-1">{r.status_ciclo_vida}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.length > 10 && (
                    <div className="text-muted-foreground mt-1">…e mais {preview.length - 10} linha(s).</div>
                  )}
                </div>
              </div>
            )}

            {busy && <Progress value={progress} />}
          </div>
        )}

        {report && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Linhas no arquivo" value={report.total} />
              <Metric label="Ativos inseridos" value={report.inseridos} tone={report.inseridos > 0 ? "ok" : undefined} />
              <Metric label="Ativos atualizados" value={report.atualizados} tone={report.atualizados > 0 ? "ok" : undefined} />
              <Metric label="Responsáveis não encontrados" value={report.responsaveisNaoEncontrados} tone={report.responsaveisNaoEncontrados > 0 ? "warn" : undefined} />
              <Metric label="Linhas com erro" value={report.erros.length} tone={report.erros.length > 0 ? "danger" : undefined} />
            </div>
            {report.erros.length > 0 && (
              <div className="rounded-md border p-2 max-h-56 overflow-auto">
                <div className="font-medium mb-1">Erros</div>
                <ul className="space-y-1 text-xs">
                  {report.erros.map((e, i) => (
                    <li key={i}>Linha {e.linha}: <span className="text-destructive">{e.motivo}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {report ? (
            <Button onClick={() => { reset(); onOpenChange(false); }}>Fechar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }} disabled={busy}>Cancelar</Button>
              <Button onClick={confirmar} disabled={!preview || preview.length === 0 || busy}>
                {busy ? "Importando…" : `Importar ${preview?.length ?? 0} linha(s)`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" | "danger" }) {
  const cls =
    tone === "ok" ? "text-emerald-600"
    : tone === "warn" ? "text-[color:var(--warning)]"
    : tone === "danger" ? "text-destructive"
    : "";
  return (
    <div className="rounded-md border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}

/* ------------------------ Botão do cabeçalho ------------------------ */

export function AtivosImportExport({ canWrite, onImported }: { canWrite: boolean; onImported: () => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <FileSpreadsheet className="h-4 w-4" /> Importar / Exportar <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => void exportAtivos()}>
            <Download className="h-4 w-4" /> Exportar CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => downloadTemplate()}>
            <FileSpreadsheet className="h-4 w-4" /> Baixar template
          </DropdownMenuItem>
          {canWrite && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setOpen(true)}>
                <Upload className="h-4 w-4" /> Importar CSV…
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ImportDialog open={open} onOpenChange={setOpen} onDone={onImported} />
    </>
  );
}
