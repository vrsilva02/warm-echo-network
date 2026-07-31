import { useEffect, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function useFilteredList<T>(rows: T[] | undefined, query: string, keys: (keyof T)[]) {
  const q = query.trim().toLowerCase();
  if (!q) return rows ?? [];
  return (rows ?? []).filter((r) =>
    keys.some((k) => {
      const v = r[k];
      return typeof v === "string" && v.toLowerCase().includes(q);
    }),
  );
}

export function ListToolbar({ query, onQueryChange, actions }: {
  query: string;
  onQueryChange: (v: string) => void;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div className="relative w-full sm:w-72">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="pl-8"
        />
      </div>
      <div className="flex gap-2">{actions}</div>
    </div>
  );
}

export function DataTable({ columns, rows, empty, pageSize: initialPageSize = 50 }: { columns: string[]; rows: ReactNode[][]; empty?: string; pageSize?: number }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => { setPage(1); }, [rows.length, pageSize]);

  return (
    <div className="space-y-2">
      <div className="rounded-md border overflow-x-auto bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c}>{c}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-muted-foreground text-sm py-6">
                  {empty ?? "Nenhum registro."}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((cells, i) => (
                <TableRow key={(currentPage - 1) * pageSize + i}>
                  {cells.map((c, j) => (
                    <TableCell key={j}>{c}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {rows.length > pageSize && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, rows.length)} de {rows.length} registro(s)
          </div>
          <div className="flex items-center gap-2">
            <select
              className="h-8 rounded-md border bg-background px-2 text-xs"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Registros por página"
            >
              {[25, 50, 100, 200, 500].map((n) => (
                <option key={n} value={n}>{n} / página</option>
              ))}
            </select>
            <Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Anterior</Button>
            <span className="text-xs text-muted-foreground whitespace-nowrap">{currentPage} / {totalPages}</span>
            <Button size="sm" variant="outline" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Próxima</Button>
          </div>
        </div>
      )}
    </div>
  );
}


export function useSearchState() {
  return useState("");
}
