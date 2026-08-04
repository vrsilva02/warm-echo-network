import { createFileRoute, Navigate, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ArrowLeft, Eye, EyeOff } from "lucide-react";
import mtrLogo from "@/assets/mtr2-tech-logo.png.asset.json";
import { emailSchema, passwordSchema } from "@/lib/sanitize";

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
  const [showPassword, setShowPassword] = useState(false);

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
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) return toast.error(parsedEmail.error.issues[0]?.message ?? "E-mail inválido");
    const parsedPw = passwordSchema.safeParse(password);
    if (!parsedPw.success) return toast.error(parsedPw.error.issues[0]?.message ?? "Senha inválida");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: parsedEmail.data,
      password: parsedPw.data,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo");
    navigate({ to: "/dashboard" });
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) return toast.error(parsedEmail.error.issues[0]?.message ?? "E-mail inválido");
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsedEmail.data, {
      redirectTo: `https://gestorait.mtr2tech.com.br/auth/callback?next=/reset-password`,
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
                  <div className="relative">
                    <Input
                      id="pw"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
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
        <div className="mt-6 flex flex-col items-center gap-2 opacity-80">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Powered by</span>
          <img src={mtrLogo.url} alt="MTR2.TECH" width={120} height={24} loading="lazy" decoding="async" className="h-6 w-auto invert dark:invert-0" />
          <Link
            to="/privacidade"
            className="mt-2 text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Política de Privacidade · LGPD
          </Link>
        </div>
      </div>
    </div>
  );
}
