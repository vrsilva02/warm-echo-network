import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldOff, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/403")({
  component: ForbiddenPage,
  head: () => ({
    meta: [
      { title: "Acesso negado — GestoraIT" },
      { name: "description", content: "Você não tem permissão para acessar esta área do GestoraIT." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function ForbiddenPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10 text-destructive">
        <ShieldOff className="h-8 w-8" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Acesso negado</h1>
        <p className="text-sm text-muted-foreground">
          Seu perfil não tem permissão para acessar esta área. Se você acredita que isso é um engano,
          entre em contato com um administrador do GestoraIT.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" asChild>
          <Link to="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}
