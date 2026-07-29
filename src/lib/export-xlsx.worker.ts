/// <reference lib="webworker" />
import { buildXLSXBuffer, type Cell } from "./export-xlsx-core";

type Req = {
  id: number;
  columns: string[];
  rows: Cell[][];
  sheetName?: string;
};

self.onmessage = async (e: MessageEvent<Req>) => {
  const { id, columns, rows, sheetName } = e.data;
  try {
    const buffer = await buildXLSXBuffer(columns, rows, sheetName);
    (self as unknown as Worker).postMessage({ id, ok: true, buffer }, [buffer]);
  } catch (err) {
    (self as unknown as Worker).postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
