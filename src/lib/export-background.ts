import { toast } from "sonner";
import {
  queueXLSXExport,
  downloadExportJob,
  type ExportJobInput,
} from "./export-jobs";

/**
 * Exportação em background com notificações: mostra um toast de andamento e,
 * quando o XLSX termina de ser gerado, notifica com ação de download.
 */
export function exportXLSXInBackground(
  input: Omit<ExportJobInput, "onReady" | "onError">,
) {
  const toastId = toast.loading(`Gerando ${input.label}…`, {
    description: "Você pode continuar usando o sistema.",
  });

  return queueXLSXExport({
    ...input,
    onReady: (job) => {
      toast.success(`${input.label} pronto`, {
        id: toastId,
        description: job.rowCount
          ? `${job.rowCount.toLocaleString("pt-BR")} registros · ${job.filename}`
          : job.filename,
        duration: 12000,
        action: {
          label: "Baixar",
          onClick: () => downloadExportJob(job.id),
        },
      });
    },
    onError: (message) => {
      toast.error(`Falha ao gerar ${input.label}`, {
        id: toastId,
        description: message,
      });
    },
  });
}
