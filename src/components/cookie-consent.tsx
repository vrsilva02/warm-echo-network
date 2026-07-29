import { lazy, Suspense, useEffect, useState } from "react";
import { X } from "lucide-react";
import { loadPreferences, resetPreferences, getConsent } from "@/lib/cookie-consent";

/**
 * Portão leve do consentimento de cookies: só baixa a UI da barra (dialog,
 * switches, textos) quando o visitante ainda não registrou uma escolha.
 * Usuários recorrentes não pagam esse custo no carregamento inicial.
 */

const CookieConsentBanner = lazy(() => import("@/components/cookie-consent-banner"));

export function CookieConsent() {
  const [needsConsent, setNeedsConsent] = useState(false);

  useEffect(() => {
    setNeedsConsent(loadPreferences() === null);
  }, []);

  if (!needsConsent) return null;

  return (
    <Suspense fallback={null}>
      <CookieConsentBanner onDone={() => setNeedsConsent(false)} />
    </Suspense>
  );
}

/** Botão para reabrir a barra (usar no rodapé ou página de privacidade). */
export function ReopenConsentButton() {
  return (
    <button
      type="button"
      onClick={() => {
        resetPreferences();
        window.location.reload();
      }}
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
    >
      <X className="h-3 w-3" />
      Redefinir preferências de cookies
    </button>
  );
}

export { getConsent };
