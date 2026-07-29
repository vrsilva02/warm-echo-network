/// <reference lib="webworker" />
import { parseTabularBuffer } from "./parse-tabular-core";

type Req = { id: number; buffer: ArrayBuffer; fileName: string };

self.onmessage = async (e: MessageEvent<Req>) => {
  const { id, buffer, fileName } = e.data;
  try {
    const result = await parseTabularBuffer(buffer, fileName);
    (self as unknown as Worker).postMessage({ id, ok: true, result });
  } catch (err) {
    (self as unknown as Worker).postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
