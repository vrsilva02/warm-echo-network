import { createFileRoute, redirect } from "@tanstack/react-router";

// O GestoraIT não permite auto-cadastro. Novos usuários entram apenas por convite
// enviado por um administrador. Qualquer tentativa de acessar rotas de cadastro
// é redirecionada para a tela de login.
export const Route = createFileRoute("/signup")({
  beforeLoad: () => {
    throw redirect({ to: "/auth", replace: true });
  },
  component: () => null,
});
