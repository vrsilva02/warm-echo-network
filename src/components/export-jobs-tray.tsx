import { useSyncExternalStore } from "react";
import {
  subscribeExportJobs,
  getExportJobs,
  downloadExportJob,
  removeExportJob,
  clearFinishedExportJobs,
} from "@/lib/export-jobs";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Download, Loader2, X, FileSpreadsheet, AlertCircle } from "lucide-react";

export function ExportJobsTray() {
  const jobs = useSyncExternalStore(
    subscribeExportJobs,
    getExportJobs,
    () => [],
  );
  if (jobs.length === 0) return null;

  const running = jobs.filter(
    (j) => j.status === "coletando" || j.status === "gerando",
  ).length;
  const ready = jobs.filter((j) => j.status === "pronto" && !j.downloaded).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Exportações"
        >
          {running > 0 ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {ready > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground tabular-nums">
              {ready}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Exportações</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={clearFinishedExportJobs}
          >
            Limpar concluídas
          </Button>
        </div>
        <ul className="max-h-80 divide-y overflow-auto">
          {jobs.map((job) => (
            <li key={job.id} className="flex items-start gap-2 px-3 py-2.5">
              <div className="mt-0.5 text-muted-foreground">
                {job.status === "erro" ? (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{job.label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {job.status === "coletando" && "Coletando dados…"}
                  {job.status === "gerando" && "Gerando XLSX…"}
                  {job.status === "pronto" &&
                    `${job.rowCount?.toLocaleString("pt-BR") ?? "—"} registros · pronto`}
                  {job.status === "erro" && (job.error ?? "Falha na exportação")}
                </p>
                {(job.status === "coletando" || job.status === "gerando") && (
                  <Progress value={job.progress} className="mt-1.5 h-1" />
                )}
              </div>
              {job.status === "pronto" && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => downloadExportJob(job.id)}
                >
                  Baixar
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                aria-label="Remover"
                onClick={() => removeExportJob(job.id)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
