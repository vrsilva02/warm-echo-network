import { useEffect, useRef } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type Options = {
  /** Nome único do canal realtime */
  channel: string;
  /** Tabela do schema public a observar */
  table: string;
  /** Chaves de query invalidadas quando houver mudanças */
  queryKeys: QueryKey[];
  /** Janela de agrupamento dos eventos (ms) */
  batchMs?: number;
  /** Intervalo mínimo entre invalidações (ms) */
  minIntervalMs?: number;
  /** Permite ignorar eventos (ex.: pausar durante edição) */
  enabled?: boolean;
};

/**
 * Assina mudanças de uma tabela e invalida queries de forma agrupada
 * (debounce por janela + limite de frequência), evitando re-renderizações
 * a cada evento em importações/updates em massa.
 */
export function useRealtimeInvalidate({
  channel,
  table,
  queryKeys,
  batchMs = 1200,
  minIntervalMs = 4000,
  enabled = true,
}: Options) {
  const qc = useQueryClient();
  const keysRef = useRef(queryKeys);
  keysRef.current = queryKeys;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastRun = 0;
    let pending = 0;

    const flush = () => {
      timer = null;
      if (!pending) return;
      // Aba oculta: adia até voltar ao foco
      if (typeof document !== "undefined" && document.hidden) {
        timer = setTimeout(flush, 1000);
        return;
      }
      pending = 0;
      lastRun = Date.now();
      for (const key of keysRef.current) {
        void qc.invalidateQueries({ queryKey: key });
      }
    };

    const schedule = () => {
      if (!enabledRef.current) return;
      pending += 1;
      if (timer) return;
      const sinceLast = Date.now() - lastRun;
      const wait = Math.max(batchMs, minIntervalMs - sinceLast);
      timer = setTimeout(flush, wait);
    };

    const ch = supabase
      .channel(channel)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (_payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => schedule(),
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(ch);
    };
  }, [qc, channel, table, batchMs, minIntervalMs]);
}
