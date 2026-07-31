import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ShieldAlert } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Query central compartilhada: hosts sem cobertura EDR (Kaspersky). */
export function useGapEdr(ativoIds?: string[]) {
  return useQuery({
    queryKey: ["vw_gap_edr", ativoIds ?? "all"],
    queryFn: async () => {
      let query = supabase.from("vw_gap_edr").select("ativo_id,hostname,setor,status_ciclo_vida");
      if (ativoIds) query = query.in("ativo_id", ativoIds);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Array<{ ativo_id: string; hostname: string | null; setor: string | null; status_ciclo_vida: string | null }>;
    },
    enabled: !ativoIds || ativoIds.length > 0,
    staleTime: 60_000,
  });
}

export function useGapEdrSet(ativoIds?: string[]) {
  const q = useGapEdr(ativoIds);
  return { ...q, set: new Set((q.data ?? []).map((r) => r.ativo_id)) };
}

export function EdrBadge({ ativoId, set }: { ativoId: string; set: Set<string> }) {
  if (!set.has(ativoId)) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center text-destructive" aria-label="Sem cobertura EDR">
          <ShieldAlert className="h-3.5 w-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent>Sem cobertura EDR</TooltipContent>
    </Tooltip>
  );
}
