import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuCheckboxItem, DropdownMenuSeparator, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Columns3, Download, ArrowUp, ArrowDown, ArrowUpDown, X, ChevronUp, ChevronDown } from "lucide-react";
import { TableSkeleton } from "@/components/skeletons";
import { exportXLSXInBackground } from "@/lib/export";
import { logAction } from "@/lib/audit";

export type Column<T> = {
  id: string;
  header: string;
  accessor: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | null | undefined;
  searchValue?: (row: T) => string | null | undefined;
  exportValue?: (row: T) => string | number | null | undefined;
  numeric?: boolean;
  className?: string;
  defaultHidden?: boolean;
  alwaysVisible?: boolean; // e.g. Actions column
};

export type SavedView<T> = {
  id: string;
  label: string;
  filter: (rows: T[]) => T[];
  tone?: "default" | "warn" | "critical" | "ok";
};

type Props<T> = {
  storageKey: string;
  rows: T[] | undefined;
  isLoading?: boolean;
  columns: Column<T>[];
  getRowId: (row: T) => string;
  searchable?: boolean;
  searchPlaceholder?: string;
  savedViews?: SavedView<T>[];
  bulkActions?: (selected: T[], clear: () => void) => ReactNode;
  emptyState?: ReactNode;
  exportFilename?: string;
  toolbarExtras?: ReactNode;
  rowClassName?: (row: T) => string | undefined;
};

type Prefs = {
  hidden: string[];
  order: string[];
  view: string | null;
  sort: { id: string; dir: "asc" | "desc" } | null;
};

function loadPrefs(key: string): Prefs {
  try {
    const raw = localStorage.getItem(`tbl:${key}`);
    if (raw) return JSON.parse(raw) as Prefs;
  } catch {}
  return { hidden: [], order: [], view: null, sort: null };
}
function savePrefs(key: string, p: Prefs) {
  try { localStorage.setItem(`tbl:${key}`, JSON.stringify(p)); } catch {}
}

