import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  titulo: string;
  descricao: string;
  severidade: "critico" | "alto" | "medio";
  link: string;
};

function useAlertasCount() {
  return useQuery({
    queryKey: ["alertas", "bell"],
    refetchInterval: 60_000,
    queryFn: async (): Promise<Item[]> => {
      const [vc, elp, oc] = await Promise.all([
        supabase.from("vw_contratos_vencendo").select("*"),
        supabase.from("vw_elp").select("*"),
        supabase.from("vw_licencas_ociosas").select("*"),
      ]);
      const out: Item[] = [];
      for (const c of (vc.data ?? []) as any[]) {
        const dias = c.dias_para_vencer;
        if (dias == null || dias > 90) continue;
        const sev: Item["severidade"] = dias < 0 || dias <= 30 ? "critico" : dias <= 60 ? "alto" : "medio";
        out.push({
          id: `c-${c.id}`,
          titulo: `Contrato ${c.fornecedor}`,
          descricao: dias < 0 ? `Vencido há ${Math.abs(dias)} dia(s)` : `Vence em ${dias} dia(s)`,
          severidade: sev,
          link: "/contratos",
        });
      }
      for (const p of (elp.data ?? []) as any[]) {
        if (p.status_compliance !== "deficit") continue;
        const excesso = Number(p.licencas_alocadas) - Number(p.licencas_compradas);
        out.push({
          id: `d-${p.produto_id}`,
          titulo: `Déficit: ${p.nome_oficial}`,
          descricao: `${excesso} licença(s) além do adquirido`,
          severidade: excesso > 10 ? "critico" : "alto",
          link: "/licencas",
        });
      }
      for (const o of (oc.data ?? []) as any[]) {
        out.push({
          id: `o-${o.licenca_id}`,
          titulo: `${o.nome_oficial} ocioso`,
          descricao: `${o.quantidade} sem alocação há +90 dias`,
          severidade: "medio",
          link: "/alocacoes",
        });
      }
      // ordena por severidade
      const order = { critico: 0, alto: 1, medio: 2 } as const;
      return out.sort((a, b) => order[a.severidade] - order[b.severidade]);
    },
  });
}

const sevStyles: Record<Item["severidade"], string> = {
  critico: "border-l-destructive bg-destructive/5",
  alto: "border-l-amber-500 bg-amber-500/5",
  medio: "border-l-slate-400 bg-muted/40",
};

const sevLabel: Record<Item["severidade"], string> = {
  critico: "Crítico",
  alto: "Alto",
  medio: "Médio",
};

export function NotificationsBell() {
  const { data = [] } = useAlertasCount();
  const total = data.length;
  const preview = data.slice(0, 6);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
          <Bell className="h-4 w-4" />
          {total > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium leading-none text-destructive-foreground">
              {total > 99 ? "99+" : total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="text-sm font-medium">Notificações</div>
          <Badge variant="secondary" className="font-mono">{total}</Badge>
        </div>
        <div className="max-h-80 overflow-auto">
          {preview.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Nenhum alerta ativo no momento.
            </div>
          ) : (
            <ul className="divide-y">
              {preview.map((a) => (
                <li key={a.id} className={cn("border-l-2 px-3 py-2 text-sm", sevStyles[a.severidade])}>
                  <Link to={a.link} className="block hover:underline">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium leading-tight">{a.titulo}</span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {sevLabel[a.severidade]}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{a.descricao}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t p-2">
          <Button asChild variant="ghost" size="sm" className="w-full justify-center">
            <Link to="/alertas">Ver todos os alertas</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
