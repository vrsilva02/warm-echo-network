import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth, type AppRole } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";

interface RequireRoleProps {
  roles: AppRole[];
  children: ReactNode;
}

/**
 * Client-side guard: redirects to /403 when the current user does not have
 * any of the required roles. Server-side security is enforced by RLS.
 */
export function RequireRole({ roles, children }: RequireRoleProps) {
  const { loading, roles: userRoles } = useAuth();
  const navigate = useNavigate();
  const allowed = userRoles.some((r) => roles.includes(r));

  useEffect(() => {
    if (!loading && !allowed) {
      navigate({ to: "/403", replace: true });
    }
  }, [loading, allowed, navigate]);

  if (loading) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (!allowed) return null;
  return <>{children}</>;
}
