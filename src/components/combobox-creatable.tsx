import * as React from "react";
import { Check, ChevronsUpDown, Plus, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ComboboxOption } from "@/components/combobox";

type Props = {
  options: ComboboxOption[];
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  /** Habilita a criação de novas opções (apenas Admin/Gestão). */
  allowCreate?: boolean;
  /** Deve persistir a nova opção e devolver o nome canônico gravado. */
  onCreate?: (nome: string) => Promise<string>;
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  createLabel?: (termo: string) => string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
};

/**
 * Combobox com busca que permite criar uma nova opção quando o termo digitado
 * não existe na lista. A criação é delegada ao `onCreate`.
 */
export function ComboboxCreatable({
  options,
  value,
  onChange,
  allowCreate = false,
  onCreate,
  placeholder = "Selecionar…",
  emptyText = "Nada encontrado.",
  searchPlaceholder = "Buscar…",
  createLabel = (t) => `Criar "${t}"`,
  disabled,
  clearable = true,
  className,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const selected = options.find((o) => o.value === value) ?? null;

  const termo = query.trim();
  const jaExiste = options.some((o) => o.label.toLowerCase() === termo.toLowerCase());
  const podeCriar = allowCreate && !!onCreate && termo.length > 0 && !jaExiste;

  async function criar() {
    if (!onCreate || !termo || creating) return;
    setCreating(true);
    try {
      const nome = await onCreate(termo);
      onChange(nome);
      setQuery("");
      setOpen(false);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground", className)}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <div className="flex items-center gap-1">
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
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[240px]" align="start">
        <Command shouldFilter>
          <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
          <CommandList>
            {!podeCriar && <CommandEmpty>{emptyText}</CommandEmpty>}
            {podeCriar && (
              <CommandGroup>
                <CommandItem value={`__criar__${termo}`} onSelect={() => void criar()}>
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  <span className="truncate">{createLabel(termo)}</span>
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={`${opt.label} ${opt.hint ?? ""}`}
                  onSelect={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("h-4 w-4", opt.value === value ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{opt.label}</span>
                    {opt.hint && <span className="text-xs text-muted-foreground truncate">{opt.hint}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
