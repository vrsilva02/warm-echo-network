import { buildXLSXBuffer, XLSX_MIME, type Cell } from "./export-xlsx-core";

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<
  number,
  { resolve: (b: ArrayBuffer) => void; reject: (e: Error) => void }
>();

function getWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./export-xlsx.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (
      e: MessageEvent<
        | { id: number; ok: true; buffer: ArrayBuffer }
        | { id: number; ok: false; error: string }
      >,
    ) => {
      const entry = pending.get(e.data.id);
      if (!entry) return;
      pending.delete(e.data.id);
      if (e.data.ok) entry.resolve(e.data.buffer);
      else entry.reject(new Error(e.data.error));
    };
    worker.onerror = () => {
      for (const [, entry] of pending) entry.reject(new Error("worker-failed"));
      pending.clear();
      worker?.terminate();
      worker = null;
    };
    return worker;
  } catch {
    worker = null;
    return null;
  }
}

/** Gera o XLSX fora da thread principal (com fallback) e devolve um Blob. */
export async function buildXLSXBlob(
  columns: string[],
  rows: Cell[][],
  sheetName = "Dados",
): Promise<Blob> {
  const w = getWorker();
  let buffer: ArrayBuffer;
  if (w) {
    try {
      buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const id = ++seq;
        pending.set(id, { resolve, reject });
        w.postMessage({ id, columns, rows, sheetName });
      });
    } catch {
      buffer = await buildXLSXBuffer(columns, rows, sheetName);
    }
  } else {
    buffer = await buildXLSXBuffer(columns, rows, sheetName);
  }
  return new Blob([buffer], { type: XLSX_MIME });
}

export { XLSX_MIME };
export type { Cell };
