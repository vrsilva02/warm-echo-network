import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Cookie, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { savePreferences, type Preferences } from "@/lib/cookie-consent";

export default function CookieConsentBanner({ onDone }: { onDone: () => void }) {
  const [show, setShow] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  function accept(all: boolean) {
    const prefs: Preferences = {
      essential: true,
      analytics: all ? true : analytics,
      timestamp: new Date().toISOString(),
      version: 1,
    };
    savePreferences(prefs);
    setAnalytics(prefs.analytics);
    setShow(false);
    setDetailsOpen(false);
    onDone();
  }

  function rejectAll() {
    const prefs: Preferences = {
      essential: true,
      analytics: false,
      timestamp: new Date().toISOString(),
      version: 1,
    };
    savePreferences(prefs);
    setAnalytics(false);
    setShow(false);
    setDetailsOpen(false);
    onDone();
  }

  if (!show) return null;

  return (
    <>
      <div
        role="dialog"
        aria-live="polite"
        aria-label="Consentimento de cookies"
        className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-3 sm:px-6 sm:pb-6 animate-in slide-in-from-bottom-4 duration-500"
      >
        <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-border bg-card/95 shadow-xl backdrop-blur-xl">
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:gap-5 sm:p-6">
            <div className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Cookie className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <Cookie className="h-4 w-4 text-primary sm:hidden" />
                <h2 className="text-sm font-semibold text-foreground">
                  Este site usa cookies
                </h2>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Utilizamos cookies essenciais para manter sua sessão autenticada e
                garantir a segurança do GestoraIT. Cookies opcionais nos ajudam a
                entender o uso da plataforma. Nos termos da{" "}
                <strong className="text-foreground">LGPD (Lei 13.709/2018)</strong>,
                você decide o que aceitar.{" "}
                <Link to="/privacidade" className="text-primary underline underline-offset-2 hover:opacity-80">
                  Política de Privacidade
                </Link>
                .
              </p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:self-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDetailsOpen(true)}
                className="text-muted-foreground hover:text-foreground"
              >
                Personalizar
              </Button>
              <Button variant="outline" size="sm" onClick={rejectAll}>
                Rejeitar opcionais
              </Button>
              <Button size="sm" onClick={() => accept(true)} className="shadow-sm">
                <ShieldCheck className="h-4 w-4" />
                Aceitar todos
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cookie className="h-4 w-4 text-primary" />
              Preferências de cookies
            </DialogTitle>
            <DialogDescription>
              Controle quais categorias de dados podem ser coletadas nesta sessão.
              Nós tratamos seus dados conforme a LGPD.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/40 p-4">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Essenciais</Label>
                <p className="text-xs text-muted-foreground">
                  Autenticação, sessão, CSRF e preferências de idioma. Base legal:
                  execução de contrato e legítimo interesse.
                </p>
              </div>
              <Switch checked disabled aria-label="Cookies essenciais sempre ativos" />
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
              <div className="space-y-1">
                <Label htmlFor="analytics" className="text-sm font-medium">
                  Analíticos
                </Label>
                <p className="text-xs text-muted-foreground">
                  Métricas agregadas de uso (páginas visitadas, tempo de sessão) sem
                  identificação pessoal. Base legal: consentimento.
                </p>
              </div>
              <Switch
                id="analytics"
                checked={analytics}
                onCheckedChange={setAnalytics}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={rejectAll}>
              Rejeitar opcionais
            </Button>
            <Button onClick={() => accept(false)}>Salvar preferências</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

