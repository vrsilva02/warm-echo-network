import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import { Fragment } from "react";

const labelMap: Record<string, string> = {
  dashboard: "Dashboard",
  ativos: "Ativos",
  colaboradores: "Colaboradores",
  produtos: "Catálogo",
  contratos: "Contratos",
  licencas: "Licenças",
  alocacoes: "Alocações",
  reconciliacao: "Reconciliação",
  alertas: "Alertas",
  auditoria: "Auditoria",
  relatorios: "Relatórios",
  acessos: "Gestão de Acessos",
  solicitacoes: "Solicitações",
  unidades: "Unidades",
};

function humanize(seg: string) {
  return labelMap[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
}

export function Breadcrumbs() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return null;

  let acc = "";
  return (
    <nav aria-label="breadcrumb" className="flex items-center text-xs text-muted-foreground gap-1">
      <Link to="/dashboard" className="flex items-center hover:text-foreground transition-colors">
        <Home className="h-3.5 w-3.5" />
      </Link>
      {parts.map((seg, i) => {
        acc += "/" + seg;
        const last = i === parts.length - 1;
        const isId = /^[0-9a-f-]{8,}$/i.test(seg);
        const text = isId ? seg.slice(0, 8) + "…" : humanize(decodeURIComponent(seg));
        return (
          <Fragment key={acc}>
            <ChevronRight className="h-3 w-3 opacity-50" />
            {last ? (
              <span className="text-foreground font-medium">{text}</span>
            ) : (
              <Link
                to={acc}
                className="hover:text-foreground transition-colors"
              >
                {text}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
