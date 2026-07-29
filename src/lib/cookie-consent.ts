/**
 * Estado de consentimento de cookies (LGPD) — módulo leve, sem UI,
 * para que a barra de consentimento possa ser carregada sob demanda.
 */

export const COOKIE_CONSENT_STORAGE_KEY = "gestorait.cookie-consent.v1";

export type Preferences = {
  essential: true; // sempre ativo — base legal: legítimo interesse (LGPD art. 7º, IX)
  analytics: boolean;
  timestamp: string;
  version: 1;
};

export function loadPreferences(): Preferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Preferences;
    if (parsed?.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePreferences(prefs: Preferences) {
  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(prefs));
  window.dispatchEvent(new CustomEvent("cookie-consent-changed", { detail: prefs }));
}

export function resetPreferences() {
  window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
}

export function getConsent(): Preferences | null {
  return loadPreferences();
}
