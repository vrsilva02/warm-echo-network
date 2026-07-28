import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
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
            <CardTitle>Acesso ao sistema</CardTitle>
            <CardDescription>
              Use suas credenciais corporativas para acessar o GestoraIT.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pw">Senha</Label>
                <Input id="pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
              </Button>
            </form>
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
