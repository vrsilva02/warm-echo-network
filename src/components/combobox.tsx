import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

export type ComboboxOption = {
  value: string;
  label: string;
  hint?: string;
};

type Props = {
  options: ComboboxOption[];
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
};

const ITEM_HEIGHT = 36; // px — altura fixa de cada item da lista
const LIST_MAX_HEIGHT = 300; // px — altura máxima da lista antes de virtualizar

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Selecionar…",
  emptyText = "Nada encontrado.",
  searchPlaceholder = "Buscar…",
  disabled,
  clearable = true,
  className,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const parentRef = React.useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  // Filtragem local por label e hint — case-insensitive, sem acentuação
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase().normalize("NFD").replace(/\p{Mn}/gu, "");
    if (!q) return options;
    return options.filter((o) => {
      const label = o.label.toLowerCase().normalize("NFD").replace(/\p{Mn}/gu, "");
      const hint = (o.hint ?? "").toLowerCase().normalize("NFD").replace(/\p{Mn}/gu, "");
      return label.includes(q) || hint.includes(q);
    });
  }, [options, search]);

  const listHeight = Math.min(filtered.length * ITEM_HEIGHT, LIST_MAX_HEIGHT);

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 8,
  });

  // Limpa busca ao fechar
  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) setSearch("");
  }

  function handleSelect(opt: ComboboxOption) {
    onChange(opt.value);
    setOpen(false);
    setSearch("");
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <div className="flex items-center gap-1 shrink-0">
            {clearable && selected && !disabled && (
              <X
                className="h-4 w-4 opacity-60 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="p-0 w-[--radix-popover-trigger-width] min-w-[240px]"
        align="start"
      >
        {/* Campo de busca local — não depende do cmdk */}
        <div className="flex items-center border-b px-3 py-2">
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-7 border-0 shadow-none focus-visible:ring-0 p-0 text-sm"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          /* Container de scroll com altura fixa — virtualizer renderiza só o que cabe */
          <div
            ref={parentRef}
            style={{ height: listHeight, overflowY: "auto" }}
          >
            <div
              style={{
                height: rowVirtualizer.getTotalSize(),
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                const opt = filtered[virtualItem.index];
                const isSelected = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    style={{
                      position: "absolute",
                      top: virtualItem.start,
                      left: 0,
                      width: "100%",
                      height: ITEM_HEIGHT,
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 cursor-pointer text-sm select-none",
                      "hover:bg-accent hover:text-accent-foreground",
                      isSelected && "bg-accent/60",
                    )}
                    onClick={() => handleSelect(opt)}
                  >
                    <Check
                      className={cn("h-4 w-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")}
                    />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="truncate">{opt.label}</span>
                      {opt.hint && (
                        <span className="text-xs text-muted-foreground truncate">{opt.hint}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Contador de resultados */}
        {filtered.length > 0 && (
          <div className="border-t px-3 py-1.5 text-[11px] text-muted-foreground text-right">
            {filtered.length === options.length
              ? `${options.length} item${options.length !== 1 ? "s" : ""}`
              : `${filtered.length} de ${options.length}`}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
