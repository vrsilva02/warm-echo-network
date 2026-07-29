import * as React from "react";
import { toast } from "sonner";

/**
 * Gerenciador global de jobs de importação em massa.
 *
 * Permite que o dialog inicie um processamento, seja fechado, e o trabalho
 * continue em segundo plano — emitindo notificações (toast) ao concluir e
 * mantendo o último relatório disponível para reabertura via "Ver relatório".
 */

export type BulkJobStatus = "running" | "done" | "error";

export type BulkJob<R = unknown> = {
  id: string;
  scope: string;
  label: string;
  total: number;
  processed: number;
  phase?: string;
  status: BulkJobStatus;
  startedAt: number;
  finishedAt?: number;
  report?: R;
  error?: string;
  acknowledged?: boolean;
};

type Runner<R> = (
  onProgress: (processed: number) => void,
  setPhase: (phase: string) => void,
) => Promise<R>;

/** Divide um array em lotes de tamanho fixo (usado nas gravações em massa). */
export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}


class Manager {
  private jobs = new Map<string, BulkJob>();
  private latestByScope = new Map<string, string>();
  private listeners = new Set<() => void>();

  subscribe(cb: () => void) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private emit() {
    this.listeners.forEach((cb) => cb());
  }

  getLatest<R = unknown>(scope: string): BulkJob<R> | undefined {
    const id = this.latestByScope.get(scope);
    return id ? (this.jobs.get(id) as BulkJob<R> | undefined) : undefined;
  }

  acknowledge(scope: string) {
    const job = this.getLatest(scope);
    if (job && job.status !== "running") {
      job.acknowledged = true;
      this.emit();
    }
  }

  start<R>(opts: {
    scope: string;
    label: string;
    total: number;
    successToast: (report: R) => string;
    run: Runner<R>;
    onDone?: (report: R) => void;
  }): string {
    const id =
      (globalThis.crypto && "randomUUID" in globalThis.crypto
        ? globalThis.crypto.randomUUID()
        : `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    const job: BulkJob<R> = {
      id,
      scope: opts.scope,
      label: opts.label,
      total: opts.total,
      processed: 0,
      status: "running",
      startedAt: Date.now(),
    };
    this.jobs.set(id, job);
    this.latestByScope.set(opts.scope, id);
    this.emit();

    void opts
      .run((n) => {
        job.processed = Math.min(n, job.total);
        this.emit();
      })
      .then((report) => {
        job.status = "done";
        job.processed = job.total;
        job.finishedAt = Date.now();
        job.report = report;
        this.emit();
        toast.success(opts.successToast(report));
        opts.onDone?.(report);
      })
      .catch((err) => {
        job.status = "error";
        job.finishedAt = Date.now();
        job.error = err instanceof Error ? err.message : String(err);
        this.emit();
        toast.error(`${opts.label}: falha na importação — ${job.error}`);
      });

    return id;
  }
}

export const bulkImportManager = new Manager();

export function useLatestBulkJob<R = unknown>(scope: string): BulkJob<R> | undefined {
  const subscribe = React.useCallback((cb: () => void) => bulkImportManager.subscribe(cb), []);
  const getSnapshot = React.useCallback(
    () => bulkImportManager.getLatest<R>(scope),
    [scope],
  );
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
