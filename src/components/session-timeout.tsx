import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const IDLE_MS = 30 * 60 * 1000; // 30 min
const WARN_MS = 60 * 1000; // 1 min antes

/**
 * Monitora inatividade do usuário e desloga após 30 min sem interação.
 * Exibe um modal 1 min antes com a opção de estender a sessão.
 */
export function SessionTimeout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [warnOpen, setWarnOpen] = useState(false);
  const [remaining, setRemaining] = useState(WARN_MS);
  const warnTimer = useRef<number | null>(null);
  const logoutTimer = useRef<number | null>(null);
  const tick = useRef<number | null>(null);

  function clearAll() {
    if (warnTimer.current) window.clearTimeout(warnTimer.current);
    if (logoutTimer.current) window.clearTimeout(logoutTimer.current);
    if (tick.current) window.clearInterval(tick.current);
    warnTimer.current = null;
    logoutTimer.current = null;
    tick.current = null;
  }

  async function forceLogout() {
    clearAll();
    setWarnOpen(false);
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.info("Sessão encerrada por inatividade.");
    navigate({ to: "/auth", replace: true });
  }

  function schedule() {
    clearAll();
    setWarnOpen(false);
    warnTimer.current = window.setTimeout(() => {
      setRemaining(WARN_MS);
      setWarnOpen(true);
      tick.current = window.setInterval(() => {
        setRemaining((r) => Math.max(0, r - 1000));
      }, 1000);
      logoutTimer.current = window.setTimeout(forceLogout, WARN_MS);
    }, IDLE_MS - WARN_MS);
  }

  function reset() {
    if (warnOpen) return; // enquanto o modal está aberto, só o botão estende
    schedule();
  }

  useEffect(() => {
    schedule();
    const events: (keyof WindowEventMap)[] = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true } as any));
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset as any));
      clearAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seconds = Math.ceil(remaining / 1000);

  return (
    <AlertDialog open={warnOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Sua sessão vai expirar
          </AlertDialogTitle>
          <AlertDialogDescription>
            Por segurança, você será desconectado em{" "}
            <span className="font-mono font-semibold text-foreground">{seconds}s</span>{" "}
            devido à inatividade. Deseja continuar conectado?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={forceLogout}>Sair agora</AlertDialogCancel>
          <AlertDialogAction onClick={schedule}>Continuar conectado</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
