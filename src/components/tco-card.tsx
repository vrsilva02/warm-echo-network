import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Coins } from "lucide-react";

function brl(v: number | null | undefined) {
  return `R$ ${Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function TcoCard({ ativoId }: { ativoId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["vw_tco_ativo", ativoId],
    queryFn: async () => {
      const { data, error } = await supabase.from("vw_tco_ativo").select("*").eq("ativo_id", ativoId).maybeSingle();
      if (error) throw error;
      return data as {
        valor_aquisicao: number | null;
        valor_residual: number | null;
        custo_licencas_mensal: number | null;
        tco_anual_estimado: number | null;
      } | null;
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
        <Coins className="h-4 w-4 text-primary" />
        <CardTitle className="text-sm">TCO estimado</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-24" />
        ) : (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Item label="Valor de aquisição" value={brl(data?.valor_aquisicao)} />
            <Item label="Valor residual" value={brl(data?.valor_residual)} />
            <Item label="Custo licenças/mês" value={brl(data?.custo_licencas_mensal)} />
            <Item label="TCO anual estimado" value={brl(data?.tco_anual_estimado)} highlight />
          </div>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">
          Cálculo: valor de aquisição depreciado pela vida útil + custo mensal das licenças alocadas.
        </p>
      </CardContent>
    </Card>
  );
}

function Item({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-md border p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`font-mono tabular-nums ${highlight ? "text-primary font-semibold" : ""}`}>{value}</div>
    </div>
  );
}