export function AdvancedTable<T>({
  storageKey, rows, isLoading, columns, getRowId,
  searchable = true, searchPlaceholder = "Buscar…",
  savedViews, bulkActions, emptyState, exportFilename, toolbarExtras, rowClassName,
}: Props<T>) {
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs(storageKey));
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => { savePrefs(storageKey, prefs); }, [storageKey, prefs]);

  const orderedColumns = useMemo(() => {
    const byId = new Map(columns.map((c) => [c.id, c]));
    const known = prefs.order.filter((id) => byId.has(id));
    const rest = columns.map((c) => c.id).filter((id) => !known.includes(id));
    return [...known, ...rest].map((id) => byId.get(id)!).filter(Boolean);
  }, [columns, prefs.order]);

  const visibleColumns = useMemo(
    () => orderedColumns.filter((c) => c.alwaysVisible || !prefs.hidden.includes(c.id)),
    [orderedColumns, prefs.hidden],
  );

  const activeView = savedViews?.find((v) => v.id === prefs.view) ?? null;

  const processed = useMemo(() => {
    let list = rows ?? [];
    if (activeView) list = activeView.filter(list);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((r) =>
        columns.some((c) => {
          const v = c.searchValue?.(r);
          return v != null && String(v).toLowerCase().includes(q);
        }),
      );
    }
    if (prefs.sort) {
      const col = columns.find((c) => c.id === prefs.sort!.id);
      if (col?.sortValue) {
        const dir = prefs.sort.dir === "asc" ? 1 : -1;
        list = [...list].sort((a, b) => {
          const va = col.sortValue!(a), vb = col.sortValue!(b);
          if (va == null && vb == null) return 0;
          if (va == null) return 1;
          if (vb == null) return -1;
          if (va < vb) return -1 * dir;
          if (va > vb) return 1 * dir;
          return 0;
        });
      }
    }
    return list;
  }, [rows, columns, query, prefs.sort, activeView]);

  const allSelected = processed.length > 0 && processed.every((r) => selected.has(getRowId(r)));
  const someSelected = processed.some((r) => selected.has(getRowId(r)));
  const selectedRows = useMemo(() => (rows ?? []).filter((r) => selected.has(getRowId(r))), [rows, selected, getRowId]);

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) processed.forEach((r) => next.delete(getRowId(r)));
      else processed.forEach((r) => next.add(getRowId(r)));
      return next;
    });
  }
  function toggleRow(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function clearSelection() { setSelected(new Set()); }

  function toggleHidden(id: string) {
    setPrefs((p) => ({ ...p, hidden: p.hidden.includes(id) ? p.hidden.filter((x) => x !== id) : [...p.hidden, id] }));
  }
  function moveColumn(id: string, dir: -1 | 1) {
    setPrefs((p) => {
      const current = orderedColumns.map((c) => c.id);
      const i = current.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= current.length) return p;
      const next = [...current];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...p, order: next };
    });
  }
  function resetLayout() {
    setPrefs((p) => ({ ...p, hidden: [], order: [] }));
  }
  function toggleSort(id: string) {
    setPrefs((p) => {
      const cur = p.sort;
      if (!cur || cur.id !== id) return { ...p, sort: { id, dir: "asc" } };
      if (cur.dir === "asc") return { ...p, sort: { id, dir: "desc" } };
      return { ...p, sort: null };
    });
  }
  function pickView(id: string | null) {
    setPrefs((p) => ({ ...p, view: id }));
    clearSelection();
  }

  function exportVisible() {
    const cols = visibleColumns.filter((c) => !c.alwaysVisible);
    const header = cols.map((c) => c.header);
    const body = processed.map((r) => cols.map((c) => {
      const v = c.exportValue ? c.exportValue(r) : c.searchValue ? c.searchValue(r) : "";
      return v ?? "";
    }));
    exportXLSXInBackground({
      label: `Exportação · ${exportFilename ?? storageKey}`,
      filename: `${exportFilename ?? storageKey}-${new Date().toISOString().slice(0, 10)}.xlsx`,
      load: async () => ({ columns: header, rows: body }),
    });
    void logAction("EXPORT", storageKey, {
      formato: "xlsx",
      total_registros: processed.length,
      total_original: rows?.length ?? 0,
      filtro_view: activeView?.id ?? null,
      busca: query || null,
      ordenacao: prefs.sort,
      colunas: cols.map((c) => c.id),
    });
  }

  const showBulk = bulkActions && selected.size > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {searchable && (
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
              <Input placeholder={searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" aria-label={searchPlaceholder} />
            </div>
          )}
          {savedViews && savedViews.length > 0 && (
            <div className="flex flex-wrap gap-1" role="tablist" aria-label="Visualizações salvas">
              <Button size="sm" variant={activeView ? "outline" : "secondary"} onClick={() => pickView(null)} role="tab" aria-selected={!activeView}>Todos</Button>
              {savedViews.map((v) => (
                <Button
                  key={v.id}
                  size="sm"
                  variant={activeView?.id === v.id ? "secondary" : "outline"}
                  onClick={() => pickView(v.id)}
                  className="gap-1"
                  role="tab"
                  aria-selected={activeView?.id === v.id}
                >
                  {v.label}
                </Button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {toolbarExtras}
          <Button size="sm" variant="outline" onClick={exportVisible} className="gap-1">
            <Download className="h-4 w-4" /> XLSX
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1"><Columns3 className="h-4 w-4" /> Colunas</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Mostrar / reordenar</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {orderedColumns.filter((c) => !c.alwaysVisible).map((c) => (
                <div key={c.id} className="flex items-center justify-between px-2 py-1 text-sm">
                  <DropdownMenuCheckboxItem
                    className="flex-1"
                    checked={!prefs.hidden.includes(c.id)}
                    onCheckedChange={() => toggleHidden(c.id)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {c.header}
                  </DropdownMenuCheckboxItem>
                  <div className="flex">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.preventDefault(); moveColumn(c.id, -1); }}><ChevronUp className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.preventDefault(); moveColumn(c.id, 1); }}><ChevronDown className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={resetLayout}>Restaurar padrão</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {showBulk && (
        <div className="flex items-center gap-2 rounded-md border bg-secondary/40 px-3 py-2">
          <Badge variant="secondary" className="gap-1">
            {selected.size} selecionado{selected.size > 1 ? "s" : ""}
          </Badge>
          <div className="flex-1 flex gap-2">{bulkActions!(selectedRows, clearSelection)}</div>
          <Button size="sm" variant="ghost" onClick={clearSelection} className="gap-1"><X className="h-4 w-4" /> Limpar</Button>
        </div>
      )}

      <div className="rounded-md border overflow-x-auto bg-card">
        {isLoading ? (
          <div className="p-4"><TableSkeleton rows={6} cols={visibleColumns.length} /></div>
        ) : processed.length === 0 ? (
          <div className="p-6 text-center">
            {emptyState ?? <div className="text-sm text-muted-foreground">Nenhum registro.</div>}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {bulkActions && (
                  <TableHead className="w-10">
                    <Checkbox checked={allSelected ? true : someSelected ? "indeterminate" : false} onCheckedChange={toggleAll} aria-label="Selecionar tudo" />
                  </TableHead>
                )}
                {visibleColumns.map((c) => {
                  const sortState = prefs.sort?.id === c.id ? prefs.sort.dir : null;
                  const sortable = !!c.sortValue;
                  const ariaSort = sortState === "asc" ? "ascending" : sortState === "desc" ? "descending" : sortable ? "none" : undefined;
                  return (
                    <TableHead key={c.id} className={c.numeric ? "text-right" : undefined} aria-sort={ariaSort}>
                      {sortable ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-sm px-1 -mx-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => toggleSort(c.id)}
                          aria-label={`Ordenar por ${c.header}${sortState === "asc" ? " (crescente)" : sortState === "desc" ? " (decrescente)" : ""}`}
                        >
                          {c.header}
                          {sortState === "asc" ? <ArrowUp className="h-3 w-3" aria-hidden /> : sortState === "desc" ? <ArrowDown className="h-3 w-3" aria-hidden /> : <ArrowUpDown className="h-3 w-3 opacity-40" aria-hidden />}
                        </button>
                      ) : c.header}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {processed.map((r) => {
                const id = getRowId(r);
                const isSelected = selected.has(id);
                return (
                  <TableRow key={id} data-state={isSelected ? "selected" : undefined} className={rowClassName?.(r)}>
                    {bulkActions && (
                      <TableCell className="w-10">
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleRow(id)} aria-label="Selecionar linha" />
                      </TableCell>
                    )}
                    {visibleColumns.map((c) => (
                      <TableCell key={c.id} className={[c.numeric ? "text-right num" : "", c.className ?? ""].join(" ")}>
                        {c.accessor(r)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        {isLoading ? "Carregando…" : `${processed.length} de ${rows?.length ?? 0} registro(s)`}
        {activeView && <> · filtro <strong>{activeView.label}</strong></>}
      </div>
    </div>
  );
}
