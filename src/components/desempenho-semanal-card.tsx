import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gauge, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { resumoDesempenhoSemanal } from "@/lib/desempenho.functions";

function seg(ms: number) {
  return `${(ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`;
}

/** Resumo semanal dos módulos mais lentos com causas prováveis sugeridas por IA. */
export function DesempenhoSemanalCard() {
  const fn = useServerFn(resumoDesempenhoSemanal);
  const m = useMutation({ mutationFn: () => fn() });
  const r = m.data;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Gauge className="h-4 w-4" /> Desempenho da semana
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => m.mutate()} disabled={m.isPending}>
          {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {r ? "Atualizar" : "Gerar resumo"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!r && !m.isPending && !m.isError && (
          <p className="text-muted-foreground">
            Veja os módulos mais lentos dos últimos 7 dias e as causas prováveis, analisadas por IA.
          </p>
        )}
        {m.isPending && <p className="text-muted-foreground">Analisando os tempos de carregamento…</p>}
        {m.isError && <p className="text-destructive">{(m.error as Error).message}</p>}
        {r && r.modulos.length === 0 && (
          <p className="text-muted-foreground">Ainda não há medições nesta semana. Navegue pelos módulos e volte depois.</p>
        )}
        {r && r.modulos.length > 0 && (
          <>
            <ul className="space-y-1">
              {r.modulos.slice(0, 5).map((x) => (
                <li key={x.modulo} className="flex justify-between gap-2 tabular-nums">
                  <span className="capitalize">{x.modulo.replace(/-/g, " ")}</span>
                  <span className="text-muted-foreground">
                    média {seg(x.mediaMs)} · pior {seg(x.p95Ms)} · {x.amostras} acessos
                  </span>
                </li>
              ))}
            </ul>
            {r.analise && <div className="whitespace-pre-line rounded-md bg-muted p-3">{r.analise}</div>}
            {r.erro && <p className="text-destructive">{r.erro}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
