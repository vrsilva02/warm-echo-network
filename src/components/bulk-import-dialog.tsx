import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { parseTabularFile } from "@/lib/import-parser";
import { bulkImportManager, useLatestBulkJob } from "@/lib/bulk-import";

/**
 * Diálogo genérico de importação em massa. Aceita CSV/XLSX/XLS mantendo o
 * mesmo template do exportador. O processamento é entregue ao
 * `bulkImportManager`, então o usuário pode fechar o diálogo (executar em
 * segundo plano) e será notificado ao concluir — reabrindo o diálogo, o
 * relatório fica disponível até ser explicitamente descartado.
 */
export type BulkImportDialogProps<Row, Report> = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  scope: string;
  title: string;
  description: string;
  requiredColumns: readonly string[];
  previewColumns: readonly string[];
  renderPreviewCell: (row: Row, col: string) => React.ReactNode;
  renderReport: (report: Report) => React.ReactNode;
  onTemplate: () => void;
  runImport: (
    rows: Row[],
    onProgress: (n: number) => void,
    setPhase: (p: string) => void,
  ) => Promise<Report>;

  successToast: (report: Report) => string;
  onDone?: (report: Report) => void;
};

export function BulkImportDialog<Row extends Record<string, string>, Report>(
  props: BulkImportDialogProps<Row, Report>,
) {
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<Row[] | null>(null);
  const [parseErr, setParseErr] = React.useState<string | null>(null);
  const [parsing, setParsing] = React.useState(false);

  const job = useLatestBulkJob<Report>(props.scope);
  const running = job?.status === "running";
  const showReport = !!job && job.status !== "running" && !job.acknowledged;

  function reset() {
    setFile(null);
    setPreview(null);
    setParseErr(null);
    setParsing(false);
  }

  async function onPick(f: File | null) {
    reset();
    if (!f) return;
    setFile(f);
    setParsing(true);
    try {
      const { headers, rows } = await parseTabularFile(f);
      const faltando = props.requiredColumns.filter((c) => !headers.includes(c));
      if (faltando.length > 0) {
        setParseErr(
          `Colunas ausentes: ${faltando.join(", ")}. Baixe o template para o formato correto.`,
        );
      } else {
        setPreview(rows as Row[]);
      }
    } catch (e: any) {
      setParseErr(e?.message ?? "Falha ao ler o arquivo.");
    } finally {
      setParsing(false);
    }
  }

  function iniciar() {
    if (!preview || preview.length === 0) return;
    const rows = preview;
    bulkImportManager.start<Report>({
      scope: props.scope,
      label: props.title,
      total: rows.length,
      successToast: props.successToast,
      run: (onProgress, setPhase) => props.runImport(rows, onProgress, setPhase),
      onDone: props.onDone,
    });
    reset();
  }

  function fechar() {
    if (showReport) bulkImportManager.acknowledge(props.scope);
    reset();
    props.onOpenChange(false);
  }

  const progressPct =
    running && job && job.total > 0
      ? Math.max(3, Math.round((job.processed / job.total) * 100))
      : 0;

  return (
    <Dialog open={props.open} onOpenChange={(v) => { if (!v) fechar(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription>{props.description}</DialogDescription>
        </DialogHeader>

        {running && job && (
          <div className="space-y-3 text-sm">
            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium truncate">{job.phase ?? "Importando…"}</span>
                <span className="tabular-nums text-muted-foreground shrink-0">
                  {job.processed} / {job.total} ({progressPct}%)
                </span>
              </div>
              <Progress value={progressPct} />
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  Você pode fechar este diálogo — o processamento segue em segundo plano.
                </span>
                {eta != null && <span className="tabular-nums shrink-0">~{eta}s restantes</span>}
              </div>
            </div>
          </div>
        )}


        {showReport && job?.report && (
          <div className="space-y-3 text-sm">
            <div className="rounded-md border bg-[color:var(--success)]/5 p-2 text-xs text-[color:var(--success)]">
              Importação concluída em{" "}
              {job.finishedAt ? ((job.finishedAt - job.startedAt) / 1000).toFixed(1) : "—"}s.
            </div>
            {props.renderReport(job.report)}
          </div>
        )}

        {showReport && job?.status === "error" && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            Falha na importação: {job.error}
          </div>
        )}

        {!running && !showReport && (
          <div className="space-y-3">
            <div className="rounded-md border p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm truncate">{file?.name ?? "Nenhum arquivo selecionado"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => props.onTemplate()}>
                  <Download className="h-4 w-4" /> Template
                </Button>
                <label>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    className="hidden"
                    onChange={(e) => void onPick(e.target.files?.[0] ?? null)}
                  />
                  <Button asChild size="sm">
                    <span><Upload className="h-4 w-4" /> Escolher arquivo</span>
                  </Button>
                </label>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Formatos aceitos: <span className="font-mono">.csv</span>,{" "}
              <span className="font-mono">.xlsx</span> ou <span className="font-mono">.xls</span>.
              A primeira aba da planilha é utilizada.
            </div>

            {parsing && <div className="text-xs text-muted-foreground">Lendo arquivo…</div>}
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
                        {props.previewColumns.map((c) => (
                          <th key={c} className="text-left font-medium px-2 py-1 border-b">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 10).map((r, i) => (
                        <tr key={i} className="odd:bg-muted/30">
                          {props.previewColumns.map((c) => (
                            <td key={c} className="px-2 py-1">
                              {props.renderPreviewCell(r, c)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.length > 10 && (
                    <div className="text-muted-foreground mt-1">
                      …e mais {preview.length - 10} linha(s).
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {running ? (
            <Button variant="outline" onClick={() => { reset(); props.onOpenChange(false); }}>
              Executar em segundo plano
            </Button>
          ) : showReport ? (
            <Button onClick={fechar}>Fechar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={fechar}>Cancelar</Button>
              <Button onClick={iniciar} disabled={!preview || preview.length === 0}>
                Importar {preview?.length ?? 0} linha(s)
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BulkMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn" | "danger";
}) {
  const cls =
    tone === "ok"
      ? "text-emerald-600"
      : tone === "warn"
      ? "text-[color:var(--warning)]"
      : tone === "danger"
      ? "text-destructive"
      : "";
  return (
    <div className="rounded-md border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}
