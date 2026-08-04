import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  loader: async ({ location }) => {
    const searchParams = new URLSearchParams(location.search);
    const next = searchParams.get("next") || "/dashboard";
    
    // O Supabase processa o hash (#access_token=...) automaticamente se o client for carregado.
    // getSession() irá trocar o código ou validar o hash e persistir no localStorage.
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      throw redirect({ to: next });
    }
    
    // Se não houver sessão imediata, aguardamos um pouco para o hash ser processado pelo onAuthStateChange
    return { next };
  },
  component: CallbackComponent,
});

function CallbackComponent() {
  const { next } = Route.useLoaderData();
  const navigate = Route.useNavigate();

  // Caso o loader não tenha redirecionado (o que acontece se o hash demorar a carregar),
  // forçamos o check no componente montado.
  import("react").then(({ useEffect }) => {
    useEffect(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          navigate({ to: next, replace: true });
        } else {
          // Se ainda não houver sessão após um pequeno delay, manda para o login
          const timer = setTimeout(() => {
            navigate({ to: "/auth", replace: true });
          }, 2000);
          return () => clearTimeout(timer);
        }
      });
    }, [next, navigate]);
  });

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground">Finalizando autenticação...</p>
      </div>
    </div>
  );
}
