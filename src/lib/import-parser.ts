import { parseTabularBuffer, type ParsedTable } from "./parse-tabular-core";

export type { ParsedTable };

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<
  number,
  { resolve: (v: ParsedTable) => void; reject: (e: Error) => void }
>();

function getWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./import-parser.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (
      e: MessageEvent<
        { id: number; ok: true; result: ParsedTable } | { id: number; ok: false; error: string }
      >,
    ) => {
      const entry = pending.get(e.data.id);
      if (!entry) return;
      pending.delete(e.data.id);
      if (e.data.ok) entry.resolve(e.data.result);
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

/**
 * Lê CSV, XLSX ou XLS retornando cabeçalhos normalizados (lowercase, trim)
 * e linhas como objetos de strings. O parsing acontece em um Web Worker
 * (quando disponível) para não travar a UI em arquivos grandes; se o worker
 * falhar, cai para o parsing na thread principal.
 */
export async function parseTabularFile(file: File): Promise<ParsedTable> {
  const buffer = await file.arrayBuffer();
  const w = getWorker();
  if (!w) return parseTabularBuffer(buffer, file.name);

  try {
    return await new Promise<ParsedTable>((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      // buffer é transferido (zero-copy) para o worker
      w.postMessage({ id, buffer, fileName: file.name }, [buffer]);
    });
  } catch {
    // fallback: o buffer pode ter sido transferido, então relê o arquivo
    return parseTabularBuffer(await file.arrayBuffer(), file.name);
  }
}
