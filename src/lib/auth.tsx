import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "gestor_ti" | "padrao" | "visitante" | "auditoria" | "tecnico";

interface AuthCtx {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  loading: boolean;
  isAdmin: boolean;
  isGestor: boolean;
  isAuditoria: boolean;
  isTecnico: boolean;
  canWrite: boolean;
  canOperateOS: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => loadRoles(s.user.id), 0);
      } else {
        setRoles([]);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        loadRoles(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadRoles(userId: string) {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    setRoles((data ?? []).map((r) => r.role as AppRole));
  }

  const isAdmin = roles.includes("admin");
  const isGestor = roles.includes("gestor_ti");
  const isAuditoria = roles.includes("auditoria");
  const isTecnico = roles.includes("tecnico");

  const value: AuthCtx = {
    session,
    user: session?.user ?? null,
    roles,
    loading,
    isAdmin,
    isGestor,
    isAuditoria,
    isTecnico,
    canWrite: isAdmin || isGestor,
    canOperateOS: isAdmin || isGestor || isTecnico,
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}

export function roleLabel(r: AppRole): string {
  const map: Record<AppRole, string> = {
    admin: "Admin",
    gestor_ti: "Gestão",
    tecnico: "Técnico",
    padrao: "Padrão",
    visitante: "Visitante",
    auditoria: "Auditoria",
  };
  return map[r] ?? r;
}
