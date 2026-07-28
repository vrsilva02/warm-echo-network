import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type PasswordRules = {
  minLength: boolean;
  hasNumber: boolean;
  hasUpper: boolean;
};

export function evaluatePassword(pw: string): {
  score: 0 | 1 | 2 | 3;
  label: "vazia" | "fraca" | "média" | "forte";
  rules: PasswordRules;
  valid: boolean;
} {
  const rules: PasswordRules = {
    minLength: pw.length >= 8,
    hasNumber: /\d/.test(pw),
    hasUpper: /[A-Z]/.test(pw),
  };
  const base = Object.values(rules).filter(Boolean).length as 0 | 1 | 2 | 3;
  const bonus = pw.length >= 12 && /[^A-Za-z0-9]/.test(pw);
  const score = (bonus ? 3 : base) as 0 | 1 | 2 | 3;
  const label = pw.length === 0 ? "vazia" : score <= 1 ? "fraca" : score === 2 ? "média" : "forte";
  const valid = rules.minLength && rules.hasNumber && rules.hasUpper;
  return { score, label, rules, valid };
}

export function PasswordStrength({ password }: { password: string }) {
  const { score, label, rules } = evaluatePassword(password);
  const colors = ["bg-muted", "bg-destructive", "bg-amber-500", "bg-emerald-500"] as const;
  const textColors = ["text-muted-foreground", "text-destructive", "text-amber-600", "text-emerald-600"] as const;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i < score ? colors[score] : "bg-muted",
            )}
          />
        ))}
      </div>
      <div className={cn("text-xs font-medium capitalize", textColors[score])}>
        Força: {label}
      </div>
      <ul className="space-y-1 text-xs text-muted-foreground">
        <Rule ok={rules.minLength} text="Mínimo 8 caracteres" />
        <Rule ok={rules.hasNumber} text="Pelo menos 1 número" />
        <Rule ok={rules.hasUpper} text="Pelo menos 1 letra maiúscula" />
      </ul>
    </div>
  );
}

function Rule({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className={cn("flex items-center gap-1.5", ok && "text-emerald-600")}>
      {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 text-muted-foreground" />}
      {text}
    </li>
  );
}
