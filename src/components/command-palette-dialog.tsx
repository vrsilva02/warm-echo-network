import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Server,
  Users,
  Package,
  FileText,
  KeySquare,
  Link2,
  Bell,
  ScrollText,
  BarChart3,
  UserCog,
  Upload,
} from "lucide-react";
import { useDebounce } from "@/lib/use-debounce";

type Nav = { label: string; url: string; icon: React.ComponentType<{ className?: string }> };

const navItems: Nav[] = [
  { label: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { label: "Ativos", url: "/ativos", icon: Server },
  { label: "Colaboradores", url: "/colaboradores", icon: Users },
  { label: "Catálogo de Produtos", url: "/produtos", icon: Package },
  { label: "Contratos", url: "/contratos", icon: FileText },
  { label: "Licenças", url: "/licencas", icon: KeySquare },
  { label: "Alocações", url: "/alocacoes", icon: Link2 },
  { label: "Reconciliação", url: "/reconciliacao", icon: Upload },
  { label: "Alertas", url: "/alertas", icon: Bell },
  { label: "Auditoria", url: "/auditoria", icon: ScrollText },
  { label: "Relatórios", url: "/relatorios", icon: BarChart3 },
  { label: "Gestão de Acessos", url: "/acessos", icon: UserCog },
];

type Hit = {
  kind: "ativo" | "usuario" | "produto";
  id: string;
  label: string;
  hint?: string;
  url: string;
};

export default function CommandPaletteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const debounced = useDebounce(query, 200);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const q = debounced.trim();
      if (q.length < 2) {
        setHits([]);
        return;
      }
      setLoading(true);
      const like = `%${q}%`;
      const [ativos, users, produtos] = await Promise.all([
        supabase
          .from("ativos")
          .select("id, hostname, numero_patrimonio, tipo")
          .or(`hostname.ilike.${like},numero_patrimonio.ilike.${like}`)
          .limit(6),
        supabase
          .from("usuarios")
          .select("id, nome, email, setor")
          .or(`nome.ilike.${like},email.ilike.${like}`)
          .limit(6),
        supabase
          .from("produtos_catalogo")
          .select("id, nome_oficial, categoria")
          .ilike("nome_oficial", like)
          .limit(6),
      ]);
      if (cancelled) return;
      const out: Hit[] = [];
      ativos.data?.forEach((a) =>
        out.push({
          kind: "ativo",
          id: a.id,
          label: a.hostname ?? "(sem hostname)",
          hint: [a.numero_patrimonio, a.tipo].filter(Boolean).join(" · "),
          url: "/ativos",
        }),
      );
      users.data?.forEach((u) =>
        out.push({
          kind: "usuario",
          id: u.id,
          label: u.nome ?? u.email ?? "",
          hint: u.setor ?? u.email ?? undefined,
          url: "/colaboradores",
        }),
      );
      produtos.data?.forEach((p) =>
        out.push({
          kind: "produto",
          id: p.id,
          label: p.nome_oficial,
          hint: p.categoria ?? undefined,
          url: "/produtos",
        }),
      );
      setHits(out);
      setLoading(false);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const grouped = useMemo(() => {
    return {
      ativo: hits.filter((h) => h.kind === "ativo"),
      usuario: hits.filter((h) => h.kind === "usuario"),
      produto: hits.filter((h) => h.kind === "produto"),
    };
  }, [hits]);

  function go(url: string) {
    onOpenChange(false);
    setQuery("");
    navigate({ to: url });
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Buscar ativos, colaboradores, produtos ou ir para..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {loading ? "Buscando..." : query.length < 2 ? "Digite ao menos 2 caracteres" : "Nenhum resultado"}
        </CommandEmpty>

        {grouped.ativo.length > 0 && (
          <CommandGroup heading="Ativos">
            {grouped.ativo.map((h) => (
              <CommandItem key={`a-${h.id}`} value={`ativo ${h.label} ${h.hint}`} onSelect={() => go(h.url)}>
                <Server className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{h.label}</span>
                {h.hint && <span className="ml-2 text-xs text-muted-foreground">{h.hint}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {grouped.usuario.length > 0 && (
          <CommandGroup heading="Colaboradores">
            {grouped.usuario.map((h) => (
              <CommandItem key={`u-${h.id}`} value={`usuario ${h.label} ${h.hint}`} onSelect={() => go(h.url)}>
                <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{h.label}</span>
                {h.hint && <span className="ml-2 text-xs text-muted-foreground">{h.hint}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {grouped.produto.length > 0 && (
          <CommandGroup heading="Produtos">
            {grouped.produto.map((h) => (
              <CommandItem key={`p-${h.id}`} value={`produto ${h.label} ${h.hint}`} onSelect={() => go(h.url)}>
                <Package className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{h.label}</span>
                {h.hint && <span className="ml-2 text-xs text-muted-foreground">{h.hint}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />
        <CommandGroup heading="Navegação">
          {navItems.map((n) => (
            <CommandItem key={n.url} value={`ir ${n.label}`} onSelect={() => go(n.url)}>
              <n.icon className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>{n.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

