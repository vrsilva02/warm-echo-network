import * as React from "react";
import { Eye, EyeOff, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logAction } from "@/lib/audit";
import { toast } from "sonner";

/**
 * Mascara uma chave de licença e permite revelá-la por poucos segundos.
 * Toda revelação é registrada no log de auditoria (ação VIEW).
 */
export function maskKey(key: string | null | undefined): string {
  if (!key) return "—";
  const clean = key.trim();
  if (clean.length <= 4) return "•".repeat(clean.length);
  // Mostra primeiros 4 e mascara o restante em blocos de 4 separados por hífen.
  const head = clean.slice(0, 4);
  const rest = clean.slice(4);
  const chunks = Math.ceil(rest.length / 4);
  const masked = Array.from({ length: chunks }, () => "****").join("-");
  return `${head}-${masked}`;
}

export type MaskedKeyContext = {
  /** onde a chave está armazenada — usado para o log */
  tabela: "licencas" | "alocacoes";
  /** id do registro que guarda a chave */
  registroId: string;
  /** metadados extras: alocacao_id, ativo_id, licenca_id, produto, etc. */
  metadata?: Record<string, unknown>;
};

export function MaskedKey({
  value,
  context,
  revealSeconds = 8,
  className,
}: {
  value: string | null | undefined;
  context: MaskedKeyContext;
  revealSeconds?: number;
  className?: string;
}) {
  const [revealed, setRevealed] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const timerRef = React.useRef<number | null>(null);

  React.useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  if (!value) {
    return <span className={"text-muted-foreground text-xs " + (className ?? "")}>—</span>;
  }

  async function reveal() {
    setRevealed(true);
    void logAction("VIEW", context.tabela, {
      operacao: "revelar_chave",
      ...(context.metadata ?? {}),
    }, context.registroId);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setRevealed(false), revealSeconds * 1000);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(value!);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
      void logAction("VIEW", context.tabela, {
        operacao: "copiar_chave",
        ...(context.metadata ?? {}),
      }, context.registroId);
      toast.success("Chave copiada");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <span className={"inline-flex items-center gap-1 " + (className ?? "")}>
      <span className="font-mono text-xs tabular-nums select-all">
        {revealed ? value : maskKey(value)}
      </span>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-6 w-6"
        title={revealed ? "Ocultar chave" : "Revelar chave (registrado em auditoria)"}
        onClick={(e) => { e.stopPropagation(); revealed ? setRevealed(false) : void reveal(); }}
      >
        {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </Button>
      {revealed && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          title="Copiar chave"
          onClick={(e) => { e.stopPropagation(); void copy(); }}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      )}
    </span>
  );
}
