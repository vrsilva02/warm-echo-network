import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getConviteByToken, finalizarCadastro } from "@/lib/invitation-flow.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({
  token: z.string().uuid().optional(),
});

export const Route = createFileRoute("/auth/concluir")({
  validateSearch: (s) => searchSchema.parse(s),
  component: ConcluirCadastroPage,
});

function ConcluirCadastroPage() {
  const { token: searchToken } = Route.useSearch();
  const navigate = useNavigate();
  const getConvite = useServerFn(getConviteByToken);
  const finish = useServerFn(finalizarCadastro);

  const [token, setToken] = useState<string | undefined>(searchToken);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // 1. Tenta extrair token do hash ou da URL se não estiver no search
    if (!token) {
      const hashParams = new URLSearchParams(window.location.hash.replace("#", "?"));
      const hashToken = hashParams.get("token");
      if (hashToken && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(hashToken)) {
        console.log("[ConcluirCadastroPage] Token encontrado no hash:", hashToken);
        setToken(hashToken);
      } else {
        const urlParams = new URLSearchParams(window.location.search);
        const urlToken = urlParams.get("token");
        if (urlToken && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(urlToken)) {
           console.log("[ConcluirCadastroPage] Token encontrado via URLSearchParams:", urlToken);
           setToken(urlToken);
        }
      }
    }

    // 2. Garante que o usuário está deslogado para não ter conflitos de sessão durante a definição de senha
    // No entanto, o convite do Supabase pode logar o usuário automaticamente. 
    // Se o convite for validado pelo token manual, não precisamos da sessão do Supabase ativa ainda.
  }, [token]);

  const { data: convite, isLoading, error } = useQuery({
    queryKey: ["convite", token],
    queryFn: async () => {
      console.log("[ConcluirCadastroPage] Buscando convite para o token:", token);
      const res = await getConvite({ data: token! });
      console.log("[ConcluirCadastroPage] Resposta do convite:", res);
      return res;
    },
    enabled: !!token,
    retry: false,
  });

  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (!pass) return 0;
    if (pass.length >= 8) score += 25;
    if (/[A-Z]/.test(pass)) score += 25;
    if (/[0-9]/.test(pass)) score += 25;
    if (/[^A-Za-z0-9]/.test(pass)) score += 25;
    return score;
  };

  const strength = getPasswordStrength(password);
  const strengthColor = strength < 50 ? "bg-destructive" : strength < 75 ? "bg-warning" : "bg-success";

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return toast.error("As senhas não coincidem.");
    }
    if (strength < 50) {
      return toast.error("A senha é muito fraca.");
    }

    setSubmitting(true);
    try {
      await finish({ data: { token: token!, password } });
      setSuccess(true);
      toast.success("Cadastro concluído com sucesso!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao concluir cadastro");
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle /> Erro
            </CardTitle>
            <CardDescription>Token de convite não fornecido.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button className="w-full" onClick={() => navigate({ to: "/auth" })}>Voltar ao Login</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || (convite && !convite.valid)) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle /> Convite Inválido
            </CardTitle>
            <CardDescription>{convite?.error || "Não foi possível validar seu convite."}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button className="w-full" onClick={() => navigate({ to: "/auth" })}>Solicitar novo convite</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <CardTitle>Bem-vindo ao GestoraIT!</CardTitle>
            <CardDescription>
              Cadastro concluído com sucesso. Sua conta foi ativada e já pode ser utilizada.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button className="w-full" onClick={() => navigate({ to: "/auth" })}>Fazer Login</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-slate-50 dark:bg-zinc-950">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <span className="text-2xl font-bold text-primary">GestoraIT</span>
          </div>
          <CardTitle className="text-xl">Bem-vindo!</CardTitle>
          <CardDescription>Defina sua senha de acesso para concluir seu cadastro no sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleFinish} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Input
                  id="email"
                  value={convite?.email || ""}
                  readOnly
                  className="bg-muted cursor-not-allowed font-medium"
                />
                <ShieldCheck className="absolute right-3 top-2.5 h-4 w-4 text-success" />
              </div>
              <p className="text-[10px] text-muted-foreground">E-mail vinculado ao seu convite.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Criar Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="space-y-1 mt-2">
                <div className="flex justify-between text-[10px] uppercase tracking-wider font-semibold">
                  <span>Força da senha</span>
                  <span>{strength}%</span>
                </div>
                <Progress value={strength} className={`h-1 ${strengthColor}`} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="********"
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-[10px] text-destructive">As senhas não coincidem.</p>
              )}
            </div>

            <Button type="submit" className="w-full mt-2" disabled={submitting || strength < 50}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Concluindo...
                </>
              ) : (
                "Concluir Cadastro"
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <p className="text-xs text-center w-full text-muted-foreground">
            Powered by MTR2.TECH
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
