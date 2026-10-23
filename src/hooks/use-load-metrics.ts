import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { moduloDoCaminho } from "@/lib/desempenho";

/** Mede quanto tempo cada módulo leva até terminar de carregar seus dados e registra no banco. */
export function useLoadMetrics(userId: string | undefined) {
  const { pathname } = useLocation();
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const inicio = performance.now();
    let feito = false;
    let ultimaAtividade = inicio;
    const finalizar = () => {
      if (feito) return;
      feito = true;
      const duracao = Math.round(ultimaAtividade - inicio);
      void supabase
        .from("metricas_carregamento" as any)
        .insert({ modulo: moduloDoCaminho(pathname), duracao_ms: Math.max(0, duracao), user_id: userId } as any)
        .then(() => {});
    };
    const tick = setInterval(() => {
      const ocupado = qc.isFetching() > 0;
      const agora = performance.now();
      if (ocupado) ultimaAtividade = agora;
      else if (agora - ultimaAtividade > 400) finalizar();
      if (agora - inicio > 30000) finalizar();
      if (feito) clearInterval(tick);
    }, 100);
    return () => clearInterval(tick);
  }, [pathname, userId, qc]);
}
