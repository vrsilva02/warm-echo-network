import { buildXLSXBlob, type Cell } from "./xlsx-builder";

export type ExportJobStatus = "coletando" | "gerando" | "pronto" | "erro";

export type ExportJob = {
  id: string;
  label: string;
  filename: string;
  status: ExportJobStatus;
  progress: number; // 0..100
  rowCount?: number;
  error?: string;
  blobUrl?: string;
  createdAt: number;
  downloaded?: boolean;
};

type Listener = () => void;

let jobs: ExportJob[] = [];
const listeners = new Set<Listener>();

function emit() {
  jobs = [...jobs];
  for (const l of listeners) l();
}

function patch(id: string, data: Partial<ExportJob>) {
  jobs = jobs.map((j) => (j.id === id ? { ...j, ...data } : j));
  for (const l of listeners) l();
}

export function subscribeExportJobs(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getExportJobs() {
  return jobs;
}

export function removeExportJob(id: string) {
  const job = jobs.find((j) => j.id === id);
  if (job?.blobUrl) URL.revokeObjectURL(job.blobUrl);
  jobs = jobs.filter((j) => j.id !== id);
  emit();
}

export function clearFinishedExportJobs() {
  for (const j of jobs) {
    if (j.status === "pronto" && j.blobUrl) URL.revokeObjectURL(j.blobUrl);
  }
  jobs = jobs.filter((j) => j.status === "coletando" || j.status === "gerando");
  emit();
}

export function downloadExportJob(id: string) {
  const job = jobs.find((j) => j.id === id);
  if (!job?.blobUrl) return;
  const a = document.createElement("a");
  a.href = job.blobUrl;
  a.download = job.filename;
  a.click();
  patch(id, { downloaded: true });
}

export type ExportJobInput = {
  /** Nome amigável exibido na bandeja de exportações. */
  label: string;
  filename: string;
  sheetName?: string;
  /** Carrega os dados (pode paginar); reporte progresso de 0 a 100. */
  load: (onProgress: (pct: number) => void) => Promise<{
    columns: string[];
    rows: Cell[][];
  }>;
  /** Baixar automaticamente assim que ficar pronto. */
  autoDownload?: boolean;
  onReady?: (job: ExportJob) => void;
  onError?: (message: string) => void;
};

/**
 * Enfileira uma exportação assíncrona: os dados são coletados e o XLSX é
 * gerado em background (Web Worker), sem travar a navegação. O arquivo fica
 * disponível na bandeja de exportações até o usuário baixar.
 */
export function queueXLSXExport(input: ExportJobInput): string {
  const id = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const filename = input.filename.replace(/\.(csv|xlsx?)$/i, "") + ".xlsx";
  jobs = [
    {
      id,
      label: input.label,
      filename,
      status: "coletando",
      progress: 0,
      createdAt: Date.now(),
    },
    ...jobs,
  ];
  emit();

  void (async () => {
    try {
      const { columns, rows } = await input.load((pct) =>
        patch(id, { progress: Math.max(0, Math.min(95, Math.round(pct * 0.9))) }),
      );
      patch(id, { status: "gerando", progress: 95, rowCount: rows.length });
      const blob = await buildXLSXBlob(columns, rows, input.sheetName);
      const blobUrl = URL.createObjectURL(blob);
      patch(id, { status: "pronto", progress: 100, blobUrl });
      const job = jobs.find((j) => j.id === id)!;
      if (input.autoDownload) downloadExportJob(id);
      input.onReady?.(job);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      patch(id, { status: "erro", error: message });
      input.onError?.(message);
    }
  })();

  return id;
}
