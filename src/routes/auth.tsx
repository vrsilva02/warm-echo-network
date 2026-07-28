import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ArrowLeft } from "lucide-react";
import mtrLogo from "@/assets/mtr2-tech-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Entrar — GestoraIT" },
      { name: "description", content: "Acesso ao sistema de gestão de ativos e licenças." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function AuthPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (session) return <Navigate to="/dashboard" replace />;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo");
    navigate({ to: "/dashboard" });
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return toast.error("Informe seu e-mail.");
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Se o e-mail existir, enviaremos as instruções em instantes.");
    setMode("login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-2 justify-center">
          <div className="rounded-md bg-primary p-2 text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">GestoraIT</h1>
            <p className="text-xs text-muted-foreground">Gestão de Ativos e Licenças</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{mode === "login" ? "Acesso ao sistema" : "Recuperar senha"}</CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Use suas credenciais corporativas para acessar o GestoraIT."
                : "Informe o e-mail cadastrado para receber o link de redefinição."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mode === "login" ? (
              <form onSubmit={handleLogin} className="space-y-3">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="pw">Senha</Label>
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-xs text-primary hover:underline"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <Input id="pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleForgot} className="space-y-3">
                <div>
                  <Label htmlFor="email-forgot">Email</Label>
                  <Input
                    id="email-forgot"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar link de redefinição"}
                </Button>
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="flex items-center justify-center gap-1 w-full text-xs text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-3 w-3" /> Voltar ao login
                </button>
              </form>
            )}
          </CardContent>
        </Card>
        <div className="mt-6 flex flex-col items-center gap-1 opacity-70">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Powered by</span>
          <img src={mtrLogo.url} alt="MTR2.TECH" className="h-6 w-auto invert dark:invert-0" />
        </div>
      </div>
    </div>
  );
}
