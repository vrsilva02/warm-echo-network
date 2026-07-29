import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";

/**
 * Casca leve da paleta de comandos (Ctrl/⌘+K).
 *
 * Apenas o atalho de teclado e o botão do cabeçalho ficam no bundle inicial;
 * o diálogo real (cmdk + consultas ao backend) só é baixado no primeiro uso.
 */

const CommandPaletteDialog = lazy(() => import("@/components/command-palette-dialog"));

const OPEN_EVENT = "gestorait:open-command-palette";

export function CommandPalette() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  const openPalette = useCallback(() => {
    setMounted(true);
    setOpen(true);
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setMounted(true);
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", down);
    window.addEventListener(OPEN_EVENT, openPalette);
    return () => {
      document.removeEventListener("keydown", down);
      window.removeEventListener(OPEN_EVENT, openPalette);
    };
  }, [openPalette]);

  if (!mounted) return null;

  return (
    <Suspense fallback={null}>
      <CommandPaletteDialog open={open} onOpenChange={setOpen} />
    </Suspense>
  );
}

export function CommandPaletteTrigger() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      className="hidden md:inline-flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
    >
      <Search className="h-3.5 w-3.5" />
      <span>Buscar</span>
      <kbd className="ml-2 rounded bg-background border px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd>
    </button>
  );
}
