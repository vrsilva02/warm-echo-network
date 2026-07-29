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
    const id = this.latestByScope.get(scope);
    const job = id ? this.jobs.get(id) : undefined;
    if (id && job && job.status !== "running") {
      this.jobs.set(id, { ...job, acknowledged: true });
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

    // Atualiza o job de forma imutável (nova referência) para que
    // useSyncExternalStore detecte a mudança e o progresso apareça na UI.
    const patch = (p: Partial<BulkJob<R>>) => {
      const cur = this.jobs.get(id) as BulkJob<R>;
      this.jobs.set(id, { ...cur, ...p });
      this.emit();
    };

    let lastTick = 0;
    void opts
      .run(
        (n) => {
          const processed = Math.min(n, opts.total);
          const now = Date.now();
          // Throttle: no máximo ~10 atualizações por segundo.
          if (processed >= opts.total || now - lastTick > 100) {
            lastTick = now;
            patch({ processed });
          }
        },
        (phase) => patch({ phase }),
      )
      .then((report) => {
        patch({
          status: "done",
          processed: opts.total,
          finishedAt: Date.now(),
          phase: undefined,
          report,
        });
        toast.success(opts.successToast(report));
        opts.onDone?.(report);
      })
      .catch((err) => {
        patch({
          status: "error",
          finishedAt: Date.now(),
          error: err instanceof Error ? err.message : String(err),
        });
        toast.error(
          `${opts.label}: falha na importação — ${err instanceof Error ? err.message : String(err)}`,
        );
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
